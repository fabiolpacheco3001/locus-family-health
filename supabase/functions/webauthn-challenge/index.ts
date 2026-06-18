/**
 * webauthn-challenge
 *
 * Generates a WebAuthn ceremony challenge for:
 *   - "registration"   → new passkey enrollment
 *   - "authentication" → biometric re-authentication (app lock)
 *
 * Returns the PublicKeyCredentialCreationOptionsJSON (registration) or
 * PublicKeyCredentialRequestOptionsJSON (authentication) to pass directly to
 * @simplewebauthn/browser's startRegistration / startAuthentication.
 *
 * The challenge is stored in webauthn_challenges (TTL 5 min) and consumed
 * exactly once by webauthn-verify.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
} from "npm:@simplewebauthn/server@9.0.3";

// Types inferred from @simplewebauthn/server@9
type AuthenticatorTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

// ── helper: Uint8Array → base64url ───────────────────────────────────────────
// Needed because some @simplewebauthn/server versions return Uint8Array objects
// instead of base64url strings for `challenge` and `user.id`. We normalise
// ALL binary fields to base64url strings before sending to the browser.
function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b: number) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** JSON replacer: converts any Uint8Array value to a base64url string. */
function base64UrlReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return uint8ArrayToBase64Url(value);
  // Also handle Node-style Buffer (ArrayBuffer-backed objects with a `type` field)
  if (
    value !== null &&
    typeof value === "object" &&
    (value as { type?: string }).type === "Buffer" &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return uint8ArrayToBase64Url(new Uint8Array((value as { data: number[] }).data));
  }
  return value;
}

/** Ensures a value is a base64url string even if it comes as Uint8Array. */
function toBase64UrlString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return uint8ArrayToBase64Url(value);
  return String(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AUTH ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // service_role client for DB writes
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { type } = await req.json() as { type: "registration" | "authentication" };
    if (type !== "registration" && type !== "authentication") {
      return new Response(JSON.stringify({ error: "type must be 'registration' or 'authentication'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // rpId: effective domain from APP_ORIGIN (works for both prod and localhost)
    const appOrigin = Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173";
    const rpId = new URL(appOrigin).hostname;
    const rpName = "Locus Vita";

    let options: Record<string, unknown>;

    // ── REGISTRATION ─────────────────────────────────────────────────────────
    if (type === "registration") {
      const { data: existing } = await admin
        .from("passkeys")
        .select("credential_id, transports")
        .eq("user_id", user.id);

      options = await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userID: new TextEncoder().encode(user.id),
        userName: user.email ?? user.id,
        userDisplayName: user.email ?? "Usuário",
        attestationType: "none",
        excludeCredentials: (existing ?? []).map((p: { credential_id: string; transports: string[] | null }) => ({
          id: p.credential_id,
          transports: (p.transports ?? []) as AuthenticatorTransport[],
        })),
        authenticatorSelection: {
          authenticatorAttachment: "platform", // força Face ID / iCloud Keychain — impede Edge/Authenticator
          userVerification: "required",
          residentKey: "required",
        },
      }) as unknown as Record<string, unknown>;

    // ── AUTHENTICATION ────────────────────────────────────────────────────────
    } else {
      const { data: passkeys } = await admin
        .from("passkeys")
        .select("credential_id, transports")
        .eq("user_id", user.id);

      if (!passkeys || passkeys.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhuma biometria cadastrada para este usuário." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      log("info", "webauthn_auth_credentials", {
        userId: user.id,
        count: passkeys.length,
        credentialIds: passkeys.map((p: { credential_id: string }) => p.credential_id),
      });

      // allowCredentials: [] → discoverable credential flow.
      // iOS shows "Iniciar Sessão — Usar Chave-senha" sheet and then Face ID.
      // Passing specific credential IDs (with or without transports) causes iOS
      // to route to cross-device QR authentication instead of iCloud Keychain.
      options = await generateAuthenticationOptions({
        rpID: rpId,
        allowCredentials: [],
        userVerification: "required",
      }) as unknown as Record<string, unknown>;
    }

    // ── STORE CHALLENGE (purge expired first) ────────────────────────────────
    // Normalise challenge to base64url string regardless of library version
    const challengeStr = toBase64UrlString(options.challenge);

    await admin
      .from("webauthn_challenges")
      .delete()
      .lt("expires_at", new Date().toISOString());

    const { error: insertErr } = await admin.from("webauthn_challenges").insert({
      user_id: user.id,
      challenge: challengeStr,
      type,
    });

    if (insertErr) {
      log("error", "webauthn_challenge_insert_failed", {
        userId: user.id,
        type,
        error: insertErr.message,
        code: insertErr.code,
        details: insertErr.details,
        hint: insertErr.hint,
      });
      return new Response(
        JSON.stringify({ error: `Erro ao salvar desafio: ${insertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    log("info", "webauthn_challenge_generated", { type, userId: user.id, challengeStr });

    // Use replacer to convert any remaining Uint8Array fields to base64url strings
    return new Response(JSON.stringify(options, base64UrlReplacer), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("error", "webauthn_challenge_error", { error: String(err) });
    return new Response(
      JSON.stringify({ error: "Erro ao gerar desafio biométrico. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
