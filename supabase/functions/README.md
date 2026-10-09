# WAGWAN WhatsApp Automation

## Edge Functions
- `whatsapp-order-confirmation`: sends the customer template immediately after an order INSERT.
- `whatsapp-webhook`: receives Meta replies and handles `JE CONFIRME` / `J'ANNULE`.

## Required Supabase secrets
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WAGWAN_INTERNAL_WEBHOOK_SECRET`
- `WHATSAPP_ORDER_TEMPLATE=wagwan_order_confirmation`
- `WHATSAPP_ORDER_TEMPLATE_LANGUAGE=fr`
- `WAGWAN_ADMIN_WHATSAPP=212783509122`
- `WHATSAPP_ADMIN_CONFIRMED_TEMPLATE=wagwan_admin_order_confirmed`
- `WHATSAPP_ADMIN_CANCELLED_TEMPLATE=wagwan_admin_order_cancelled`
- `WHATSAPP_ADMIN_TEMPLATE_LANGUAGE=fr`

Never put any of these secrets in frontend JavaScript.
