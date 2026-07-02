/**
 * auth.test.ts — [ID-016]
 * Cobre signupSchema (com LGPD Art. 11 consentAccepted), loginSchema e
 * forgotPasswordSchema.
 */
import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema, forgotPasswordSchema } from "./auth";

describe("signupSchema", () => {
  const valid = {
    name: "João da Silva",
    email: "joao@example.com",
    password: "senha1234",
    confirmPassword: "senha1234",
    consentAccepted: true as const,
  };

  it("aceita dados válidos", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita nome com menos de 2 caracteres", () => {
    expect(signupSchema.safeParse({ ...valid, name: "J" }).success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    expect(signupSchema.safeParse({ ...valid, email: "não-é-email" }).success).toBe(false);
  });

  it("rejeita senha com menos de 8 caracteres", () => {
    expect(signupSchema.safeParse({ ...valid, password: "123", confirmPassword: "123" }).success).toBe(false);
  });

  it("rejeita quando as senhas não coincidem", () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: "outraSenha123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("confirmPassword"))).toBe(true);
    }
  });

  it("rejeita consentAccepted !== true (LGPD Art. 11)", () => {
    const result = signupSchema.safeParse({ ...valid, consentAccepted: false });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("aceita e-mail e senha preenchidos", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "qualquer" }).success).toBe(true);
  });

  it("rejeita e-mail vazio", () => {
    expect(loginSchema.safeParse({ email: "", password: "qualquer" }).success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("aceita e-mail válido", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    expect(forgotPasswordSchema.safeParse({ email: "invalido" }).success).toBe(false);
  });
});
