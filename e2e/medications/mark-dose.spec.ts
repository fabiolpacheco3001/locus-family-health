/**
 * Fluxo crítico 3: Marcação de Dose
 *
 * Testa o fluxo de marcar uma dose como "Tomado" na seção
 * "Ações Medicamentosas" da Home.
 *
 * Pré-condição: conta de teste tem ao menos 1 medicamento ativo com
 * uma dose pendente para hoje (ou atrasada). Se não houver doses
 * pendentes, o teste é pulado automaticamente.
 *
 * Projeto Playwright: "chromium" (usa storageState do global.setup.ts)
 */
import { test, expect } from "@playwright/test";

test.describe("Marcação de Dose", () => {
  test("marca uma dose como Tomado e verifica badge de confirmação", async ({ page }) => {
    // ── 1. Navega para a Home ───────────────────────────────────────────────
    await page.goto("/home");
    await expect(page.getByText("Acesso Rápido")).toBeVisible({ timeout: 15_000 });

    // ── 2. Expande o accordion "Ações Medicamentosas" ───────────────────────
    const accordionTrigger = page.getByText("Ações Medicamentosas");
    await expect(accordionTrigger).toBeVisible({ timeout: 10_000 });
    await accordionTrigger.click();

    // ── 3. Aguarda conteúdo do accordion carregar ───────────────────────────
    // Pode mostrar "Nenhuma ação para hoje." ou cards de medicamentos
    await page.waitForTimeout(1_500); // aguarda queries React Query resolverem

    const emptyState = page.getByText("Nenhuma ação para hoje");
    const isEmptyState = await emptyState.isVisible({ timeout: 3_000 }).catch(() => false);

    if (isEmptyState) {
      test.skip(
        true,
        "Sem doses pendentes para hoje na conta de teste — " +
          "cadastre um medicamento com dose no horário atual para executar este teste."
      );
      return;
    }

    // ── 4. Localiza o primeiro botão "Tomar" visível ────────────────────────
    // MedicationDoseActions renderiza <Button>Tomar</Button> para doses pendentes
    const tomarBtn = page.getByRole("button", { name: "Tomar" }).first();
    await expect(tomarBtn).toBeVisible({ timeout: 10_000 });

    // ── 5. Clica em "Tomar" ─────────────────────────────────────────────────
    await tomarBtn.click();

    // ── 6. Verifica feedback visual ─────────────────────────────────────────
    // a) Toast de sucesso (Sonner)
    await expect(
      page.getByText("Dose registrada com sucesso", { exact: false })
    ).toBeVisible({ timeout: 8_000 });

    // b) Badge "Tomado" substitui o botão "Tomar" (UI otimista imediata)
    await expect(page.getByText("Tomado")).toBeVisible({ timeout: 8_000 });

    // c) Botão "Tomar" some para aquela dose
    await expect(tomarBtn).not.toBeVisible({ timeout: 5_000 });
  });
});
