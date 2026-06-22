/**
 * Ajustes.test.tsx
 *
 * Testes de regressão — estrutura de navegação de Ajustes (sessão 38 v2).
 *
 * Nova arquitetura: Ajustes exibe 6 menus de topo; ao clicar em Segurança,
 * Conformidade ou Suporte, o usuário entra em sub-telas dedicadas.
 *
 * Cobertura:
 *   1. topMenuItems — 6 itens corretos, paths corretos
 *   2. segurancaItems — itens e paths da sub-tela Segurança
 *   3. segurancaItems — adminOnly respeitado
 *   4. conformidadeItems — itens, actions e sublabels
 *   5. suporteItems — itens e paths
 *   6. Nenhum submenu aparece no menu principal (paths são sub-rotas)
 *   7. Itens legados ausentes (nomes antigos não existem)
 */

import { describe, it, expect } from "vitest";
import { topMenuItems } from "./Ajustes";
import { segurancaItems } from "./AjustesSeguranca";
import { conformidadeItems } from "./AjustesConformidade";
import { suporteItems } from "./AjustesSuporte";

// ─────────────────────────────────────────────────────────────────────────────
// 1. topMenuItems — tela principal de Ajustes
// ─────────────────────────────────────────────────────────────────────────────

describe("Ajustes — topMenuItems (6 menus de topo)", () => {
  it("tem exatamente 6 itens", () => {
    expect(topMenuItems).toHaveLength(6);
  });

  it("labels corretos na ordem esperada", () => {
    expect(topMenuItems.map((i) => i.label)).toEqual([
      "Meus Dados",
      "Gerenciar Família",
      "Segurança",
      "Notificações",
      "Conformidade",
      "Suporte",
    ]);
  });

  it("paths corretos para cada item", () => {
    const paths: Record<string, string> = {
      "Meus Dados":        "/meus-dados",
      "Gerenciar Família": "/gerenciar-familia",
      "Segurança":         "/ajustes/seguranca",
      "Notificações":      "/notificacoes",
      "Conformidade":      "/ajustes/conformidade",
      "Suporte":           "/ajustes/suporte",
    };
    for (const item of topMenuItems) {
      expect(item.path, `path errado para "${item.label}"`).toBe(paths[item.label]);
    }
  });

  it("Segurança, Conformidade e Suporte apontam para sub-rotas /ajustes/*", () => {
    const subRoutes = topMenuItems.filter((i) => i.path.startsWith("/ajustes/"));
    expect(subRoutes.map((i) => i.label)).toEqual(["Segurança", "Conformidade", "Suporte"]);
  });

  it("não contém itens com labels de submenu (ex: 'Senha e Biometria')", () => {
    const labels = topMenuItems.map((i) => i.label);
    expect(labels).not.toContain("Senha e Biometria");
    expect(labels).not.toContain("Gestão de Acessos");
    expect(labels).not.toContain("Política de Privacidade");
    expect(labels).not.toContain("Exportar Meus Dados");
    expect(labels).not.toContain("Revogar Consentimento");
    expect(labels).not.toContain("Excluir Conta");
    expect(labels).not.toContain("Dúvidas Frequentes");
    expect(labels).not.toContain("Fale Conosco");
    expect(labels).not.toContain("Novidade Locus Vita");
  });

  it("não contém labels legados", () => {
    const labels = topMenuItems.map((i) => i.label);
    expect(labels).not.toContain("Segurança e Senha");
    expect(labels).not.toContain("Ajuda e Suporte");
    expect(labels).not.toContain("Novidades do Locus Vita");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. segurancaItems — sub-tela Segurança
// ─────────────────────────────────────────────────────────────────────────────

describe("AjustesSeguranca — segurancaItems", () => {
  it("tem exatamente 2 itens", () => {
    expect(segurancaItems).toHaveLength(2);
  });

  it("labels corretos", () => {
    expect(segurancaItems.map((i) => i.label)).toEqual([
      "Senha e Biometria",
      "Gestão de Acessos",
    ]);
  });

  it("'Senha e Biometria' → /seguranca-conta", () => {
    const item = segurancaItems.find((i) => i.label === "Senha e Biometria");
    expect(item?.path).toBe("/seguranca-conta");
    expect(item?.adminOnly).toBeFalsy();
  });

  it("'Gestão de Acessos' → /gestao-acessos, adminOnly=true", () => {
    const item = segurancaItems.find((i) => i.label === "Gestão de Acessos");
    expect(item?.path).toBe("/gestao-acessos");
    expect(item?.adminOnly).toBe(true);
  });

  it("itens visíveis para admin = 2", () => {
    const visible = segurancaItems.filter((i) => !i.adminOnly || true);
    expect(visible).toHaveLength(2);
  });

  it("itens visíveis para não-admin = 1 (sem Gestão de Acessos)", () => {
    const visible = segurancaItems.filter((i) => !i.adminOnly);
    expect(visible).toHaveLength(1);
    expect(visible[0].label).toBe("Senha e Biometria");
  });

  it("label legado 'Segurança e Senha' está ausente", () => {
    const labels = segurancaItems.map((i) => i.label);
    expect(labels).not.toContain("Segurança e Senha");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. conformidadeItems — sub-tela Conformidade
// ─────────────────────────────────────────────────────────────────────────────

describe("AjustesConformidade — conformidadeItems", () => {
  it("tem exatamente 4 itens", () => {
    expect(conformidadeItems).toHaveLength(4);
  });

  it("labels corretos na ordem", () => {
    expect(conformidadeItems.map((i) => i.label)).toEqual([
      "Política de Privacidade",
      "Exportar Meus Dados",
      "Revogar Consentimento",
      "Excluir Conta",
    ]);
  });

  it("'Política de Privacidade' → navigate /politica-de-privacidade", () => {
    const item = conformidadeItems.find((i) => i.label === "Política de Privacidade");
    expect(item?.action).toEqual({ kind: "navigate", path: "/politica-de-privacidade" });
  });

  it("'Exportar Meus Dados' → action export + sublabel LGPD 18-V + accent", () => {
    const item = conformidadeItems.find((i) => i.label === "Exportar Meus Dados");
    expect(item?.action.kind).toBe("export");
    expect(item?.sublabel).toMatch(/18-V/);
    expect(item?.accent).toBe(true);
  });

  it("'Revogar Consentimento' → action revoke + sublabel LGPD 18-IX + warning", () => {
    const item = conformidadeItems.find((i) => i.label === "Revogar Consentimento");
    expect(item?.action.kind).toBe("revoke");
    expect(item?.sublabel).toMatch(/18-IX/);
    expect(item?.warning).toBe(true);
  });

  it("'Excluir Conta' → action delete + danger", () => {
    const item = conformidadeItems.find((i) => i.label === "Excluir Conta");
    expect(item?.action.kind).toBe("delete");
    expect(item?.danger).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. suporteItems — sub-tela Suporte
// ─────────────────────────────────────────────────────────────────────────────

describe("AjustesSuporte — suporteItems", () => {
  it("tem exatamente 3 itens", () => {
    expect(suporteItems).toHaveLength(3);
  });

  it("labels corretos na ordem", () => {
    expect(suporteItems.map((i) => i.label)).toEqual([
      "Dúvidas Frequentes",
      "Fale Conosco",
      "Novidade Locus Vita",
    ]);
  });

  it("'Dúvidas Frequentes' → navigate /ajuda", () => {
    const item = suporteItems.find((i) => i.label === "Dúvidas Frequentes");
    expect(item?.kind).toBe("navigate");
    expect(item?.path).toBe("/ajuda");
  });

  it("'Fale Conosco' → kind support (abre URL ou mailto)", () => {
    const item = suporteItems.find((i) => i.label === "Fale Conosco");
    expect(item?.kind).toBe("support");
    expect(item?.path).toBeUndefined();
  });

  it("'Novidade Locus Vita' → navigate /changelog", () => {
    const item = suporteItems.find((i) => i.label === "Novidade Locus Vita");
    expect(item?.kind).toBe("navigate");
    expect(item?.path).toBe("/changelog");
  });

  it("labels legados ausentes", () => {
    const labels = suporteItems.map((i) => i.label);
    expect(labels).not.toContain("Ajuda e Suporte");
    expect(labels).not.toContain("Novidades do Locus Vita");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Integridade geral — todos os paths navegáveis são válidos
// ─────────────────────────────────────────────────────────────────────────────

describe("Integridade de paths — todos os paths são /rotas reais", () => {
  const knownPaths = new Set([
    "/meus-dados",
    "/gerenciar-familia",
    "/ajustes/seguranca",
    "/notificacoes",
    "/ajustes/conformidade",
    "/ajustes/suporte",
    "/seguranca-conta",
    "/gestao-acessos",
    "/politica-de-privacidade",
    "/ajuda",
    "/changelog",
  ]);

  it("todos os paths de topMenuItems existem em knownPaths", () => {
    for (const item of topMenuItems) {
      expect(knownPaths.has(item.path), `Path desconhecido: ${item.path}`).toBe(true);
    }
  });

  it("todos os paths de segurancaItems existem em knownPaths", () => {
    for (const item of segurancaItems.filter((i) => i.path)) {
      expect(knownPaths.has(item.path!), `Path desconhecido: ${item.path}`).toBe(true);
    }
  });

  it("paths de suporteItems do tipo 'navigate' existem em knownPaths", () => {
    for (const item of suporteItems.filter((i) => i.kind === "navigate" && i.path)) {
      expect(knownPaths.has(item.path!), `Path desconhecido: ${item.path}`).toBe(true);
    }
  });

  it("path de Política de Privacidade na Conformidade existe em knownPaths", () => {
    const pp = conformidadeItems.find((i) => i.action.kind === "navigate") as any;
    expect(knownPaths.has(pp?.action?.path)).toBe(true);
  });
});
