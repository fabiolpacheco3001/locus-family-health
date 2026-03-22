// Edge Function: search-meds
// Busca medicamentos via API externa (MED_API_URL) ou fallback local.
// TODO: Configurar MED_API_URL com a URL da API da Memed quando disponível.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_RESULTS = 15;

// Fallback local para quando MED_API_URL não estiver configurada ou a API externa falhar
const LOCAL_MEDS = [
  "Amoxicilina","Dipirona","Ibuprofeno","Losartana","Paracetamol",
  "Azitromicina","Omeprazol","Simeticona","Loratadina","Cefalexina",
  "Dexametasona","Metformina","Prednisona","Rivotril (Clonazepam)",
  "Fluoxetina","Captopril","Enalapril","Hidroclorotiazida",
  "Sinvastatina","Atorvastatina","Levotiroxina","Bromoprida",
  "Ranitidina","Nimesulida","Diclofenaco","Cetoprofeno",
  "Ambroxol","Salbutamol","Budesonida","Dorflex",
];

async function fetchExternalMeds(apiUrl: string): Promise<string[]> {
  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  const rawData: unknown = await res.json();

  const items: string[] = [];
  if (Array.isArray(rawData)) {
    for (const entry of rawData) {
      if (typeof entry === 'string') {
        items.push(entry);
      } else if (entry && typeof entry === 'object') {
        const name = (entry as Record<string, unknown>).nome
          ?? (entry as Record<string, unknown>).name
          ?? (entry as Record<string, unknown>).medicamento;
        if (typeof name === 'string') items.push(name);
      }
    }
  }
  return items;
}

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

    const apiUrl = Deno.env.get('MED_API_URL');
    let items: string[];

    if (apiUrl) {
      try {
        items = await fetchExternalMeds(apiUrl);
      } catch (fetchErr) {
        console.error('Fetch externo falhou, usando fallback local:', fetchErr);
        items = LOCAL_MEDS;
      }
    } else {
      items = LOCAL_MEDS;
    }

    const normalized = query.toLowerCase().trim();
    const results = items
      .filter((name) => name.toLowerCase().includes(normalized))
      .slice(0, MAX_RESULTS)
      .map((name, i) => ({ id: String(i + 1), name }));

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