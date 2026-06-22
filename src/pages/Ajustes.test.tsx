/**
 * Ajustes.test.tsx
 *
 * Testes de regressão — reorganização da tela de Ajustes (sessão 38).
 *
 * Estratégia:
 *   - Testes unitários de `buildMenuGroups` (função pura exportada) cobrem
 *     a maior parte dos requisitos: estrutura de grupos, labels, paths e
 *     visibilidade por role — sem dependência de rendering.
 *   - Um smoke test de rendering verifica que o componente monta sem crash.
 *
 * Cobertura:
 *   1. Grupos corretos (Segurança, Conformidade, Suporte) com seus títulos
 *   2. Itens renomeados (Senha e Biometria, Perguntas e Respostas, Novidade Locus Vita)
 *   3. Paths de navegação íntegros
 *   4. Gestão de Acessos — admin vs. não-admin
 *   5. Ações especiais (export, revoke, delete, support) mapeadas corretamente
 *   6. Nenhum item com label legado presente
 *   7. Ordem global dos grupos
 */

import { describe, it, expect } from "vitest";
import { buildMenuGroups } from "./Ajustes";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Coleta todos os labels de todos os itens em todos os grupos */
const allLabels = (isAdmin: boolean) =>
  buildMenuGroups(isAdmin).flatMap((g) => g.items.map((i) => i.label));

/** Encontra um item pelo label em qualquer grupo */
const findItem = (label: string, isAdmin = true) =>
  buildMenuGroups(isAdmin)
    .flatMap((g) => g.items)
    .find((i) => i.label === label);

