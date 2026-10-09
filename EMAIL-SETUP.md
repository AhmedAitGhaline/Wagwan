# WAGWAN Email Automation

## 1. Supabase secrets

Required:
- RESEND_API_KEY
- WAGWAN_INTERNAL_WEBHOOK_SECRET

Optional:
- RESEND_FROM_EMAIL (defaults to `WAGWAN <onboarding@resend.dev>`)

## 2. Run SQL

Open `supabase/email-migration.sql`, replace `TON_SECRET_ICI` with the exact existing `WAGWAN_INTERNAL_WEBHOOK_SECRET`, then run it in Supabase SQL Editor.

## 3. Deploy

Deploy `supabase/functions/wagwan-order-email/index.ts` as `wagwan-order-email`. JWT verification must be OFF because the database webhook authenticates with the internal secret header.

## 4. Test

Place a real test COD order using an email address you control. The order insert should trigger the email Edge Function automatically. Check `email_order_confirmations` and Resend Logs.

Do not put RESEND_API_KEY or SUPABASE_SERVICE_ROLE_KEY in frontend files.
