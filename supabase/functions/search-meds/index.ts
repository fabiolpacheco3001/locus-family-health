const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FALLBACK_URL = 'https://raw.githubusercontent.com/tfrfrfr/med-api-br/main/medicamentos.json';
const MAX_RESULTS = 15;

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

    const apiUrl = Deno.env.get('MED_API_URL') || FALLBACK_URL;

    let rawData: unknown;
    try {
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      rawData = await res.json();
    } catch (fetchErr) {
      console.error('Fetch externo falhou:', fetchErr);
      return new Response(
        JSON.stringify({ error: 'Serviço de busca temporariamente indisponível' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Normalize: the fallback JSON is an array of objects with varying shapes
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