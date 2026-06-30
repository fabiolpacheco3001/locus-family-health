// Re-exporta test e expect do @playwright/test padrão.
// O arquivo original importava de lovable-agent-playwright-config (pacote não publicado).
// Esta versão standalone usa o pacote oficial do Playwright.
export { test, expect } from "@playwright/test";
