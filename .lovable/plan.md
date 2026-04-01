

## Diagnosis

All 4 subscriptions in the database have `next_billing_date = 2026-04-01` (today's date). The webhook fetches `subData.nextDueDate` from Asaas, but right after a first payment, Asaas returns the current cycle's due date, not the next renewal.

## Plan

### 1. Fix Webhook Date Calculation (`supabase/functions/asaas-webhook/index.ts`)

After fetching the Asaas subscription details, add a validation layer:

- If `subData.nextDueDate` exists AND is in the future (> today), use it as-is
- If `subData.nextDueDate` is today or in the past, **calculate** the next billing date:
  - For `YEARLY` cycle: add 1 year to `payment.dueDate`
  - For `MONTHLY` cycle: add 1 month to `payment.dueDate`
- Keep existing fallback chain (payment.dueDate if API call fails)

### 2. One-Time Data Fix (SQL Migration)

Run a corrective migration to fix the 4 existing records:

```sql
-- Fix annual plans: next billing = created_at + 1 year
UPDATE subscriptions
SET next_billing_date = created_at + INTERVAL '1 year'
WHERE plan_type = 'annual' AND next_billing_date <= now();

-- Fix monthly plans: next billing = created_at + 1 month
UPDATE subscriptions
SET next_billing_date = created_at + INTERVAL '1 month'
WHERE plan_type = 'monthly' AND next_billing_date <= now();
```

### 3. Deploy

Redeploy `asaas-webhook` with the corrected logic.

---

**Changes summary:**

| File | Change |
|---|---|
| `supabase/functions/asaas-webhook/index.ts` | Add date validation + calculation fallback |
| SQL Migration | Fix existing 4 records with correct renewal dates |

