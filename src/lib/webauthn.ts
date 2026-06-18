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
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64UrlToArrayBuffer(options.challenge as string),
    user: {
      ...options.user,
      id: base64UrlToArrayBuffer(options.user.id as string),
    },
    excludeCredentials: (
      (options.excludeCredentials ?? []) as Array<{ id: string; type: string; transports?: string[] }>
    ).map((c) => ({
      id: base64UrlToArrayBuffer(c.id),
      type: c.type as PublicKeyCredentialType,
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
  if (verErr || result?.error) {
    throw new Error(verErr?.message ?? result?.error ?? "Falha ao confirmar cadastro.");
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

  // 2. Convert base64url fields to ArrayBuffer
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64UrlToArrayBuffer(options.challenge as string),
    allowCredentials: (
      (options.allowCredentials ?? []) as Array<{ id: string; type: string; transports?: string[] }>
    ).map((c) => ({
      id: base64UrlToArrayBuffer(c.id),
      type: c.type as PublicKeyCredentialType,
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
    throw new Error("Não foi possível verificar a biometria. Tente novamente.");
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
  if (verErr || result?.error) {
    throw new Error(verErr?.message ?? result?.error ?? "Falha na verificação biométrica.");
  }
}
