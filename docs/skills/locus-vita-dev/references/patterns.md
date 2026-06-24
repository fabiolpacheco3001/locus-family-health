# Padrões Corretos — Locus Vita

Referência rápida de implementação. Leia quando precisar do molde exato de um padrão.

---

## Hook de dados (padrão obrigatório)

```typescript
// Molde: useMedications.tsx
const useNomeHook = (familyMemberId: string) => {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['chave-principal', familyMemberId],
    queryFn: async () => { /* supabase query */ },
    staleTime: 5 * 60 * 1000,  // 5 min — obrigatório
  })

  const mutation = useMutation({
    mutationFn: async (payload) => { /* supabase mutation */ },
    onSuccess: () => {
      // Invalida TODAS as chaves dependentes — não apenas a óbvia
      queryClient.invalidateQueries({ queryKey: ['chave-principal'] })
      queryClient.invalidateQueries({ queryKey: ['pending-counts'] })
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    }
  })

  return { data, mutation, isLoading }  // sempre este formato
}
```

---

## Edge Function (template obrigatório)

```typescript
// Molde: supabase/functions/analyze-prescription/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { log } from "../_shared/logger.ts"

serve(async (req) => {
  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  // 2. Auth via header Authorization
  const authHeader = req.headers.get("Authorization")
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader! } } }
  )

  // 3. RBAC via user_roles se necessário

  try {
    // 4. Lógica da função

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err) {
    // 5. NUNCA expor err.message ao cliente
    log("error", "operacao_falhou", {
      error: err instanceof Error ? err.message : String(err)
    })
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
```

---

## Query com inner join + soft-delete (padrão obrigatório em listagens)

```typescript
// ✅ Correto — nunca traz órfãos de membros deletados
const { data } = await supabase
  .from('consultations')
  .select(`
    *,
    family_members!inner(id, name, avatar_url)
  `)
  .eq('group_id', groupId)
  .is('family_members.deleted_at', null)
  .order('date', { ascending: false })
```

---

## Subscriptions — colunas explícitas (NUNCA select *)

```typescript
// ✅ Migration 20260619212318 revogou SELECT table-level
const { data: sub } = await supabase
  .from('subscriptions')
  .select('id, user_id, status, plan_type, next_billing_date, test_mode, credit_card_token, asaas_customer_id, asaas_payment_id')
  .eq('user_id', userId)
  .single()
```

---

## Grace Period — lógica correta

```typescript
import { isFuture } from 'date-fns'

const hasAccess =
  subscription.status === 'active' ||
  (
    subscription.status === 'canceled' &&
    isFuture(new Date(subscription.next_billing_date))
  )

// Durante Grace Period em MeuPlano:
// - Renderizar normalmente
// - Ocultar botão de cancelamento
// - Mostrar: "Acesso válido até [next_billing_date]"
```

---

## Motor financeiro — cancelamento correto

```typescript
// ✅ Via Edge Function cancel-asaas-subscription — NUNCA frontend direto
// ✅ Alterar APENAS status — nunca nullar datas
await supabase
  .from('subscriptions')
  .update({ status: 'canceled' })  // só isso
  .eq('user_id', userId)

// ❌ PROIBIDO
.update({ status: 'canceled', next_billing_date: null, credit_card_token: null })
```

---

## Signed URLs para arquivos clínicos

```typescript
// Usar sempre lib/storage.ts + hooks/useSignedUrl.ts
// TTL 15 min, auto-renova via React Query

// ✅ Buckets privados: exam-files, receitas, vaccine_documents
// ✅ Bucket público: avatars (URL direta, listagem restrita por path)
import { getSignedUrl } from '@/lib/storage'
const url = await getSignedUrl(bucket, path)
```

---

## RBAC — verificar nível correto

```typescript
// Dois níveis independentes:
// Plataforma: user_roles.role → 'customer' | 'admin' | 'super_admin'
// Grupo:      family_group_members.role → 'admin' | 'user'
//             family_group_members.managed_profiles UUID[] → membros que 'user' pode gerenciar

// Em edge functions — verificar via helpers SECURITY DEFINER:
// is_super_admin(), is_group_admin(), is_group_member(), check_group_access()
```

---

## Posologia — sempre validar os 3 frequency_types

```typescript
// Qualquer lógica de próxima dose deve cobrir os 3 modelos:
// 'interval'       → frequency_hours (legado)
// 'specific_times' → specific_times TEXT[] ex: ['08:00','20:00']
// 'specific_days'  → specific_days INT[] ex: [1,4] = seg/qui

// Motor centralizado: lib/calculateNextDose.ts
// Nunca reimplementar — sempre usar a função existente
// Testar cenário nulo: array vazio, sem doses históricas
```

---

## Asaas — campos críticos do webhook

```typescript
// creditCardToken vem de:
payment.creditCard.creditCardToken  // ← campo correto no payload do webhook

// resolveAsaasEnv(testMode) seleciona sandbox vs prod automaticamente
// testMode vem de subscriptions.test_mode — não hardcodar

// Cycle completo:
// PAYMENT_CONFIRMED → status='active', next_billing_date=hoje+30, credit_card_token=...
```

---

## Datas — helpers de lib/tz.ts

```typescript
import { TZ_SAO_PAULO, parseDateInSP, toSPTime, formatDate } from '@/lib/tz'

// Parse seguro
const date = parseDateInSP(rawValue)
if (!date) return null  // null quando inválido

// Format com timezone correto
const formatted = formatDate(date, 'dd/MM/yyyy HH:mm')
```

---

## Sentry — dois canais distintos

```typescript
// Frontend (src/lib/sentry.ts)
import { captureException } from '@/lib/sentry'
captureException(err, { context: 'NomeComponente' })

// Edge Functions (_shared/sentry-edge.ts)
import { captureEdgeException } from '../_shared/sentry-edge.ts'
await captureEdgeException(err, { event: 'nome_evento' })
// Fail-safe: se SENTRY_DSN ausente → no-op silencioso
```

---

## Arquivos auto-gerados — NUNCA editar manualmente

```
src/integrations/supabase/client.ts   ← auto-gerado pelo Supabase CLI
src/integrations/supabase/types.ts    ← regenerar após migrations:
                                         supabase gen types typescript --local > src/integrations/supabase/types.ts
supabase/config.toml                  ← gerenciado pelo Lovable
```
