/**
 * global.setup.ts — Autenticação E2E
 *
 * Faz login via UI uma única vez e salva o storageState (localStorage com sessão Supabase).
 * Todos os specs em e2e/ (exceto auth/login.spec.ts) reutilizam esse estado.
 *
 * Pré-requisitos:
 *  - .env.e2e com TEST_USER_EMAIL e TEST_USER_PASSWORD
 *  - Conta de teste existente no Supabase Cloud com pelo menos 1 familiar cadastrado
 */
import { test as setup, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const AUTH_FILE = path.join(__dirname, ".auth/user.json");

setup("autenticar usuário de teste", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Variáveis TEST_USER_EMAIL e TEST_USER_PASSWORD não encontradas.\n" +
        "Copie .env.e2e.example para .env.e2e e preencha com credenciais de teste."
    );
  }

  // Garante que o diretório .auth existe
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto("/login");
  await expect(page.locator("img[alt='Locus Vita']")).toBeVisible();

  // Preenche e-mail e senha
  await page.locator("input[type='email']").fill(email);
  await page.locator("input[type='password']").fill(password);

  // Clica em Entrar e aguarda redirect para /home
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });

  // Aguarda o conteúdo da Home carregar (evita salvar storageState antes do token Supabase ser gravado)
  await expect(page.getByText("Acesso Rápido")).toBeVisible({ timeout: 15_000 });

  // Salva localStorage + cookies para reutilização em todos os outros specs
  await page.context().storageState({ path: AUTH_FILE });
});
