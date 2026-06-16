-- Security fix: system_configs SELECT policy
--
-- Vulnerability (Warning — Lovable scanner):
--   "Authenticated users can read configs" usa USING (true) — expõe TODAS as chaves
--   da tabela system_configs para qualquer usuário autenticado. Se no futuro uma chave
--   sensível for adicionada (ex: endpoint interno, flag com semântica privilegiada),
--   ela ficaria exposta a todos os clientes.
--
-- Fix: substituir a policy blanket por duas policies:
--   (A) Admins/super_admins: acesso irrestrito a todas as chaves
--   (B) Usuários comuns: apenas chaves explicitamente declaradas como públicas
--
-- Chaves públicas (usadas por Ajustes.tsx sem autenticação de admin):
--   - support_url   → URL do portal de suporte exibida no app
--   - support_email → E-mail de atendimento exibido no app
--
-- Chaves restritas a admins (command-center):
--   - ai_status (em system_settings — tabela diferente, não afetada aqui)
--   Quaisquer chaves futuras adicionadas ao system_configs ficam restritas a admins
--   por padrão, a menos que sejam adicionadas ao array abaixo.

-- 1. Remove a policy permissiva atual
DROP POLICY IF EXISTS "Authenticated users can read configs" ON public.system_configs;

-- 2. Admins e super_admins leem tudo
CREATE POLICY "Admins can read all configs"
ON public.system_configs
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id   = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);

-- 3. Usuários comuns leem apenas as chaves declaradas como públicas
CREATE POLICY "Authenticated users can read public configs"
ON public.system_configs
FOR SELECT
TO authenticated
USING (
  key = ANY(ARRAY['support_url', 'support_email'])
);
