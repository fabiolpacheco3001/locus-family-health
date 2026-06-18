/**
 * webauthn.ts
 *
 * Browser-side WebAuthn helpers built on the native Credential Management API
 * (no external dependency needed — navigator.credentials is available in all
 * modern browsers and PWAs on iOS 16+ / Android Chrome).
 *
 * Flow:
 *   registerPasskey()      → enroll FaceID/TouchID/fingerprint for this device
 *   authenticatePasskey()  → verify identity with biometric (re-auth / app lock)
 *   browserSupportsWebAuthn() → feature-detect before showing the UI
 */

import { supabase } from "@/integrations/supabase/client";

// ── base64url helpers ────────────────────────────────────────────────────────

/**
 * Normalises a value that SHOULD be a base64url string but might arrive as:
 *   - string          (ideal — @simplewebauthn/server v8+)
 *   - {0:n,1:n,...}   (JSON-serialised Uint8Array — older library versions)
 * Throws a readable error so we see it in the toast rather than a cryptic
 * "c.replace is not a function".
 */
function toBase64UrlString(value: unknown, field: string): string {
  if (typeof value === "string") return value;
  // JSON-serialised Uint8Array: {0: 104, 1: 105, ...}
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, number>)
      .filter(([k]) => !isNaN(Number(k)))
      .sort(([a], [b]) => Number(a) - Number(b));
    if (entries.length > 0) {
      const bytes = new Uint8Array(entries.map(([, v]) => v));
      return arrayBufferToBase64Url(bytes.buffer);
    }
  }
  throw new Error(`Campo '${field}' retornou formato inesperado (${typeof value}). Tente novamente ou contate o suporte.`);
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return btoa(
    Array.from(new Uint8Array(buffer), (b) => String.fromCharCode(b)).join(""),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ── feature detection ────────────────────────────────────────────────────────

export function browserSupportsWebAuthn(): boolean {
  return (
    typeof window !== "undefined" &&
    "credentials" in navigator &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

// ── REGISTRATION ─────────────────────────────────────────────────────────────

/**
 * Enrolls a new passkey (FaceID / TouchID / fingerprint) for the current user.
 * Shows the OS biometric prompt; throws if the user cancels or the browser
 * does not support WebAuthn.
 *
 * @param deviceName  Human-readable label shown in the passkeys list
 *                    (defaults to "Dispositivo" on the server)
 */
export async function registerPasskey(deviceName?: string): Promise<void> {
  if (!browserSupportsWebAuthn()) {
    throw new Error("Biometria não é suportada neste navegador ou dispositivo.");
  }

  // 1. Fetch registration options from edge function
  const { data: options, error: optErr } = await supabase.functions.invoke(
    "webauthn-challenge",
    { body: { type: "registration" } },
  );
  if (optErr || options?.error) {
    throw new Error(optErr?.message ?? options?.error ?? "Erro ao iniciar cadastro.");
  }

  // 2. Convert base64url fields to ArrayBuffer (required by browser API)
  //    toBase64UrlString() handles both proper strings AND JSON-serialised
  //    Uint8Array objects returned by older @simplewebauthn/server versions.
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64UrlToArrayBuffer(
      toBase64UrlString(options.challenge, "challenge"),
    ),
    user: {
      ...options.user,
      id: base64UrlToArrayBuffer(
        toBase64UrlString((options.user as { id: unknown }).id, "user.id"),
      ),
    },
    excludeCredentials: (
      (options.excludeCredentials ?? []) as Array<{ id: unknown; type: string; transports?: string[] }>
    ).map((c) => ({
      id: base64UrlToArrayBuffer(toBase64UrlString(c.id, "excludeCredentials.id")),
      type: "public-key" as PublicKeyCredentialType, // must be literal "public-key" — browser rejects casts
      transports: c.transports as AuthenticatorTransport[],
    })),
  };

  // 3. Prompt biometric — shows FaceID / TouchID / fingerprint dialog
  let credential: PublicKeyCredential;
  try {
    credential = (await navigator.credentials.create({
      publicKey,
    })) as PublicKeyCredential;
  } catch (err: unknown) {
    // User cancelled or no authenticator available
    const domErr = err as DOMException;
    if (domErr?.name === "NotAllowedError") {
      throw new Error("Cadastro biométrico cancelado pelo usuário.");
    }
    throw new Error("Não foi possível usar a biometria. Verifique as configurações do dispositivo.");
  }
  if (!credential) throw new Error("Cadastro biométrico cancelado.");

  const attResponse = credential.response as AuthenticatorAttestationResponse;

  // 4. Serialize response (all ArrayBuffers → base64url strings)
  const serialized = {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: {},
    response: {
      clientDataJSON: arrayBufferToBase64Url(attResponse.clientDataJSON),
      attestationObject: arrayBufferToBase64Url(attResponse.attestationObject),
      transports: attResponse.getTransports?.() ?? [],
    },
  };

  // 5. Send to server for verification and storage
  const { data: result, error: verErr } = await supabase.functions.invoke(
    "webauthn-verify",
    { body: { type: "registration", response: serialized, deviceName } },
  );
  if (verErr) {
    // FunctionsHttpError carries the real server message — extract it
    const body = await (verErr as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? verErr.message ?? "Falha ao confirmar cadastro.");
  }
  if (result?.error) {
    throw new Error(result.error);
  }
}

// ── AUTHENTICATION ────────────────────────────────────────────────────────────

/**
 * Verifies the user's identity using a previously registered passkey.
 * Returns silently on success; throws on failure or cancellation.
 */
export async function authenticatePasskey(): Promise<void> {
  if (!browserSupportsWebAuthn()) {
    throw new Error("Biometria não é suportada neste navegador ou dispositivo.");
  }

  // 1. Fetch authentication options from edge function
  const { data: options, error: optErr } = await supabase.functions.invoke(
    "webauthn-challenge",
    { body: { type: "authentication" } },
  );
  if (optErr || options?.error) {
    throw new Error(optErr?.message ?? options?.error ?? "Erro ao iniciar verificação.");
  }

  // DIAGNOSTIC — remover após confirmar rpId correto
  // eslint-disable-next-line no-console
  console.log("[webauthn-auth] server options:", JSON.stringify({
    rpId: options.rpId,
    pageOrigin: window.location.origin,
    allowCredentials: options.allowCredentials,
  }));

  // 2. Convert base64url fields to ArrayBuffer
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64UrlToArrayBuffer(
      toBase64UrlString(options.challenge, "challenge"),
    ),
    allowCredentials: (
      (options.allowCredentials ?? []) as Array<{ id: unknown; type: string; transports?: string[] }>
    ).map((c) => ({
      id: base64UrlToArrayBuffer(toBase64UrlString(c.id, "allowCredentials.id")),
      type: "public-key" as PublicKeyCredentialType, // must be literal "public-key" — browser rejects casts
      transports: c.transports as AuthenticatorTransport[],
    })),
  };

  // 3. Prompt biometric
  let credential: PublicKeyCredential;
  try {
    credential = (await navigator.credentials.get({
      publicKey,
    })) as PublicKeyCredential;
  } catch (err: unknown) {
    const domErr = err as DOMException;
    if (domErr?.name === "NotAllowedError") {
      throw new Error("Verificação biométrica cancelada pelo usuário.");
    }
    // Include the actual DOMException name to help diagnose iOS/PWA issues
    const detail = domErr?.name ? `[${domErr.name}] ${domErr.message ?? ""}` : String(err);
    throw new Error(`Não foi possível verificar a biometria. ${detail}`);
  }
  if (!credential) throw new Error("Verificação biométrica cancelada.");

  const assertResponse = credential.response as AuthenticatorAssertionResponse;

  // 4. Serialize response
  const serialized = {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    clientExtensionResults: {},
    response: {
      clientDataJSON: arrayBufferToBase64Url(assertResponse.clientDataJSON),
      authenticatorData: arrayBufferToBase64Url(assertResponse.authenticatorData),
      signature: arrayBufferToBase64Url(assertResponse.signature),
      userHandle: assertResponse.userHandle
        ? arrayBufferToBase64Url(assertResponse.userHandle)
        : null,
    },
  };

  // 5. Verify on server
  const { data: result, error: verErr } = await supabase.functions.invoke(
    "webauthn-verify",
    { body: { type: "authentication", response: serialized } },
  );
  if (verErr) {
    const body = await (verErr as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? verErr.message ?? "Falha na verificação biométrica.");
  }
  if (result?.error) {
    throw new Error(result.error);
  }
}
