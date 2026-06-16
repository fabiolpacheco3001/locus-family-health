import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// A1: CORS restrito ao APP_ORIGIN (env var no Supabase Dashboard)
import { corsHeaders } from "../_shared/cors.ts";
// A4: Rate limiting de chamadas de IA
import { checkAiRateLimit, logAiUsage } from "../_shared/rate-limit.ts";

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
    const { allowed, count, limit } = await checkAiRateLimit(supabase, user.id, "analyze-prescription");
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: `Limite de análises de IA atingido (${count}/${limit} por hora). Tente novamente mais tarde.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileUrl, patientAge } = await req.json();
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "fileUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SSRF PROTECTION — only allow Supabase Storage URLs ──
    const allowedHost = new URL(Deno.env.get("SUPABASE_URL")!).host;
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

REGRAS DE FREQUÊNCIA E POSOLOGIA (frequency_type):
Analise a posologia prescrita e classifique-a em um dos 3 tipos:

1. "fixed_interval" — Quando a receita indica intervalos regulares:
   - "1x ao dia" → frequency_type: "fixed_interval", frequency_hours: 24
   - "2x ao dia" ou "12/12h" → frequency_type: "fixed_interval", frequency_hours: 12
   - "3x ao dia" ou "8/8h" → frequency_type: "fixed_interval", frequency_hours: 8
   - "4x ao dia" ou "6/6h" → frequency_type: "fixed_interval", frequency_hours: 6

2. "specific_times" — Quando a receita especifica HORÁRIOS EXATOS (não-lineares):
   - "Tomar às 8h, 14h e 22h" → frequency_type: "specific_times", specific_times: ["08:00", "14:00", "22:00"]
   - "1 cp no almoço (12h) e jantar (19h)" → frequency_type: "specific_times", specific_times: ["12:00", "19:00"]
   - "Manhã e noite" → frequency_type: "specific_times", specific_times: ["08:00", "20:00"]
   - "Em jejum e antes de dormir" → frequency_type: "specific_times", specific_times: ["07:00", "22:00"]

3. "specific_days" — Quando a receita indica DIAS DA SEMANA específicos:
   - "Tomar segundas e quartas" → frequency_type: "specific_days", specific_days: [1, 3], specific_times: ["08:00"]
   - "Apenas às sextas-feiras" → frequency_type: "specific_days", specific_days: [5], specific_times: ["08:00"]
   - Dias da semana: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
   - Se o horário não estiver explícito na receita, use ["08:00"] como padrão.

IMPORTANTE: Se a posologia for ambígua ou simplesmente "2x ao dia" sem horários específicos, prefira "fixed_interval".
O campo "frequencia" (string descritiva) DEVE continuar sendo preenchido como fallback legível (ex: "De 8 em 8 horas", "Às 08:00 e 20:00", "Segundas e Quartas às 08:00").

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
                            description: "Frequency in descriptive format as fallback (e.g. 'De 8 em 8 horas', 'Às 08:00 e 20:00')",
                          },
                          frequency_type: {
                            type: "string",
                            enum: ["fixed_interval", "specific_times", "specific_days"],
                            description: "Type of frequency: fixed_interval for regular intervals, specific_times for exact daily times, specific_days for weekly schedule",
                          },
                          frequency_hours: {
                            type: "number",
                            description: "Interval in hours (only for fixed_interval, e.g. 8 for 8/8h)",
                          },
                          specific_times: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of HH:mm times (for specific_times and specific_days, e.g. ['08:00', '20:00'])",
                          },
                          specific_days: {
                            type: "array",
                            items: { type: "number" },
                            description: "Array of weekday numbers 0=Sun to 6=Sat (only for specific_days, e.g. [1, 3, 5])",
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

    // A4: Registrar uso de IA (non-blocking)
    await logAiUsage(supabase, user.id, "analyze-prescription");

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
