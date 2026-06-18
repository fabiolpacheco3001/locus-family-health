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

import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
} from "@simplewebauthn/server";

// Types inferred from @simplewebauthn/server@9
type AuthenticatorTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

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

      options = await generateAuthenticationOptions({
        rpID: rpId,
        allowCredentials: passkeys.map((p: { credential_id: string; transports: string[] | null }) => ({
          id: p.credential_id,
          transports: (p.transports ?? []) as AuthenticatorTransport[],
        })),
        userVerification: "required",
      }) as unknown as Record<string, unknown>;
    }

    // ── STORE CHALLENGE (purge expired first) ────────────────────────────────
    await admin
      .from("webauthn_challenges")
      .delete()
      .lt("expires_at", new Date().toISOString());

    await admin.from("webauthn_challenges").insert({
      user_id: user.id,
      challenge: options.challenge,
      type,
    });

    log("info", "webauthn_challenge_generated", { type, userId: user.id });

    return new Response(JSON.stringify(options), {
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
