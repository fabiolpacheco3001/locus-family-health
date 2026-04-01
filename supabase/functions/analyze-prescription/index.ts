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
    const { fileUrl, patientAge } = await req.json();
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "fileUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPediatric = typeof patientAge === "number" && patientAge < 12;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const pediatricBlock = isPediatric
      ? `\n\nCONTEXTO PEDIÁTRICO (PACIENTE COM ${patientAge} ANOS):
Este paciente é uma CRIANÇA. Você DEVE:
1. Priorizar formas farmacêuticas pediátricas: Xarope, Gotas, Suspensão Oral.
2. Desconfiar de dosagens adultas (ex: 500mg comprimido para criança de 7 anos).
3. NÃO sugerir medicamentos contraindicados para pediatria (ex: Nimesulida < 12 anos, relaxantes musculares fortes como Dorflex/Tandrilax).
4. Se não conseguir identificar o medicamento com segurança, retorne nome_medicamento como null e confianca como "baixa". NÃO tente adivinhar — o sistema possui revisão humana obrigatória.`
      : "";

    const systemPrompt = `Você é um farmacêutico brasileiro sênior com 20 anos de experiência em dispensação hospitalar e comunitária, especialista em decifrar caligrafia médica manuscrita.

REGRA CRÍTICA DE SEGURANÇA (BLINDAGEM ANTI-ALUCINAÇÃO):
É TERMINANTEMENTE PROIBIDO sugerir, deduzir ou retornar nomes de substâncias que NÃO sejam medicamentos de uso humano aprovados pela ANVISA. Você NUNCA deve retornar nomes de: inseticidas (ex: K-Othrine, Baygon, SBP), venenos, raticidas, produtos de limpeza, cosméticos não-medicamentosos, agroquímicos ou substâncias químicas industriais. Se NENHUM medicamento real se encaixar com segurança, retorne nome_medicamento como null e confianca como "baixa".

REGRA CRÍTICA DE PRIVACIDADE (LGPD): Ignore e descarte completamente qualquer dado pessoal presente na imagem. NÃO extraia nem retorne: nome do paciente, CPF, RG, endereço, telefone, CRM do médico, nome da clínica ou qualquer informação identificável. Extraia ÚNICA e EXCLUSIVAMENTE os dados técnicos farmacológicos.
${pediatricBlock}
ESTRATÉGIA DE LEITURA:
1. Analise a imagem inteira antes de começar a extrair dados.
2. Para palavras parcialmente legíveis, utilize seu conhecimento da base de medicamentos da ANVISA para deduzir por contexto farmacêutico e pela via de administração descrita nas instruções de uso.
3. Se uma palavra for completamente ilegível e não puder ser deduzida com segurança, retorne null no campo específico. NUNCA invente um nome.
4. Preste atenção especial a abreviações médicas comuns: "cp" = comprimido, "gts" = gotas, "ml" = mililitros, "amp" = ampola, "caps" = cápsula, "VO" = via oral, "SL" = sublingual.

DESAMBIGUAÇÃO POR CONTEXTO CLÍNICO (FEW-SHOT):
Para pacientes pediátricos, utilize a posologia e a via de administração para desambiguar palavras visualmente parecidas. Exemplos de raciocínio que você DEVE aplicar:
- Exemplo 1: Se o garrancho parece 'Doro fol' ou 'Doralgina', MAS a indicação de uso fala em 'nariz', 'lavar' ou 'ml em cada', a dedução correta é 'Soro Fisiológico'. (Doralgina não se aplica no nariz).
- Exemplo 2: Se o garrancho parece 'Dermofex Plus' ou 'Dera...gex', MAS a posologia pede 'gotas', a dedução correta é 'Decongex Plus'. (Dermofex é creme/pomada, não se usa em gotas).
- Exemplo 3: Se o garrancho parece 'Addiva', MAS está acompanhado de 'UI' ou 'gotas 1x ao dia', a dedução correta é 'Addera' (Vitamina D).

Para o campo "frequencia", use o formato padrão descritivo:
- "1x ao dia" → "De 24 em 24 horas"
- "2x ao dia" → "De 12 em 12 horas"
- "3x ao dia" → "De 8 em 8 horas"
- "4x ao dia" → "De 6 em 6 horas"

Para "duracao_dias", extraia o número de dias do tratamento (ex: "por 7 dias" → 7). Se for uso contínuo, retorne null.

Para "medico_prescritor", localize o carimbo ou assinatura do médico na receita. Extraia o NOME COMPLETO do médico e o número do CRM. Concatene no formato: "Nome do Médico - CRM [número]" (ex: "Dr. Carlos Varella - CRM 12345"). Se não encontrar o CRM, retorne apenas o nome completo encontrado. Este campo é global (não por medicamento).

Para cada medicamento, adicione um campo "confianca" (string): "alta" se a leitura foi clara, "media" se houve dedução por contexto, "baixa" se a leitura foi muito difícil.

Se não conseguir identificar algum campo com segurança, use null.`;

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
          temperature: 0.1,
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
                            description: "Dosage (e.g. 500mg, 1 comprimido, 5ml, 10 gotas)",
                          },
                          frequencia: {
                            type: "string",
                            description: "Frequency in descriptive format (e.g. 'De 8 em 8 horas')",
                          },
                          duracao_dias: {
                            type: "number",
                            description: "Duration in days (e.g. 7), or null if continuous use",
                          },
                          confianca: {
                            type: "string",
                            enum: ["alta", "media", "baixa"],
                            description: "Confidence level of the extraction",
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
