/**
 * Fluxo crítico 2: Cadastro de Medicamento
 *
 * Testa a criação de um novo medicamento via AddMedicationDrawer.
 * O teste limpa os dados ao final (deleta o medicamento criado).
 *
 * Pré-condição: conta de teste tem ao menos 1 familiar cadastrado.
 * Quando há 1 familiar, clicar em "Medicamentos" na Home navega diretamente
 * para /familiar/{id}/medicamentos sem abrir o drawer de seleção.
 *
 * Projeto Playwright: "chromium" (usa storageState do global.setup.ts)
 */
import { test, expect } from "@playwright/test";

// Nome único para evitar conflito com medicamentos reais do usuário de teste
const TEST_MED_NAME = `Dipirona E2E ${Date.now()}`;
const TEST_DOSAGE = "500mg";

test.describe("Cadastro de Medicamento", () => {
  test("abre o drawer, cadastra medicamento e verifica na lista", async ({ page }) => {
    // ── 1. Navega para a Home ───────────────────────────────────────────────
    await page.goto("/home");
    await expect(page.getByText("Acesso Rápido")).toBeVisible({ timeout: 15_000 });

    // ── 2. Clica em "Medicamentos" no quick access ──────────────────────────
    // Usa getByRole para evitar strict mode violation — a página tem "Medicamentos Ativos"
    // e "Ações Medicamentosas" como outros elementos que também contêm "Medicamentos".
    await page.getByRole("button", { name: "Medicamentos", exact: true }).click();

    // Aguarda navegação direta (1 membro) OU abertura do FamilySelectDrawer (múltiplos membros).
    // O drawer tem título "Para quem é o medicamento?" e exibe um botão por familiar.
    try {
      await page.waitForURL(/\/familiar\/.+\/medicamentos/, { timeout: 3_000 });
    } catch {
      // Drawer de seleção aberto — clica no primeiro membro disponível
      await expect(page.getByText("Para quem é o medicamento?")).toBeVisible({ timeout: 5_000 });
      const firstMemberBtn = page.getByRole("dialog").getByRole("button").first();
      await expect(firstMemberBtn).toBeVisible({ timeout: 5_000 });
      await firstMemberBtn.click();
    }

    // Confirma navegação para /familiar/{uuid}/medicamentos (direto ou via drawer)
    await expect(page).toHaveURL(/\/familiar\/.+\/medicamentos/, { timeout: 10_000 });

    // ── 3. Clica no FAB (+) para abrir o AddMedicationDrawer ────────────────
    // O FAB é um <button> com classes rounded-full e bg-[#FFB085]
    const fab = page.locator("button.rounded-full").first();
    await expect(fab).toBeVisible({ timeout: 8_000 });
    await fab.click();

    // ── 4. Aguarda o drawer abrir ───────────────────────────────────────────
    await expect(page.getByText("Novo Medicamento")).toBeVisible({ timeout: 8_000 });

    // ── 5. Preenche campos obrigatórios ─────────────────────────────────────
    // Nome do medicamento (MedicationAutocomplete renderiza <input>)
    const nameInput = page.getByPlaceholder("Ex: Amoxicilina, Dipirona");
    await expect(nameInput).toBeVisible();
    await nameInput.fill(TEST_MED_NAME);
    // Fecha sugestões do autocomplete pressionando Escape
    await nameInput.press("Escape");

    // Dosagem
    await page.getByPlaceholder("Ex: 5ml").fill(TEST_DOSAGE);

    // Frequência: seleciona "1x dia" (opção mais simples)
    const freqTrigger = page.getByRole("combobox").filter({ hasText: /Selecione|1x|12\/12/ }).first();
    if (await freqTrigger.isVisible()) {
      await freqTrigger.click();
      await page.getByRole("option", { name: "1x dia" }).click();
    }

    // ── 6. Salva o medicamento ──────────────────────────────────────────────
    await page.getByRole("button", { name: "Salvar Medicamento" }).click();

    // Toast de sucesso ou fechamento do drawer confirma salvamento
    await expect(
      page.getByText("Medicamento salvo", { exact: false }).or(
        page.getByText(TEST_MED_NAME)
      )
    ).toBeVisible({ timeout: 15_000 });

    // ── 7. Verifica que o medicamento aparece na lista ──────────────────────
    // Aguarda drawer fechar e lista recarregar
    await expect(page.getByText("Novo Medicamento")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(TEST_MED_NAME)).toBeVisible({ timeout: 10_000 });
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup: deleta o medicamento de teste criado pelo spec acima.
    // Usa nova página autenticada para navegar e deletar.
    const context = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const page = await context.newPage();

    try {
      await page.goto("/home");
      await page.getByRole("button", { name: "Medicamentos", exact: true }).click();
      try {
        await page.waitForURL(/\/familiar\/.+\/medicamentos/, { timeout: 3_000 });
      } catch {
        const firstMemberBtn = page.getByRole("dialog").getByRole("button").first();
        if (await firstMemberBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await firstMemberBtn.click();
        }
      }
      await expect(page).toHaveURL(/\/familiar\/.+\/medicamentos/, { timeout: 10_000 });

      // Localiza o medicamento de teste (pode não existir se o spec anterior falhou)
      const medCard = page.getByText(TEST_MED_NAME).first();
      const exists = await medCard.isVisible({ timeout: 5_000 }).catch(() => false);

      if (exists) {
        await medCard.click();
        // Aguarda drawer de edição abrir
        await expect(page.getByText("Editar Medicamento")).toBeVisible({ timeout: 8_000 });
        // Clica no botão de excluir (ícone Trash2)
        await page.locator("button[aria-label*='xclu'], button svg.lucide-trash2").first().click();
        // Confirma na AlertDialog
        await page.getByRole("button", { name: /confirmar|excluir/i }).click();
      }
    } catch {
      // Silencia erros de cleanup para não mascarar falhas do teste principal
    } finally {
      await context.close();
    }
  });
});
