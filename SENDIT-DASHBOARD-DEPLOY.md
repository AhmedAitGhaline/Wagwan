# WAGWAN V11.3 — Sendit Dashboard Deployment

V11.3 makes the six admin-facing Sendit Edge Functions **standalone**. They no longer import `../_sendit-common.ts`, so each function can be created and deployed directly from Supabase Dashboard.

## Functions to create

Keep your existing `sendit-webhook`. Create these six additional functions:

- `sendit-create-delivery`
- `sendit-districts`
- `sendit-pickup-cities`
- `sendit-packagings`
- `sendit-refresh-delivery`
- `sendit-refresh-all`

For each one, open the matching folder under `supabase/functions/<name>/index.ts`, create a function with the exact same name in Supabase Dashboard, paste the complete `index.ts`, and Deploy.

## Secrets

The functions use the existing Supabase Edge Function environment plus these Sendit secrets:

- `SENDIT_PUBLIC_KEY`
- `SENDIT_SECRET_KEY`
- `SENDIT_BASE_URL` = `https://app.sendit.ma/api/v1`

Do not put the private key in frontend files or GitHub.

## Authentication

The six functions are called by the logged-in WAGWAN admin and validate the Supabase Bearer token plus `profiles.role = admin`. Do not disable JWT verification for these six functions.

Only `sendit-webhook` should have JWT verification disabled, because Sendit calls it directly. Its security is the `X-Sendit-Signature` HMAC-SHA256 verification.
