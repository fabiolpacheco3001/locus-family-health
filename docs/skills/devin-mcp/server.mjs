#!/usr/bin/env node
/**
 * Devin AI MCP Server
 * Expõe a API Devin v3 como ferramentas MCP para uso no Cowork/Claude Code.
 *
 * Variáveis de ambiente obrigatórias:
 *   DEVIN_API_KEY  — chave do service user (começa com cog_)
 *   DEVIN_ORG_ID   — ID da organização (Settings > Service Users no app Devin)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY = process.env.DEVIN_API_KEY;
const ORG_ID = process.env.DEVIN_ORG_ID;
const BASE = "https://api.devin.ai/v3";

if (!API_KEY || !ORG_ID) {
  process.stderr.write(
    "[devin-mcp] ERRO: DEVIN_API_KEY e DEVIN_ORG_ID são obrigatórios.\n"
  );
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function devinFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: HEADERS,
    ...options,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.detail || json?.message || JSON.stringify(json);
    throw new Error(`Devin API ${res.status}: ${msg}`);
  }

  return json;
}

function ok(text) {
  return { content: [{ type: "text", text }] };
}

function err(e) {
  return {
    content: [{ type: "text", text: `Erro: ${e.message}` }],
    isError: true,
  };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "devin_create_session",
    description:
      "Cria uma nova sessão no Devin AI com um prompt de tarefa. Retorna o ID da sessão e a URL para acompanhar no browser. Use para delegar tarefas de código ao Devin — ele vai trabalhar de forma autônoma no repositório.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Descrição detalhada da tarefa para o Devin executar. Seja específico: repositório, arquivos, comportamento esperado.",
        },
        playbook_id: {
          type: "string",
          description:
            "(Opcional) ID de um playbook do Devin para guiar a execução.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "devin_get_session",
    description:
      "Verifica o status de uma sessão Devin em andamento. Retorna: status (running/exit/error/suspended), URL da sessão e título.",
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
      "Envia uma mensagem para uma sessão Devin em andamento. Use para dar instruções adicionais, corrigir rumo ou responder perguntas que o Devin fez.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "ID da sessão Devin",
        },
        message: {
          type: "string",
          description: "Mensagem a enviar para o Devin",
        },
      },
      required: ["session_id", "message"],
    },
  },
  {
    name: "devin_list_sessions",
    description:
      "Lista as sessões Devin mais recentes da organização. Útil para verificar sessões em andamento ou encontrar um session_id.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de sessões a retornar (padrão: 10)",
          default: 10,
        },
      },
      required: [],
    },
  },
  {
    name: "devin_get_messages",
    description:
      "Obtém o histórico de mensagens de uma sessão Devin. Útil para ver o que o Devin está fazendo, erros encontrados ou resultados entregues.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "ID da sessão Devin",
        },
      },
      required: ["session_id"],
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleCreateSession({ prompt, playbook_id }) {
  const body = { prompt };
  if (playbook_id) body.playbook_id = playbook_id;

  const data = await devinFetch(`/organizations/${ORG_ID}/sessions`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return ok(
    `✅ Sessão Devin criada!\n\n` +
      `• ID: ${data.session_id}\n` +
      `• Status: ${data.status}\n` +
      `• URL: ${data.url}\n\n` +
      `Acompanhe o progresso em: ${data.url}`
  );
}

async function handleGetSession({ session_id }) {
  const data = await devinFetch(
    `/organizations/${ORG_ID}/sessions/${session_id}`
  );

  const statusEmoji = {
    running: "🔄",
    exit: "✅",
    error: "❌",
    suspended: "⏸️",
  };
  const emoji = statusEmoji[data.status] || "❓";

  return ok(
    `${emoji} Sessão ${session_id}\n\n` +
      `• Status: ${data.status}\n` +
      (data.title ? `• Título: ${data.title}\n` : "") +
      `• URL: ${data.url}\n` +
      (data.status_enum ? `• Detalhe: ${data.status_enum}\n` : "")
  );
}

async function handleSendMessage({ session_id, message }) {
  await devinFetch(
    `/organizations/${ORG_ID}/sessions/${session_id}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    }
  );

  return ok(`✅ Mensagem enviada para sessão ${session_id}:\n"${message}"`);
}

async function handleListSessions({ limit = 10 }) {
  const data = await devinFetch(
    `/organizations/${ORG_ID}/sessions?limit=${limit}`
  );

  const sessions = data.items ?? data.sessions ?? [];

  if (sessions.length === 0) {
    return ok("Nenhuma sessão encontrada.");
  }

  const statusEmoji = {
    running: "🔄",
    exit: "✅",
    error: "❌",
    suspended: "⏸️",
  };

  const lines = sessions.map((s) => {
    const emoji = statusEmoji[s.status] || "❓";
    return `${emoji} ${s.session_id} — ${s.status}${s.title ? ` — "${s.title}"` : ""}\n   ${s.url}`;
  });

  return ok(`Sessões Devin (${sessions.length}):\n\n${lines.join("\n\n")}`);
}

async function handleGetMessages({ session_id }) {
  const data = await devinFetch(
    `/organizations/${ORG_ID}/sessions/${session_id}/messages`
  );

  const messages = data.items ?? data.messages ?? [];

  if (messages.length === 0) {
    return ok(`Nenhuma mensagem na sessão ${session_id}.`);
  }

  const lines = messages.map((m) => {
    const role = m.role === "user" ? "👤 Você" : "🤖 Devin";
    const content =
      typeof m.content === "string"
        ? m.content
        : JSON.stringify(m.content, null, 2);
    return `${role}:\n${content}`;
  });

  return ok(
    `Mensagens da sessão ${session_id} (${messages.length}):\n\n${lines.join("\n\n---\n\n")}`
  );
}

// ─── MCP Server setup ─────────────────────────────────────────────────────────

const server = new Server(
  { name: "devin-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "devin_create_session":
        return await handleCreateSession(args);
      case "devin_get_session":
        return await handleGetSession(args);
      case "devin_send_message":
        return await handleSendMessage(args);
      case "devin_list_sessions":
        return await handleListSessions(args);
      case "devin_get_messages":
        return await handleGetMessages(args);
      default:
        return err(new Error(`Tool desconhecida: ${name}`));
    }
  } catch (e) {
    return err(e);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("[devin-mcp] Servidor iniciado ✅\n");
