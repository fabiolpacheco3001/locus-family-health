import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";
import { checkAiRateLimit, logAiUsage } from "../_shared/rate-limit.ts";
import { log } from "../_shared/logger.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { allowed, count, limit } = await checkAiRateLimit(
      supabase,
      user.id,
      "analyze-surgery-instructions"
    );
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: `Limite de análises de IA atingido (${count}/${limit} por hora). Tente novamente mais tarde.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileUrl, phase = "pre" } = await req.json();
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "fileUrl é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pre", "post"].includes(phase)) {
      return new Response(
        JSON.stringify({ error: "phase deve ser 'pre' ou 'post'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SSRF protection — only Supabase Storage URLs
    const allowedHost = new URL(Deno.env.get("SUPABASE_URL")!).host;
    try {
      const parsedUrl = new URL(fileUrl);
      if (parsedUrl.host !== allowedHost || !parsedUrl.pathname.startsWith("/storage/")) {
        return new Response(
          JSON.stringify({ error: "Invalid fileUrl: must be a Supabase Storage URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid fileUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Não foi possível acessar o documento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    // chunked btoa para arquivos grandes
    const bytes = new Uint8Array(fileBuffer);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const base64File = btoa(binary);
    const contentType = fileResponse.headers.get("content-type") ?? "image/jpeg";

    const phaseLabel = phase === "pre" ? "pré-operatórias" : "pós-operatórias";
    const systemPrompt = `Você é um assistente de saúde que extrai e simplifica instruções médicas cirúrgicas ${phaseLabel}.

REGRAS OBRIGATÓRIAS:
1. Reescreva CADA instrução em linguagem simples, acessível a quem tem ensino fundamental. NUNCA use termos técnicos ou siglas médicas sem explicar. Exemplos: "NPO" → "Não comer nem beber NADA", "jejum hídrico" → "não beber nenhum líquido, nem água", "anticoagulante" → "remédio que afina o sangue".
2. Identifique itens com data/hora específica (ex: "jejum a partir das 22h", "tomar medicamento às 8h do dia da cirurgia") e extraia o horário no campo alarmAt.
3. Para itens críticos com horário (jejum, medicamentos, banho antisséptico), sugira ativar alarme (alarmEnabled: true).
4. Extraia TODOS os itens, mesmo que o texto seja parcialmente legível.
5. Retorne APENAS JSON válido, sem markdown.

Formato de retorno:
{
  "items": [
    {
      "text": "Descrição da instrução em linguagem simples",
      "completed": false,
      "alarmEnabled": true,
      "alarmAt": "2026-07-09T22:00:00",
      "createdByAi": true
    }
  ],
  "raw_text": "Texto bruto extraído do documento",
  "confidence": "high" | "medium" | "low"
}`;

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY não configurada");
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                {
                  inline_data: {
                    mime_type: contentType,
                    data: base64File,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      log("error", "gemini_api_error", { status: geminiResponse.status, error: errText });
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    await logAiUsage(supabase, user.id, "analyze-surgery-instructions");

    let parsed: { items: any[]; raw_text: string; confidence: string } = {
      items: [],
      raw_text: rawText,
      confidence: "low",
    };

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      log("warn", "analyze_surgery_json_parse_failed", { rawText: rawText.slice(0, 200) });
    }

    const itemsWithIds = (parsed.items ?? []).map((item: any, i: number) => ({
      id: `ai-${Date.now()}-${i}`,
      text: item.text ?? "",
      completed: false,
      alarmEnabled: item.alarmEnabled ?? false,
      alarmAt: item.alarmAt ?? null,
      createdByAi: true,
    }));

    return new Response(
      JSON.stringify({
        items: itemsWithIds,
        raw_text: parsed.raw_text ?? rawText,
        confidence: parsed.confidence ?? "low",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log("error", "analyze_surgery_unexpected_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response(
      JSON.stringify({ error: "Erro interno ao analisar documento" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
