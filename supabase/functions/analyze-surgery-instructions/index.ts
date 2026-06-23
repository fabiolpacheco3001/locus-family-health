/**
 * analyze-surgery-instructions — Edge Function para OCR de instruções cirúrgicas.
 *
 * Recebe imageUrl (Supabase Storage) + phase ('pre'|'post').
 * Processa via Gemini com prompt de simplificação de linguagem médica.
 * Retorna InstructionItem[] estruturado.
 *
 * Template: analyze-prescription/index.ts
 */
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
    // ── AUTH ──
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

    // ── RATE LIMIT ──
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
      return new Response(JSON.stringify({ error: "phase deve ser 'pre' ou 'post'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SSRF PROTECTION — apenas Supabase Storage ──
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

    // ── PROMPT ──
    const phaseLabel = phase === "pre" ? "pré-operatórias" : "pós-operatórias";
    const systemPrompt = `Você é um assistente de saúde que extrai e simplifica instruções médicas cirúrgicas ${phaseLabel}.

REGRAS OBRIGATÓRIAS:
1. Reescreva CADA instrução em linguagem simples, acessível a quem tem ensino fundamental. NUNCA use termos técnicos ou siglas médicas sem explicar. Exemplos: "NPO" → "Não comer nem beber NADA", "jejum hídrico" → "não beber nenhum líquido, nem água", "anticoagulante" → "remédio que afina o sangue", "deambulação precoce" → "andar o mais cedo possível após a cirurgia".
2. Extraia TODOS os itens, mesmo que o texto seja parcialmente legível.
3. Retorne APENAS JSON válido, sem markdown ou blocos de código.

Formato de retorno JSON:
{
  "items": [
    {
      "text": "Descrição simplificada da instrução",
      "completed": false,
      "createdByAi": true
    }
  ],
  "raw_text": "Texto bruto extraído do documento",
  "confidence": "high"
}

O campo "confidence" deve ser "high" (texto legível, instruções claras), "medium" (texto parcialmente legível) ou "low" (texto ilegível ou sem instruções identificáveis).`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL") ?? "https://ai.gateway.lovable.dev/v1/chat/completions";
    const AI_MODEL = Deno.env.get("AI_MODEL") ?? "google/gemini-2.5-flash";

    const isPdf = fileUrl.toLowerCase().includes(".pdf");
    const userContent: unknown[] = [
      { type: "text", text: `Extraia e simplifique TODAS as instruções ${phase === "pre" ? "pré-operatórias" : "pós-operatórias"} deste documento.` },
    ];
    if (isPdf) {
      userContent.push({ type: "file", file: { url: fileUrl } });
    } else {
      userContent.push({ type: "image_url", image_url: { url: fileUrl } });
    }

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      log("error", "ai_gateway_error", { status: aiResponse.status, error: errText.slice(0, 200) });
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawText: string = aiData?.choices?.[0]?.message?.content ?? "";

    await logAiUsage(supabase, user.id, "analyze-surgery-instructions");

    // ── PARSE JSON ──
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

    const now = Date.now();
    const itemsWithIds = (parsed.items ?? []).map((item: any, i: number) => ({
      id: `ai-${now}-${i}`,
      text: String(item.text ?? ""),
      completed: false,
      createdByAi: true,
    }));

    log("info", "analyze_surgery_success", {
      user_id: user.id,
      phase,
      items_count: itemsWithIds.length,
      confidence: parsed.confidence,
    });

    return new Response(
      JSON.stringify({
        items: itemsWithIds,
        raw_text: parsed.raw_text ?? rawText,
        confidence: parsed.confidence ?? "low",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log("error", "analyze_surgery_unexpected_error", { error: String(err) });
    return new Response(
      JSON.stringify({ error: "Erro interno ao analisar documento" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
