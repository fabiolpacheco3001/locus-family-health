import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl } = await req.json();
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "fileUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um assistente médico especializado em leitura de Receitas Médicas. Analise o documento anexado (foto ou PDF de uma receita médica) e extraia as informações do medicamento prescrito.

Retorne os dados estruturados usando a função fornecida. Se não conseguir identificar algum campo, use null.

Para o campo "frequencia_horas", mapeie da seguinte forma:
- "1x ao dia" ou "a cada 24 horas" → 24
- "De 12 em 12 horas" ou "2x ao dia" → 12
- "De 8 em 8 horas" ou "3x ao dia" → 8
- "De 6 em 6 horas" ou "4x ao dia" → 6

Para "duracao_dias", extraia o número de dias do tratamento (ex: "por 7 dias" → 7).`;

    const isPdf = fileUrl.toLowerCase().includes(".pdf");

    const userContent: any[] = [
      {
        type: "text",
        text: "Extraia os dados desta receita médica.",
      },
    ];

    if (isPdf) {
      userContent.push({
        type: "file",
        file: { url: fileUrl },
      });
    } else {
      userContent.push({
        type: "image_url",
        image_url: { url: fileUrl },
      });
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_prescription_data",
                description:
                  "Extract structured prescription data from a medical prescription document.",
                parameters: {
                  type: "object",
                  properties: {
                    nome_medicamento: {
                      type: "string",
                      description: "Name of the medication (e.g. Amoxicilina)",
                    },
                    dosagem: {
                      type: "string",
                      description: "Dosage (e.g. 500mg, 5ml)",
                    },
                    frequencia_horas: {
                      type: "number",
                      description: "Frequency in hours (6, 8, 12, or 24)",
                    },
                    duracao_dias: {
                      type: "number",
                      description: "Duration in days (e.g. 7)",
                    },
                    medico_prescritor: {
                      type: "string",
                      description: "Prescribing doctor name",
                    },
                  },
                  required: [
                    "nome_medicamento",
                    "dosagem",
                    "frequencia_horas",
                    "duracao_dias",
                    "medico_prescritor",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_prescription_data" },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

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
        JSON.stringify({ error: "Erro ao analisar a receita com IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

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
      JSON.stringify({ error: "Não foi possível extrair dados da receita." }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-prescription error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
