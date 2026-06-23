import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { log } from "../_shared/logger.ts";

// ── Config ──────────────────────────────────────────────────────────────────
const DEVIN_API_KEY = Deno.env.get("DEVIN_API_KEY") ?? "";
const DEVIN_ORG_ID = Deno.env.get("DEVIN_ORG_ID") ?? "";

const DEVIN_BASE = "https://api.devin.ai/v3";

// ── CORS ─────────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, accept, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
};
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

// ── Helpers ───────────────────────────────────────────────────────────────────
function jsonRpcResponse(id: string | number | null, result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: JSON_HEADERS,
  });
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  status = 200,
) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }),
    { status, headers: JSON_HEADERS },
  );
}

async function devinFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${DEVIN_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${DEVIN_API_KEY}`,
      "Content-Type": "application/json",
    },
    ...options,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const data = json as Record<string, unknown>;
    const msg =
      (data?.detail as string) ||
      (data?.message as string) ||
      JSON.stringify(json);
    throw new Error(`Devin API ${res.status}: ${msg}`);
  }
  return json;
}

// ── Tools definition ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "devin_create_session",
    description:
      "Cria uma nova sessão no Devin AI com um prompt de tarefa. Retorna o ID e a URL para acompanhar. Use para delegar tarefas de código ao Devin de forma autônoma.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Descrição detalhada da tarefa para o Devin executar.",
        },
        playbook_id: {
          type: "string",
          description: "(Opcional) ID de um playbook Devin.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "devin_get_session",
    description:
      "Verifica o status de uma sessão Devin (running/exit/error/suspended).",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "ID da sessão Devin (ex: devin-abc123)",
        },
      },
      required: ["session_id"],
    },
  },
  {
    name: "devin_send_message",
    description:
      "Envia uma instrução adicional para uma sessão Devin em andamento.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "ID da sessão Devin" },
        message: { type: "string", description: "Mensagem a enviar" },
      },
      required: ["session_id", "message"],
    },
  },
  {
    name: "devin_list_sessions",
    description: "Lista as sessões Devin mais recentes da organização.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número de sessões a retornar (padrão: 10)",
          default: 10,
        },
      },
      required: [],
    },
  },
  {
    name: "devin_get_messages",
    description: "Obtém o histórico de mensagens de uma sessão Devin.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "ID da sessão Devin" },
      },
      required: ["session_id"],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────
async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  switch (name) {
    case "devin_create_session": {
      const body: Record<string, unknown> = { prompt: args.prompt };
      if (args.playbook_id) body.playbook_id = args.playbook_id;
      const data = (await devinFetch(
        `/organizations/${DEVIN_ORG_ID}/sessions`,
        { method: "POST", body: JSON.stringify(body) },
      )) as Record<string, unknown>;
      return {
        content: [
          {
            type: "text",
            text: `✅ Sessão Devin criada!\n\n• ID: ${data.session_id}\n• Status: ${data.status}\n• URL: ${data.url}\n\nAcompanhe em: ${data.url}`,
          },
        ],
      };
    }
    case "devin_get_session": {
      const data = (await devinFetch(
        `/organizations/${DEVIN_ORG_ID}/sessions/${args.session_id}`,
      )) as Record<string, unknown>;
      const statusEmoji: Record<string, string> = {
        running: "🔄",
        exit: "✅",
        error: "❌",
        suspended: "⏸️",
      };
      const emoji = statusEmoji[data.status as string] ?? "❓";
      return {
        content: [
          {
            type: "text",
            text: `${emoji} Sessão ${args.session_id}\n\n• Status: ${data.status}\n${data.title ? `• Título: ${data.title}\n` : ""}• URL: ${data.url}`,
          },
        ],
      };
    }
    case "devin_send_message": {
      await devinFetch(
        `/organizations/${DEVIN_ORG_ID}/sessions/${args.session_id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ message: args.message }),
        },
      );
      return {
        content: [
          {
            type: "text",
            text: `✅ Mensagem enviada para sessão ${args.session_id}.`,
          },
        ],
      };
    }
    case "devin_list_sessions": {
      const limit = (args.limit as number) ?? 10;
      const data = (await devinFetch(
        `/organizations/${DEVIN_ORG_ID}/sessions?limit=${limit}`,
      )) as Record<string, unknown>;
      const sessions = (data.items ??
        data.sessions ??
        []) as Array<Record<string, unknown>>;
      if (sessions.length === 0)
        return {
          content: [{ type: "text", text: "Nenhuma sessão encontrada." }],
        };
      const statusEmoji: Record<string, string> = {
        running: "🔄",
        exit: "✅",
        error: "❌",
        suspended: "⏸️",
      };
      const lines = sessions.map(
        (s) =>
          `${statusEmoji[s.status as string] ?? "❓"} ${s.session_id} — ${s.status}${s.title ? ` — "${s.title}"` : ""}\n   ${s.url}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Sessões (${sessions.length}):\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
    case "devin_get_messages": {
      const data = (await devinFetch(
        `/organizations/${DEVIN_ORG_ID}/sessions/${args.session_id}/messages`,
      )) as Record<string, unknown>;
      const messages = (data.items ??
        data.messages ??
        []) as Array<Record<string, unknown>>;
      if (messages.length === 0)
        return {
          content: [
            {
              type: "text",
              text: `Nenhuma mensagem na sessão ${args.session_id}.`,
            },
          ],
        };
      const lines = messages.map((m) => {
        const role = m.role === "user" ? "👤 Você" : "🤖 Devin";
        const content =
          typeof m.content === "string"
            ? m.content
            : JSON.stringify(m.content, null, 2);
        return `${role}:\n${content}`;
      });
      return {
        content: [
          {
            type: "text",
            text: `Mensagens (${messages.length}):\n\n${lines.join("\n\n---\n\n")}`,
          },
        ],
      };
    }
    default:
      throw new Error(`Tool desconhecida: ${name}`);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }


  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const rpc = body as {
    jsonrpc: string;
    id?: string | number | null;
    method: string;
    params?: unknown;
  };

  // MCP notifications (no id) → 202 sem body
  if (rpc.id === undefined || rpc.id === null) {
    log("info", "mcp_notification", { method: rpc.method });
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  const id = rpc.id;

  try {
    switch (rpc.method) {
      case "initialize":
        return jsonRpcResponse(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "devin-mcp", version: "1.0.0" },
        });

      case "ping":
        return jsonRpcResponse(id, {});

      case "tools/list":
        return jsonRpcResponse(id, { tools: TOOLS });

      case "tools/call": {
        const params = rpc.params as {
          name: string;
          arguments?: Record<string, unknown>;
        };
        log("info", "devin_tool_call", { tool: params.name });
        const result = await callTool(params.name, params.arguments ?? {});
        return jsonRpcResponse(id, result);
      }

      default:
        return jsonRpcError(id, -32601, `Method not found: ${rpc.method}`);
    }
  } catch (err) {
    log("error", "devin_tool_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonRpcError(id, -32603, "Erro interno. Tente novamente.");
  }
});
