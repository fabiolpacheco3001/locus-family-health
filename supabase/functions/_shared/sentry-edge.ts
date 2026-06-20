/**
 * Integração Sentry via HTTP Store API para Edge Functions Deno.
 * Não usa SDK — compatível com qualquer versão do Deno/Supabase.
 *
 * Requer secret SENTRY_DSN no Supabase (mesmo DSN do frontend).
 * Se não configurado, todas as funções são no-op (fail-safe).
 *
 * SETUP: adicionar SENTRY_DSN nos Secrets do Supabase Dashboard
 * (mesmo valor de VITE_SENTRY_DSN do frontend — o DSN é público)
 * Dashboard → Settings → Edge Functions → Secrets → Add secret
 */

function parseDsn(dsn: string) {
  try {
    const url = new URL(dsn);
    const key = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    const host = url.hostname;
    const protocol = url.protocol;
    const port = url.port ? `:${url.port}` : "";
    return { key, projectId, endpoint: `${protocol}//${host}${port}/api/${projectId}/store/` };
  } catch {
    return null;
  }
}

export async function captureEdgeException(
  error: unknown,
  context?: {
    requestId?: string;
    functionName?: string;
    [key: string]: unknown;
  },
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return; // fail-safe: sem DSN, sem captura

  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const errorObj = error instanceof Error ? error : new Error(String(error));

  try {
    await fetch(parsed.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": [
          "Sentry sentry_version=7",
          `sentry_key=${parsed.key}`,
          "sentry_client=locus-edge/1.0",
        ].join(", "),
      },
      body: JSON.stringify({
        event_id: crypto.randomUUID().replace(/-/g, ""),
        timestamp: new Date().toISOString(),
        level: "error",
        platform: "javascript",
        environment: Deno.env.get("ENVIRONMENT") ?? "production",
        server_name: "supabase-edge",
        tags: {
          runtime: "deno-edge",
          function: context?.functionName ?? "unknown",
          ...(context?.requestId ? { request_id: context.requestId } : {}),
        },
        exception: {
          values: [
            {
              type: errorObj.constructor?.name ?? "Error",
              value: errorObj.message,
            },
          ],
        },
        extra: context,
      }),
    });
  } catch {
    // Nunca deixar o Sentry quebrar a Edge Function
  }
}
