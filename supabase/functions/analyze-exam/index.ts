import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
// A1: CORS restrito ao APP_ORIGIN
import { corsHeaders } from "../_shared/cors.ts";
// A4: Rate limiting de chamadas de IA
import { checkAiRateLimit, logAiUsage } from "../_shared/rate-limit.ts";
import { log } from "../_shared/logger.ts";

const bytesToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AUTH CHECK (#5) ──
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
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── A4: RATE LIMITING — máx AI_CALLS_PER_HOUR chamadas/hora por usuário ──
    const { allowed, count, limit } = await checkAiRateLimit(supabase, user.id, "analyze-exam");
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: `Limite de análises de IA atingido (${count}/${limit} por hora). Tente novamente mais tarde.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileUrl } = await req.json();
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "fileUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SSRF PROTECTION (#7) — only allow Supabase Storage URLs ──
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const allowedHost = new URL(SUPABASE_URL).host;
    try {
      const parsedUrl = new URL(fileUrl);
      if (parsedUrl.host !== allowedHost || !parsedUrl.pathname.startsWith("/storage/")) {
        return new Response(JSON.stringify({ error: "Invalid fileUrl: must be a Supabase Storage URL" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid fileUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // M17: modelo e gateway como env vars — nunca hardcoded
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") ?? "https://ai.gateway.lovable.dev/v1/chat/completions";
    const AI_MODEL        = Deno.env.get("AI_MODEL")       ?? "google/gemini-2.5-flash";

    const systemPrompt = `Você é um assistente de extração de dados laboratoriais e de imagem.

REGRA CRÍTICA DE PRIVACIDADE: Ignore, censure e descarte completamente qualquer dado pessoal do paciente (Nome, CPF, Endereço, Data de Nascimento) e dados do médico (Nome, CRM). NÃO inclua nenhuma dessas informações na sua resposta.

Extraia ÚNICA e EXCLUSIVAMENTE:
- "examName": nome do exame (ex: Hemograma Completo)
- "location": laboratório ou local (ex: Laboratório Santa Luzia)
- "examDate": data da realização no formato ISO YYYY-MM-DDTHH:mm:ss (infira a hora se houver, ou use T12:00:00 se não houver)

Se não conseguir identificar algum campo, use null. Retorne SOMENTE o JSON, sem markdown, sem explicações.`;

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      log("error", "file_download_failed", { status: fileResponse.status });
      return new Response(JSON.stringify({ error: "Não foi possível baixar o arquivo." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBytes = new Uint8Array(await fileResponse.arrayBuffer());
    const base64 = bytesToBase64(fileBytes);
    const lowerUrl = fileUrl.toLowerCase();
    const isPdf = lowerUrl.includes(".pdf");
    const mimeType = isPdf
      ? "application/pdf"
      : lowerUrl.includes(".png")
        ? "image/png"
        : lowerUrl.includes(".webp")
          ? "image/webp"
          : "image/jpeg";

    const userContent: any[] = [
      {
        type: "text",
        text: "Extraia os dados deste documento de exame médico.",
      },
      isPdf
        ? {
            type: "file",
            file: {
              filename: "exam-document.pdf",
              file_data: `data:${mimeType};base64,${base64}`,
            },
          }
        : {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
    ];

    const response = await fetch(
      AI_GATEWAY_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_exam_data",
                description:
                  "Extract structured exam data from a medical document image.",
                parameters: {
                  type: "object",
                  properties: {
                    examName: {
                      type: "string",
                      description: "Name of the exam",
                    },
                    location: {
                      type: "string",
                      description: "Laboratory or location name",
                    },
                    examDate: {
                      type: "string",
                      description:
                        "Exam date in ISO format YYYY-MM-DDTHH:mm:ss",
                    },
                  },
                  required: ["examName", "location", "examDate"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_exam_data" },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      log("error", "ai_gateway_error", { status: response.status, body: errorText });

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para análise de IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao analisar o documento com IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // A4: Registrar uso de IA (non-blocking)
    await logAiUsage(supabase, user.id, "analyze-exam");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const extracted = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(extracted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(extracted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Não foi possível extrair dados do documento." }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    log("error", "analyze_exam_unexpected_error", { error: e instanceof Error ? e.message : String(e) });
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente mais tarde." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
