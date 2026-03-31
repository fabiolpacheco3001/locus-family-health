

## Diagnosis

The `create-asaas-checkout` Edge Function uses `supabase.auth.getClaims()` which doesn't exist in `@supabase/supabase-js@2.49.1`. The function crashes with a 500 error on every call, meaning **the Asaas API key has never been reached**.

## Plan

### Step 1: Fix `create-asaas-checkout` — Replace `getClaims` with `getUser`

**File:** `supabase/functions/create-asaas-checkout/index.ts`

Replace the broken auth block:
```typescript
// BROKEN
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
const userId = claimsData.claims.sub;
const userEmail = claimsData.claims.email;
```

With the working pattern:
```typescript
// FIXED
const { data: { user }, error: userError } = await supabase.auth.getUser(token);
if (userError || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
}
const userId = user.id;
const userEmail = user.email!;
```

### Step 2: Deploy and Test

1. Deploy the fixed function.
2. Invoke with a test call (unauthenticated) — expect 401 (proves it passes the auth check correctly now).
3. Check logs to confirm no more `getClaims` crash.

### Step 3: Validate Asaas API Key

Create a minimal one-off test: call the Asaas `/customers?limit=1` endpoint via the fixed function's internal logic, or add a temporary health-check path. Confirm the key returns a valid response (200), then remove the test path.

**Alternative (faster):** Temporarily curl the Asaas API directly from a test edge function that just calls `GET /v3/customers?limit=1` with the `ASAAS_API_KEY` header and returns the status. Deploy, invoke, check response, then delete the function.

### Summary of Changes

| File | Change |
|---|---|
| `supabase/functions/create-asaas-checkout/index.ts` | Replace `getClaims()` with `getUser()` |
| Deploy + test | Validate function works and Asaas API key responds |

