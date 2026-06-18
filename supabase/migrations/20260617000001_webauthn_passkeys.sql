-- WebAuthn Passkeys — biometric re-authentication (BK-02)
-- Two tables:
--   passkeys            → stores registered FIDO2 credentials per user
--   webauthn_challenges → short-lived challenge tokens (5 min TTL) for ceremonies

-- ─── passkeys ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.passkeys (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT        NOT NULL UNIQUE,       -- base64url-encoded credential ID
  public_key    TEXT        NOT NULL,              -- base64url-encoded COSE public key
  counter       BIGINT      NOT NULL DEFAULT 0,    -- replay-attack counter
  device_name   TEXT        NOT NULL DEFAULT 'Dispositivo',
  transports    TEXT[],                            -- e.g. ['internal','hybrid']
  aaguid        TEXT,                              -- authenticator class identifier
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id
  ON public.passkeys(user_id);

CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id
  ON public.passkeys(credential_id);

ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;

-- Users may read and delete their own passkeys (INSERT/UPDATE via service_role only)
CREATE POLICY "passkeys_select_own"
  ON public.passkeys FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "passkeys_delete_own"
  ON public.passkeys FOR DELETE
  USING (user_id = auth.uid());

-- ─── webauthn_challenges ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge  TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_id
  ON public.webauthn_challenges(user_id);

-- No direct client access — edge functions use service_role
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
