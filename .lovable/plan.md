

## Diagnosis

The screenshot shows the three pricing buttons are **vertically misaligned** — each button sits at a different height. The root cause:

1. **Different content heights** across cards (e.g., "Teste todas as funções Premium por 30 dias." is longer than "Cancele quando quiser.", and the Annual card has an extra discount line + extra top padding for the "Mais Popular" pill).
2. The `CardContent` uses `flex flex-col items-center` but the button uses `mt-8` (fixed margin-top), so the button's vertical position depends on the cumulative height of content above it.
3. The cards have `h-full` but the content inside doesn't push the button to the bottom.

## Fix: Push buttons to the bottom with `mt-auto`

**File:** `src/pages/Landing.tsx`

**Changes (3 lines):**

1. **Line 412** — Add `h-full` to CardContent of the Teste card so it stretches to fill the `h-full` Card:
   ```
   <CardContent className="p-7 text-center flex flex-col items-center h-full">
   ```

2. **Line 420** — Change `mt-8` to `mt-auto pt-8` on the Teste button, pushing it to the bottom:
   ```
   className="mt-auto pt-8 w-full h-12 rounded-full ..."
   ```

3. **Line 434** — Same `h-full` on Mensal CardContent:
   ```
   <CardContent className="p-7 text-center flex flex-col items-center h-full">
   ```

4. **Line 443** — Same `mt-auto pt-8` on Mensal button:
   ```
   className="mt-auto pt-8 w-full h-12 rounded-full ..."
   ```

5. **Line 466** — Same `h-full` on Anual CardContent:
   ```
   <CardContent className="p-7 text-center flex flex-col items-center pt-10 h-full">
   ```

6. **Line 477** — Same `mt-auto pt-8` on Anual button:
   ```
   className="mt-auto pt-8 w-full h-12 rounded-full ..."
   ```

This uses `mt-auto` (flexbox auto-margin) to always pin buttons to the bottom of each card, regardless of content height differences. The `pt-8` preserves the visual spacing above the button.

