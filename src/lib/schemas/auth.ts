import { z } from "zod";

/**
 * [ID-016] Schemas Zod centralizados para Cadastro.tsx e Login.tsx (react-hook-form + zodResolver).
 * O cadastro é o ponto de entrada de dados de saúde do titular e dependentes —
 * a validação de consentimento LGPD (Art. 11) é parte do schema, não apenas da UI,
 * para que o "aceite obrigatório" não dependa só de um checkbox desabilitando o botão.
 */
export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres.").max(200, "Nome muito longo."),
    email: z.string().trim().min(1, "Preencha o e-mail.").email("E-mail inválido."),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a senha."),
    consentAccepted: z.literal(true, {
      errorMap: () => ({ message: "Você precisa aceitar a Política de Privacidade para criar sua conta." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const signupDefaultValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  consentAccepted: false as unknown as true, // RHF default; zod só aceita `true` no submit
};

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Digite seu e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Digite sua senha."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Digite seu e-mail.").email("E-mail inválido."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
