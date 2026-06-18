/**
 * webauthn-verify
 *
 * Verifies a WebAuthn credential response coming from the browser:
 *   - "registration"   → verifies new passkey and persists to passkeys table
 *   - "authentication" → verifies biometric assertion and updates counter
 *
 * Consumes the challenge stored by webauthn-challenge (one-time use).
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import {
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@9.0.3";

// ── helpers: base64url ↔ Uint8Array (no external deps) ──────────────────────
function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b: number) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUint8Array(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new Uint8Array(Array.from(binary, (c: string) => c.charCodeAt(0)));
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { type, response, deviceName } = await req.json() as {
      type: "registration" | "authentication";
      response: Record<string, unknown>;
      deviceName?: string;
    };

    const appOrigin = Deno.env.get("APP_ORIGIN") ?? "http://localhost:5173";
    const rpId = new URL(appOrigin).hostname;

    log("info", "webauthn_verify_start", {
      userId: user.id,
      type,
      appOrigin,
      rpId,
      credentialId: (response as { id?: string }).id,
    });

    // ── FETCH & CONSUME CHALLENGE (one-time) ──────────────────────────────────
    const { data: challengeRow, error: challengeErr } = await admin
      .from("webauthn_challenges")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", type)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .single();

    if (challengeErr || !challengeRow) {
      log("warn", "webauthn_challenge_not_found", {
        userId: user.id,
        type,
        dbError: challengeErr?.message ?? "no_row",
      });
      return new Response(
        JSON.stringify({ error: "Sessão de verificação expirada. Tente cadastrar novamente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    log("info", "webauthn_challenge_found", {
      challengeId: challengeRow.id,
      storedChallenge: challengeRow.challenge,
    });

    // Delete immediately — challenges are single-use
    await admin.from("webauthn_challenges").delete().eq("id", challengeRow.id);

    // ── REGISTRATION VERIFICATION ─────────────────────────────────────────────
    if (type === "registration") {
      let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
      try {
        verification = await verifyRegistrationResponse({
          response: response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
          expectedChallenge: challengeRow.challenge,
          expectedOrigin: appOrigin,
          expectedRPID: rpId,
          requireUserVerification: true,
        });
      } catch (verifyErr) {
        log("error", "webauthn_verify_threw", {
          userId: user.id,
          error: String(verifyErr),
          expectedOrigin: appOrigin,
          expectedRPID: rpId,
          storedChallenge: challengeRow.challenge,
        });
        return new Response(
          JSON.stringify({ error: `Falha técnica na verificação: ${String(verifyErr)}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      log("info", "webauthn_verify_result", {
        userId: user.id,
        verified: verification.verified,
        hasInfo: !!verification.registrationInfo,
      });

      if (!verification.verified || !verification.registrationInfo) {
        log("warn", "webauthn_registration_failed", {
          userId: user.id,
          verified: verification.verified,
          expectedOrigin: appOrigin,
          rpId,
        });
        return new Response(
          JSON.stringify({ error: "Verificação biométrica falhou. Tente novamente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { credentialPublicKey, counter, credentialDeviceType } =
        verification.registrationInfo;

      const resolvedName =
        deviceName ??
        (credentialDeviceType === "multiDevice" ? "Passkey sincronizada" : "Dispositivo");

      // Use response.id (base64url string sent by the browser) as credential_id.
      // Do NOT use registrationInfo.credentialID: in @simplewebauthn/server@9 the
      // returned Uint8Array may serialize as an empty Buffer-like object in Deno,
      // causing uint8ArrayToBase64Url() to return "" and breaking all lookups.
      const credentialId = (response as { id: string }).id;
      const publicKeyB64 = uint8ArrayToBase64Url(credentialPublicKey as unknown as Uint8Array);

      log("info", "webauthn_inserting_passkey", {
        userId: user.id,
        credentialId,
        publicKeyLength: publicKeyB64.length, // se 0 → mesmo bug do credentialID
      });

      await admin.from("passkeys").insert({
        user_id: user.id,
        credential_id: credentialId,
        public_key: publicKeyB64,
        counter,
        device_name: resolvedName,
        transports: (response as { response?: { transports?: string[] } }).response?.transports ?? [],
        aaguid: verification.registrationInfo.aaguid,
      });

      log("info", "webauthn_registered", { userId: user.id, deviceName: resolvedName });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── AUTHENTICATION VERIFICATION ───────────────────────────────────────────
    } else {
      const credentialId = (response as { id: string }).id;

      const { data: passkey, error: pkErr } = await admin
        .from("passkeys")
        .select("*")
        .eq("credential_id", credentialId)
        .eq("user_id", user.id)
        .single();

      if (pkErr || !passkey) {
        return new Response(
          JSON.stringify({ error: "Credencial não encontrada para este usuário." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const verification = await verifyAuthenticationResponse({
        response: response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: appOrigin,
        expectedRPID: rpId,
        authenticator: {
          credentialID: base64UrlToUint8Array(passkey.credential_id),
          credentialPublicKey: base64UrlToUint8Array(passkey.public_key),
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: true,
      });

      if (!verification.verified) {
        log("warn", "webauthn_authentication_failed", { userId: user.id });
        return new Response(
          JSON.stringify({ error: "Verificação biométrica falhou." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Update counter and last_used_at to prevent replay attacks
      await admin
        .from("passkeys")
        .update({
          counter: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", passkey.id);

      log("info", "webauthn_authenticated", { userId: user.id });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    log("error", "webauthn_verify_error", { error: String(err) });
    return new Response(
      JSON.stringify({ error: "Erro ao verificar biometria. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
