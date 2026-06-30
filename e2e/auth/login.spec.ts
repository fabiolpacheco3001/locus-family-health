/**
 * Fluxo crítico 1: Login
 *
 * Testa o fluxo completo de autenticação do zero (sem storageState pré-salvo).
 * Valida que o usuário consegue fazer login e que a Home carrega corretamente.
 *
 * Projeto Playwright: "login" (sem dependência de setup)
 */
import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("usuário faz login com credenciais válidas e é redirecionado para a Home", async ({
    page,
  }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
      test.skip(true, "TEST_USER_EMAIL / TEST_USER_PASSWORD não definidos em .env.e2e");
    }

    // ── 1. Acessa página de login ───────────────────────────────────────────
    await page.goto("/login");
    await expect(page.locator("img[alt='Locus Vita']")).toBeVisible();

    // ── 2. Preenche credenciais ─────────────────────────────────────────────
    await page.locator("input[type='email']").fill(email!);
    await page.locator("input[type='password']").fill(password!);

    // ── 3. Submete o formulário ─────────────────────────────────────────────
    const submitBtn = page.getByRole("button", { name: "Entrar" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // ── 4. Verifica redirect para /home ─────────────────────────────────────
    await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });

    // ── 5. Verifica elementos da Home ───────────────────────────────────────
    // "Acesso Rápido" é renderizado no bloco escuro da Home
    await expect(page.getByText("Acesso Rápido")).toBeVisible({ timeout: 15_000 });

    // Os 4 atalhos do quick access devem estar visíveis
    // Usa getByRole para evitar strict mode violation — a página tem "Consultas Pendentes"
    // e "Medicamentos Ativos" como textos adicionais que também contêm esses termos.
    await expect(page.getByRole("button", { name: "Consultas", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exames", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Medicamentos", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ler Receita", exact: true })).toBeVisible();
  });

  test("login com credenciais inválidas exibe mensagem de erro", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("img[alt='Locus Vita']")).toBeVisible();

    await page.locator("input[type='email']").fill("nao-existe@exemplo.com");
    await page.locator("input[type='password']").fill("senha-errada-123");

    await page.getByRole("button", { name: "Entrar" }).click();

    // Sonner toast de erro deve aparecer
    await expect(
      page.getByText("E-mail ou senha incorretos", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Permanece na página de login
    await expect(page).toHaveURL(/\/login/);
  });
});
