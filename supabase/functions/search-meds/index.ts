// TODO: Substituir este Mock pelo fetch na API da Anvisa/Memed usando a Server Key guardada no Deno.env.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MEDICATIONS = [
  { id: "1", name: "Amoxicilina" },
  { id: "2", name: "Dipirona" },
  { id: "3", name: "Ibuprofeno" },
  { id: "4", name: "Losartana" },
  { id: "5", name: "Paracetamol" },
  { id: "6", name: "Azitromicina" },
  { id: "7", name: "Omeprazol" },
  { id: "8", name: "Simeticona" },
  { id: "9", name: "Loratadina" },
  { id: "10", name: "Cefalexina" },
  { id: "11", name: "Dexametasona" },
  { id: "12", name: "Metformina" },
  { id: "13", name: "Prednisona" },
  { id: "14", name: "Rivotril (Clonazepam)" },
  { id: "15", name: "Fluoxetina" },
  { id: "16", name: "Captopril" },
  { id: "17", name: "Enalapril" },
  { id: "18", name: "Hidroclorotiazida" },
  { id: "19", name: "Sinvastatina" },
  { id: "20", name: "Atorvastatina" },
  { id: "21", name: "Levotiroxina" },
  { id: "22", name: "Bromoprida" },
  { id: "23", name: "Ranitidina" },
  { id: "24", name: "Nimesulida" },
  { id: "25", name: "Diclofenaco" },
  { id: "26", name: "Cetoprofeno" },
  { id: "27", name: "Ambroxol" },
  { id: "28", name: "Salbutamol" },
  { id: "29", name: "Budesonida" },
  { id: "30", name: "Dorflex" },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || query.length < 2) {
      return new Response(JSON.stringify({ data: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = query.toLowerCase().trim();
    const results = MEDICATIONS.filter((med) =>
      med.name.toLowerCase().includes(normalized)
    );

    return new Response(JSON.stringify({ data: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ data: [] }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
