-- PROD-01 + PROD-02: campos de endereço de cobrança em family_members
-- A API Asaas exige cpfCnpj, postalCode e addressNumber no objeto
-- creditCardHolderInfo para antifraude em producao. Campo cpf ja existia
-- e phone tambem. Adicionamos os dois campos de endereco que faltavam.
--
-- RLS: herdada da tabela family_members (sem alteracao de policies).
-- Migracao segura: IF NOT EXISTS — idempotente.

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS postal_code    TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT;

COMMENT ON COLUMN public.family_members.postal_code
  IS 'CEP para cobranca Asaas (8 digitos sem hifen). Preenchido em Meus Dados.';

COMMENT ON COLUMN public.family_members.address_number
  IS 'Numero do endereco para cobranca Asaas. Preenchido em Meus Dados.';
