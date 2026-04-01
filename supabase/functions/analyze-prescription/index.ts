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
      ? `\n\nREGRA CRÍTICA DE SEGURANÇA PEDIÁTRICA (PACIENTE COM ${patientAge} ANOS):
Este paciente é uma CRIANÇA. Você DEVE:
1. RESTRINGIR RIGOROSAMENTE deduções de medicamentos de venda livre (OTC) para adultos. É TERMINANTEMENTE PROIBIDO sugerir Dorflex, Tandrilax, relaxantes musculares fortes, Nimesulida (proibido < 12 anos), ou qualquer medicamento contraindicado para pediatria baseado apenas em formas visuais semelhantes.
2. PRIORIZAR formas farmacêuticas pediátricas: Xarope, Gotas, Suspensão Oral. Se for comprimido, restringir à base ANVISA pediátrica segura (Paracetamol, Dipirona, Ibuprofeno infantil, Amoxicilina, Prednisolona, Cefalexina). Medicamentos comuns em pediatria incluem também: Salsep (gotas nasais de solução salina), Desloratadina, Budesonida, Loratadina, Dexametasona.
3. IMPORTANTE: NÃO retorne nome_medicamento como null se houver qualquer rabisco que possa ser deduzido por contexto farmacêutico. O Locus Vita possui um fluxo de revisão humana obrigatório. Portanto, PRIORIZE a identificação do nome, mesmo que a confiança visual seja baixa. Forneça o nome que parece ser e defina confianca como "baixa". Só retorne null se for absolutamente impossível deduzir qualquer caractere. NÃO alucine medicamentos PERIGOSOS para crianças (relaxantes musculares, AINEs proibidos), mas medicamentos seguros para pediatria podem ser sugeridos com confiança baixa. ATENÇÃO ESPECIAL: Para garranchos com padrão "K...til" ou "K...il", priorize SEMPRE Ketoftil (Cetotifeno) em contexto pediátrico. NUNCA sugira K-Othrine ou qualquer inseticida/veneno.
4. Dosagens pediátricas costumam ser em ml, gotas ou mg/kg. Desconfie de dosagens adultas (ex: 500mg de dipirona comprimido para criança de 7 anos).

DICIONÁRIO VISUAL PEDIÁTRICO E CONTEXTO CRUZADO:
5. VITAMINAS (Addera D3): Se a palavra se assemelhar a "Addiva", "Addera", "Adere", "Adera" E estiver acompanhada de "UI" (Unidades Internacionais), "Gotas" ou "gts", a dedução OBRIGATÓRIA de maior peso é "Addera D3" (Colecalciferol / Vitamina D). Confiança mínima: "media".
6. LAVAGEM NASAL (Soro Fisiológico): Se o nome for um garrancho ilegível (ex: "Doro fol", "Soro fiol", "S. Fisiol"), MAS as instruções de uso contiverem palavras como "nariz", "narina", "ml em cada", "lavar", "lavagem nasal", "aspirar", a dedução OBRIGATÓRIA para o nome do item é "Soro Fisiológico 0.9%" ou "Solução Fisiológica". NUNCA tente ler a primeira linha isolada se as instruções abaixo derem o contexto da via de administração nasal.
7. CONTEXTO CRUZADO GERAL: Para QUALQUER item ilegível, ANTES de retornar null, leia as instruções de uso/posologia que acompanham aquele item. Palavras-chave como "nebulização" sugerem Budesonida ou Salbutamol; "olhos/colírio" sugere Tobramicina ou Ketoftil; "ouvido" sugere Otosporin; "garganta" sugere anti-inflamatório ou antisséptico oral. Use o contexto da via de administração para refinar a dedução do nome.`
      : "";

    const systemPrompt = `Você é um farmacêutico brasileiro sênior com 20 anos de experiência em dispensação hospitalar e comunitária, especialista em decifrar caligrafia médica manuscrita.

REGRA CRÍTICA DE SEGURANÇA ABSOLUTA (BLINDAGEM ANTI-ALUCINAÇÃO):
É TERMINANTEMENTE PROIBIDO, em QUALQUER modo (adulto ou pediátrico), sugerir, deduzir ou retornar nomes de substâncias que NÃO sejam medicamentos de uso humano aprovados pela ANVISA. Você NUNCA deve retornar nomes de: inseticidas (ex: K-Othrine, Baygon, SBP), venenos, raticidas, produtos de limpeza, cosméticos não-medicamentosos, agroquímicos ou substâncias químicas industriais, mesmo que a forma visual do garrancho seja semelhante. Se houver dúvida visual com um garrancho começando com "K...til", "K...il" ou similar, sua dedução DEVE priorizar medicamentos reais da ANVISA como Ketoftil (Cetotifeno - xarope/gotas, comum em pediatria), Keflex (Cefalexina) ou Keppra (Levetiracetam). Se NENHUM medicamento real da ANVISA se encaixar com segurança, retorne nome_medicamento como null e confianca como "baixa". JAMAIS alucine substâncias perigosas.

REGRA CRÍTICA DE PRIVACIDADE (LGPD): Ignore, censure e descarte completamente qualquer dado pessoal presente na imagem. NÃO extraia nem retorne: nome do paciente, CPF, RG, endereço, telefone, CRM do médico, nome da clínica ou qualquer informação identificável. Extraia ÚNICA e EXCLUSIVAMENTE os dados técnicos farmacológicos.
${pediatricBlock}
ESTRATÉGIA DE LEITURA:
1. Analise a imagem inteira antes de começar a extrair dados.
2. Para palavras parcialmente legíveis, utilize seu conhecimento da base de medicamentos da ANVISA para deduzir por contexto.${isPediatric ? " ATENÇÃO: Filtre OBRIGATORIAMENTE por medicamentos seguros para a faixa etária pediátrica." : " Exemplos comuns: Tandrilax, Enterogermina, Addera D3, Dorflex, Salsep, Dipirona, Amoxicilina, Omeprazol, Losartana, Metformina, Rivotril, Fluoxetina, Pantoprazol, Ibuprofeno, Paracetamol, Azitromicina, Prednisolona, Cefalexina, Ciprofloxacino, Nimesulida."}
3. Se uma palavra for completamente ilegível e não puder ser deduzida com segurança farmacêutica, retorne null no campo específico. NUNCA invente ou alucine um nome de medicamento.
4. Preste atenção especial a abreviações médicas comuns: "cp" = comprimido, "gts" = gotas, "ml" = mililitros, "amp" = ampola, "caps" = cápsula, "VO" = via oral, "SL" = sublingual.

Para o campo "frequencia", use o formato padrão descritivo:
- "1x ao dia" ou "a cada 24 horas" → "De 24 em 24 horas"
- "De 12 em 12 horas" ou "2x ao dia" → "De 12 em 12 horas"
- "De 8 em 8 horas" ou "3x ao dia" → "De 8 em 8 horas"
- "De 6 em 6 horas" ou "4x ao dia" → "De 6 em 6 horas"

Para "duracao_dias", extraia o número de dias do tratamento (ex: "por 7 dias" → 7). Se for uso contínuo, retorne null.

Para "medico_prescritor", extraia APENAS o primeiro nome do médico (sem sobrenome completo, sem CRM). Ex: "Dr. Carlos". Este campo é global (não por medicamento).

Para cada medicamento, adicione um campo "confianca" (string): "alta" se a leitura foi clara, "media" se houve dedução por contexto, "baixa" se a leitura foi muito difícil. Isso ajudará o usuário a priorizar a revisão.

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
                            description: "Confidence level of the extraction: alta (clear reading), media (deduced by context), baixa (very difficult reading)",
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
