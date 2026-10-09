# WAGWAN Sendit — City → District fix

## What changed
- The order's `city` is now used as the client city.
- The Sendit creation modal now shows `VILLE CLIENT` before `DISTRICT CLIENT`.
- The client city is preselected from the WAGWAN order and can be changed.
- Changing the client city reloads Sendit districts for that city.
- `VILLE DE RAMASSAGE` remains the Sendit pickup-city selector and is NOT inferred from the customer's city.
- The `sendit-districts` Edge Function now reads the POST body (`query`) used by Supabase `functions.invoke`, fixing the previous issue where the query was ignored and unrelated districts could appear.
- The Sendit base URL slash regex is valid TypeScript: `.replace(/\/$/, "")`.

## Required deployment
1. In Supabase Edge Functions, open `sendit-districts`.
2. Replace its code with `supabase/functions/sendit-districts/index.ts` from this ZIP.
3. Deploy `sendit-districts`.
4. Replace the frontend project files with this ZIP, especially `sendit-admin.js`.
5. Hard refresh the Admin with Ctrl+F5.

No new secrets are required.
