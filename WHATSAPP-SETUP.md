# WAGWAN — WhatsApp instant order confirmation

## Final flow
Customer checkout → `orders` INSERT → Supabase Database Webhook → `whatsapp-order-confirmation` → Meta WhatsApp → customer buttons → `whatsapp-webhook` → order confirmed/cancelled → admin WhatsApp recap.

There is **no 10-minute delay**.

## 1. Run SQL
In Supabase SQL Editor, run:
`supabase/whatsapp-migration.sql`

## 2. Supabase secrets
Set these in Edge Functions > Secrets:
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WAGWAN_INTERNAL_WEBHOOK_SECRET` (generate a long random value; do not reuse the verify token)
- `WHATSAPP_ORDER_TEMPLATE=wagwan_order_confirmation`
- `WHATSAPP_ORDER_TEMPLATE_LANGUAGE=fr`
- `WAGWAN_ADMIN_WHATSAPP=212783509122`
- `WHATSAPP_ADMIN_CONFIRMED_TEMPLATE=wagwan_admin_order_confirmed`
- `WHATSAPP_ADMIN_CANCELLED_TEMPLATE=wagwan_admin_order_cancelled`
- `WHATSAPP_ADMIN_TEMPLATE_LANGUAGE=fr`

## 3. Deploy functions
Deploy both folders:
- `supabase/functions/whatsapp-order-confirmation`
- `supabase/functions/whatsapp-webhook`

Both functions use server-side secrets only.

## 4. Configure Meta webhook
Callback URL:
`https://pjxdaiqnvunjaasmmten.supabase.co/functions/v1/whatsapp-webhook`

Verify token:
`WHATSAPP_VERIFY_TOKEN`

Subscribe to `messages`.

## 5. Configure Supabase Database Webhook
Supabase Dashboard → Database → Webhooks → Create webhook.

- Table: `public.orders`
- Event: `INSERT`
- Method: POST
- URL: `https://pjxdaiqnvunjaasmmten.supabase.co/functions/v1/whatsapp-order-confirmation`
- Header: `x-wagwan-webhook-secret: <same value as WAGWAN_INTERNAL_WEBHOOK_SECRET>`

This is what makes the customer WhatsApp message immediate.

## 6. Admin WhatsApp templates
Create/approve these two Utility templates in Meta.

### `wagwan_admin_order_confirmed`
Bonjour,

🟢 WAGWAN — Commande confirmée
Client : {{1}}
Commande : {{2}}
Details : {{3}}
Ville : {{4}}
Total : {{5}} DH
Le client a confirmé sa commande WhatsApp.

Variables:
1 Omar Benali
2 WG-1042
3 TASTE LONGSLEEVE — Taille L × 1
4 Marrakech
5 239

### `wagwan_admin_order_cancelled`
Bonjour,

🔴 WAGWAN — Commande annulée
{{1}} a annulé la commande {{2}}.
Details : {{3}}

Variables:
1 Omar Benali
2 WG-1042
3 TASTE LONGSLEEVE — Taille L × 1

The code waits for these template names to be active before admin notifications can work reliably outside a WhatsApp customer-service window.

## 7. Test
Use a real WhatsApp number that can receive messages.

Example phone inputs accepted by the storefront:
- `06 12 34 56 78`
- `0612345678`
- `+212 6 12 34 56 78`
- `+212612345678`
- `212612345678`
- `00212 6 12 34 56 78`
- `6 12 34 56 78`
- `612345678`
- same patterns with `07` / `7`

All normalize to `212612345678` / `212712345678`.
