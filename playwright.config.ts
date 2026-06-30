import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import * as path from "path";

// Carrega variáveis de ambiente do .env.e2e (nunca sobrescreve o .env principal)
dotenv.config({ path: path.resolve(process.cwd(), ".env.e2e"), override: false });

/**
 * Config standalone — não depende de lovable-agent-playwright-config.
 * Pré-requisitos:
 *  1. `bun run dev` rodando em paralelo (localhost:8080)
 *  2. .env.e2e preenchido com TEST_USER_EMAIL e TEST_USER_PASSWORD
 *  3. bun x playwright install chromium  (uma vez, instala browsers)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 35_000,
  expect: { timeout: 12_000 },

  // Testes compartilham o banco de produção — rodar em série para evitar conflitos
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [["html", { outputFolder: "e2e/report", open: "never" }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },

  projects: [
    // 1. Setup: faz login e salva storageState (localStorage com sessão Supabase)
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // 2. Testes autenticados: reutilizam o storageState salvo pelo setup
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /global\.setup\.ts|auth\/login\.spec\.ts/,
    },

    // 3. Teste de login: roda SEM storageState (testa o fluxo de autenticação do zero)
    {
      name: "login",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth\/login\.spec\.ts/,
    },
  ],
});
