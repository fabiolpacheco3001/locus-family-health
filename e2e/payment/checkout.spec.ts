/**
 * Fluxo crítico 4: Pagamento — Smoke Test
 *
 * Verifica que a página "Meu Plano" carrega corretamente e que o
 * botão de assinar/reativar existe e está habilitado.
 *
 * ⚠️  Este teste NÃO clica no botão de checkout para não iniciar uma
 * cobrança real no Asaas. É um smoke test de presença e acessibilidade.
 *
 * A lógica de window.open é verificada via intercepção de evento para
 * confirmar que a integração com o Asaas seria acionada corretamente.
 *
 * Projeto Playwright: "chromium" (usa storageState do global.setup.ts)
 */
import { test, expect } from "@playwright/test";

test.describe("Meu Plano — Smoke Test", () => {
  test("página Meu Plano carrega e exibe informações da assinatura", async ({ page }) => {
    // ── 1. Navega para /meu-plano ───────────────────────────────────────────
    await page.goto("/meu-plano");

    // ── 2. Verifica elementos básicos da página ─────────────────────────────
    // Título da página (texto do header)
    await expect(
      page.getByText("Meu Plano", { exact: false }).first()
    ).toBeVisible({ timeout: 15_000 });

    // Badge de status (Ativo / Período Gratuito / Expirado / Cancelado)
    // O badge é sempre renderizado com uma das classes de status
    const statusBadge = page
      .locator("span, div")
      .filter({
        hasText: /Ativo|Período Gratuito|Expirado|Cancelado|Pagamento Pendente|Gratuito/,
      })
      .first();
    await expect(statusBadge).toBeVisible({ timeout: 10_000 });
  });

  test("botão de assinar está presente quando a conta não tem assinatura ativa", async ({
    page,
  }) => {
    await page.goto("/meu-plano");
    await expect(page.getByText("Meu Plano", { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Aguarda página carregar completamente
    await page.waitForTimeout(2_000);

    // Verifica se algum botão de ação de pagamento existe
    // (pode ser "Assinar", "Regularizar", "Reativar" — depende do status da conta)
    const paymentButtons = page.getByRole("button").filter({
      hasText: /Assinar|Regularizar|Reativar|Plano Mensal|Plano Anual/,
    });

    const count = await paymentButtons.count();

    if (count === 0) {
      // Conta com assinatura ativa — verifica que o botão de cancelar existe
      // (confirma que a página renderizou corretamente para um assinante ativo)
      const managementSection = page
        .getByText(/Cancelar|Meu Plano|próxima cobrança/i, { exact: false })
        .first();
      await expect(managementSection).toBeVisible({ timeout: 5_000 });
      test.info().annotations.push({
        type: "info",
        description: "Conta com assinatura ativa — smoke test validado via seção de gerenciamento",
      });
    } else {
      // Conta sem assinatura ativa — botão de assinar deve estar habilitado
      const firstPaymentBtn = paymentButtons.first();
      await expect(firstPaymentBtn).toBeVisible();
      await expect(firstPaymentBtn).toBeEnabled();
      test.info().annotations.push({
        type: "info",
        description: `Botão de pagamento encontrado: "${await firstPaymentBtn.textContent()}"`,
      });
    }
  });

  test("window.open é chamado ao clicar em Regularizar/Reativar (interceptação)", async ({
    page,
  }) => {
    // Intercepta window.open ANTES de navegar — addInitScript só tem efeito em scripts
    // que rodam durante o carregamento da página; chamá-lo após page.goto não intercepta
    // a página já carregada.
    //
    // Padrão anti-popup iOS usado pelo app:
    //   1. window.open("about:blank", "_blank")  ← sincrono, antes do await
    //   2. checkoutWindow.location.href = url    ← atribuído após a edge fn retornar
    //
    // Retornar null quebraria o padrão (cairia no else: window.location.href = url).
    // Retornamos um mock que intercepta a atribuição de .href e captura a URL do Asaas.
    let windowOpenCalled = false;
    let windowOpenUrl = "";
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;

      // Mock de janela que captura atribuições de location.href
      const mockWin = {
        location: {
          get href() { return (w.__e2eWindowOpenUrl as string) ?? ""; },
          set href(val: string) {
            w.__e2eWindowOpenUrl = val;
            w.__e2eWindowOpenCalled = true;
          },
        },
        close: () => { /* noop */ },
      };

      w.__e2eOriginalOpen = window.open;
      window.open = (
        url?: string | URL,
        _target?: string,
        _features?: string
      ): WindowProxy | null => {
        const urlStr = String(url ?? "");
        // Captura URL real se passada diretamente (sem o padrão about:blank)
        if (urlStr && urlStr !== "about:blank") {
          w.__e2eWindowOpenCalled = true;
          w.__e2eWindowOpenUrl = urlStr;
        }
        // Retorna mock para que `checkoutWindow.location.href = url` seja interceptado
        return mockWin as unknown as WindowProxy;
      };
    });

    await page.goto("/meu-plano");
    await page.waitForTimeout(2_000);

    const paymentButtons = page.getByRole("button").filter({
      hasText: /Regularizar|Reativar/,
    });
    const count = await paymentButtons.count();

    if (count === 0) {
      test.skip(
        true,
        "Nenhum botão Regularizar/Reativar visível — conta está ativa ou em trial. " +
          "Use uma conta com assinatura cancelada para testar este fluxo."
      );
      return;
    }

    const targetBtn = paymentButtons.first();
    await expect(targetBtn).toBeEnabled();
    await targetBtn.click();

    // Detecta CPF guard: se a conta de teste não tem CPF cadastrado, o app navega para
    // /meus-dados em vez de chamar window.open — pulamos o teste graciosamente nesse caso.
    const redirectedToCpfPage = await page
      .waitForURL(/\/meus-dados/, { timeout: 2_000 })
      .then(() => true)
      .catch(() => false);

    if (redirectedToCpfPage) {
      test.skip(
        true,
        "Conta de teste sem CPF cadastrado — o app redirecionou para /meus-dados. " +
          "Cadastre o CPF na conta de teste (Ajustes → Meus Dados) para executar este fluxo."
      );
      return;
    }

    // Aguarda a edge function create-asaas-checkout ser chamada e location.href ser atribuído
    await page.waitForTimeout(10_000);

    windowOpenCalled = await page.evaluate(
      () => !!(window as unknown as Record<string, unknown>).__e2eWindowOpenCalled
    );
    windowOpenUrl = await page.evaluate(
      () => String((window as unknown as Record<string, unknown>).__e2eWindowOpenUrl ?? "")
    );

    expect(windowOpenCalled, "window.open deveria ter sido chamado pelo fluxo de checkout").toBe(
      true
    );
    expect(windowOpenUrl, "URL do Asaas deve conter 'asaas'").toContain("asaas");
  });
});