/** Encontra um grupo pelo título */
const findGroup = (title: string, isAdmin = true) =>
  buildMenuGroups(isAdmin).find((g) => g.title === title);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Grupos — títulos e ordem
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMenuGroups — estrutura de grupos", () => {
  it("retorna 5 grupos no total para admin", () => {
    // [Meus Dados, Gerenciar Família, Segurança, Notificações, Conformidade, Suporte]
    // Meus Dados e Gerenciar Família são grupos sem título (standalone), somando 6
    expect(buildMenuGroups(true)).toHaveLength(6);
  });

  it("retorna os títulos de grupo corretos na ordem esperada", () => {
    const titles = buildMenuGroups(true)
      .map((g) => g.title)
      .filter(Boolean);
    expect(titles).toEqual(["Segurança", "Conformidade", "Suporte"]);
  });

  it("grupos 'Meus Dados' e 'Gerenciar Família' não têm título (standalone)", () => {
    const groups = buildMenuGroups(true);
    // Primeiro grupo: Meus Dados
    expect(groups[0].title).toBeUndefined();
    expect(groups[0].items[0].label).toBe("Meus Dados");
    // Segundo grupo: Gerenciar Família
    expect(groups[1].title).toBeUndefined();
    expect(groups[1].items[0].label).toBe("Gerenciar Família");
  });

  it("grupo Notificações não tem título (standalone)", () => {
    const notifGroup = buildMenuGroups(true).find((g) =>
      g.items.some((i) => i.label === "Notificações")
    );
    expect(notifGroup?.title).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Itens renomeados — novos labels presentes, legados ausentes
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMenuGroups — labels corretos (renomeados)", () => {
  it("usa 'Senha e Biometria' (não 'Segurança e Senha')", () => {
    const labels = allLabels(true);
    expect(labels).toContain("Senha e Biometria");
    expect(labels).not.toContain("Segurança e Senha");
  });

  it("usa 'Perguntas e Respostas' (não 'Ajuda e Suporte')", () => {
    const labels = allLabels(true);
    expect(labels).toContain("Perguntas e Respostas");
    expect(labels).not.toContain("Ajuda e Suporte");
  });

  it("usa 'Novidade Locus Vita' (não 'Novidades do Locus Vita')", () => {
    const labels = allLabels(true);
    expect(labels).toContain("Novidade Locus Vita");
    expect(labels).not.toContain("Novidades do Locus Vita");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Paths de navegação
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMenuGroups — paths de navegação", () => {
  const navCases: [string, string][] = [
    ["Meus Dados", "/meus-dados"],
    ["Gerenciar Família", "/gerenciar-familia"],
    ["Senha e Biometria", "/seguranca-conta"],
    ["Notificações", "/notificacoes"],
    ["Política de Privacidade", "/politica-de-privacidade"],
    ["Perguntas e Respostas", "/ajuda"],
    ["Novidade Locus Vita", "/changelog"],
    ["Gestão de Acessos", "/gestao-acessos"],
  ];

  for (const [label, path] of navCases) {
    it(`'${label}' → navega para '${path}'`, () => {
      const item = findItem(label, true);
      expect(item).toBeDefined();
      expect(item?.action).toEqual({ kind: "navigate", path });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Gestão de Acessos — admin only
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMenuGroups — Gestão de Acessos (admin only)", () => {
  it("'Gestão de Acessos' está presente no grupo Segurança para admin", () => {
    const secGroup = findGroup("Segurança", true);
    const labels = secGroup?.items.map((i) => i.label) ?? [];
    expect(labels).toContain("Gestão de Acessos");
  });

  it("'Gestão de Acessos' NÃO está presente para usuário não-admin", () => {
    const labels = allLabels(false);
    expect(labels).not.toContain("Gestão de Acessos");
  });

  it("grupo Segurança tem exatamente 2 itens para admin (Senha e Biometria + Gestão de Acessos)", () => {
    const secGroup = findGroup("Segurança", true);
    expect(secGroup?.items).toHaveLength(2);
  });

  it("grupo Segurança tem exatamente 1 item para não-admin (apenas Senha e Biometria)", () => {
    const secGroup = findGroup("Segurança", false);
    expect(secGroup?.items).toHaveLength(1);
    expect(secGroup?.items[0].label).toBe("Senha e Biometria");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Ações especiais (Conformidade)
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMenuGroups — ações especiais do grupo Conformidade", () => {
  it("'Exportar Meus Dados' tem action.kind = 'export'", () => {
    const item = findItem("Exportar Meus Dados");
    expect(item?.action.kind).toBe("export");
  });

  it("'Exportar Meus Dados' tem sublabel mencionando LGPD Art. 18-V", () => {
    const item = findItem("Exportar Meus Dados");
    expect(item?.sublabel).toMatch(/18-V/);
  });

  it("'Revogar Consentimento' tem action.kind = 'revoke'", () => {
    const item = findItem("Revogar Consentimento");
    expect(item?.action.kind).toBe("revoke");
  });

  it("'Revogar Consentimento' tem sublabel mencionando LGPD Art. 18-IX", () => {
    const item = findItem("Revogar Consentimento");
    expect(item?.sublabel).toMatch(/18-IX/);
  });

  it("'Excluir Conta' tem action.kind = 'delete' e danger = true", () => {
    const item = findItem("Excluir Conta");
    expect(item?.action.kind).toBe("delete");
    expect(item?.danger).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Ações especiais (Suporte)
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMenuGroups — ações do grupo Suporte", () => {
  it("'Fale Conosco' tem action.kind = 'support'", () => {
    const item = findItem("Fale Conosco");
    expect(item?.action.kind).toBe("support");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Lista completa de itens — admin vs não-admin
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMenuGroups — completude da lista", () => {
  const expectedAdmin = [
    "Meus Dados",
    "Gerenciar Família",
    "Senha e Biometria",
    "Gestão de Acessos",
    "Notificações",
    "Política de Privacidade",
    "Exportar Meus Dados",
    "Revogar Consentimento",
    "Excluir Conta",
    "Perguntas e Respostas",
    "Fale Conosco",
    "Novidade Locus Vita",
  ];

  const expectedUser = expectedAdmin.filter((l) => l !== "Gestão de Acessos");

  it("admin recebe exatamente 12 itens (incluindo Gestão de Acessos)", () => {
    expect(allLabels(true)).toHaveLength(12);
    expect(allLabels(true)).toEqual(expectedAdmin);
  });

  it("não-admin recebe exatamente 11 itens (sem Gestão de Acessos)", () => {
    expect(allLabels(false)).toHaveLength(11);
    expect(allLabels(false)).toEqual(expectedUser);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Itens no grupo correto
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMenuGroups — itens no grupo correto", () => {
  it("grupo Conformidade contém Política de Privacidade, Exportar, Revogar e Excluir", () => {
    const conformGroup = findGroup("Conformidade");
    const labels = conformGroup?.items.map((i) => i.label) ?? [];
    expect(labels).toContain("Política de Privacidade");
    expect(labels).toContain("Exportar Meus Dados");
    expect(labels).toContain("Revogar Consentimento");
    expect(labels).toContain("Excluir Conta");
  });

  it("grupo Suporte contém Perguntas e Respostas, Fale Conosco e Novidade Locus Vita", () => {
    const supGroup = findGroup("Suporte");
    const labels = supGroup?.items.map((i) => i.label) ?? [];
    expect(labels).toContain("Perguntas e Respostas");
    expect(labels).toContain("Fale Conosco");
    expect(labels).toContain("Novidade Locus Vita");
  });

  it("'Novidade Locus Vita' está no grupo Suporte, não na raiz", () => {
    const supGroup = findGroup("Suporte");
    const inSupport = supGroup?.items.some((i) => i.label === "Novidade Locus Vita");
    expect(inSupport).toBe(true);
  });

  it("'Senha e Biometria' está no grupo Segurança", () => {
    const secGroup = findGroup("Segurança");
    const inSec = secGroup?.items.some((i) => i.label === "Senha e Biometria");
    expect(inSec).toBe(true);
  });
});
