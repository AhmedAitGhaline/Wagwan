# WAGWAN — WhatsApp Instant Confirmation V10

This package is based on the supplied WAGWAN V9 project.

### New integration
- Moroccan phone normalization on checkout.
- Customer WhatsApp confirmation sent immediately after order creation.
- No 10-minute wait and no browser `setTimeout`.
- `JE CONFIRME` / `J'ANNULE` replies handled by the WhatsApp webhook.
- Order status changed atomically in Supabase.
- Cancellation restores the exact product-size stock quantities.
- Confirmation keeps stock consumed.
- Confirmation/cancellation is recorded in `whatsapp_order_confirmations`.
- Admin WhatsApp recap prepared with product, size, city and total details.

### Important
The ZIP contains the complete code and SQL migration, but external Supabase/Meta configuration still has to be deployed/configured. See `WHATSAPP-SETUP.md`.

Never put `WHATSAPP_ACCESS_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY` in frontend files.

## V10.1 phone normalization
The checkout and server-side `create_cod_order` RPC accept common Moroccan mobile input formats including 06/07, 6/7, +212 6/7, 212 6/7, 00212 6/7, separators/spaces/parentheses, and Arabic-Indic/Persian digits. Canonical storage format is `2126XXXXXXXX` or `2127XXXXXXXX`.
