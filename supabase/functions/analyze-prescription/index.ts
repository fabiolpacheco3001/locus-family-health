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

    const systemPrompt = `Você é um assistente farmacêutico de extração de dados de receitas médicas.

REGRA CRÍTICA DE PRIVACIDADE (LGPD): Ignore, censure e descarte completamente qualquer dado pessoal presente na imagem. NÃO extraia nem retorne: nome do paciente, CPF, RG, endereço, telefone, CRM do médico, nome da clínica ou qualquer informação identificável. Extraia ÚNICA e EXCLUSIVAMENTE os dados técnicos farmacológicos.

Sua missão é ler a imagem anexada e extrair TODOS os medicamentos listados na receita, retornando os dados usando a função fornecida.

Para o campo "frequencia", use o formato padrão descritivo:
- "1x ao dia" ou "a cada 24 horas" → "De 24 em 24 horas"
- "De 12 em 12 horas" ou "2x ao dia" → "De 12 em 12 horas"
- "De 8 em 8 horas" ou "3x ao dia" → "De 8 em 8 horas"
- "De 6 em 6 horas" ou "4x ao dia" → "De 6 em 6 horas"

Para "duracao_dias", extraia o número de dias do tratamento (ex: "por 7 dias" → 7). Se for uso contínuo, retorne null.

Para "medico_prescritor", extraia APENAS o primeiro nome do médico (sem sobrenome completo, sem CRM). Ex: "Dr. Carlos". Este campo é global (não por medicamento).

Se não conseguir identificar algum campo, use null.`;

    const isPdf = fileUrl.toLowerCase().includes(".pdf");

    const userContent: any[] = [
      {
        type: "text",
        text: "Extraia TODOS os medicamentos desta receita médica.",
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
                  "Extract structured prescription data with ALL medications found in a medical prescription document.",
                parameters: {
                  type: "object",
                  properties: {
                    medico_prescritor: {
                      type: "string",
                      description: "Prescribing doctor name (from stamp or signature)",
                    },
                    medicamentos: {
                      type: "array",
                      description: "List of all medications found in the prescription",
                      items: {
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
                          frequencia: {
                            type: "string",
                            description: "Frequency in descriptive format (e.g. 'De 8 em 8 horas')",
                          },
                          duracao_dias: {
                            type: "number",
                            description: "Duration in days (e.g. 7), or null if continuous use",
                          },
                        },
                        required: ["nome_medicamento"],
                      },
                    },
                  },
                  required: ["medicamentos"],
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
