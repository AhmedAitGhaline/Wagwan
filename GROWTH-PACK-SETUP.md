# WAGWAN Growth Pack — installation and activation

This ZIP preserves the existing storefront and admin files and adds an additive growth layer plus a Supabase migration.

## New files
- `wagwan-growth-pack.js`: product upsell, low-stock notice, size waitlist form, public outfit gallery, order tracking interface, public links and admin Social & Growth settings card.
- `track-order.html`: public tracking form. It calls `public-order-tracking` Edge Function; deploy/configure that function before enabling public tracking.
- `photo-review.html`: photo review submission UI. Create a public Supabase Storage bucket named `review-photos` with appropriate upload limits before use.
- `supabase/functions/public-order-tracking/index.ts`: verifies order number + phone and returns only the shipment status/tracking URL.
- `affiliate.html`: affiliate portal shell. Secure commission data is deliberately not exposed to anon users; implement/deploy an authenticated affiliate Edge Function before showing amounts.
- `supabase/growth-pack-migration.sql`: additive tables and RLS policies.

## Required Supabase step
Run `supabase/growth-pack-migration.sql` in the Supabase SQL Editor. Then create a Storage bucket named `review-photos` (private bucket recommended; use signed URLs in production).

## Important activation notes
- Instagram/TikTok links, free-shipping threshold, bundle settings and photo-review points can be edited under Admin → Settings after the migration. Admin updates require an authenticated admin session.
- Bundle messaging and the free-shipping threshold indicator are UI foundations. Before applying discounts to checkout, validate the same rules server-side at order creation; do not trust client-side prices.
- Stock shown on the product page currently reflects the product stock object loaded by the existing app. For live stock, ensure the product stock values are synced from Supabase and reserve/decrement stock atomically when an order is accepted.
- Waitlist signups are saved in `wagwan_size_waitlist`; automatic notification on restock requires a server-side restock trigger and an email/WhatsApp provider.
- Photo reviews are submitted as pending. Award points only after an admin approves the review and verifies the customer/phone; do not award points from the browser.
- Risk indicator schema is provided via `wagwan_cod_confirmation_events`; the order/Sendit webhook must populate this history from confirmed delivered/refused/cancelled outcomes before it can calculate a meaningful risk label.
- The included `public-order-tracking` Edge Function matches both order number and normalized phone and returns only status/tracking URL. Deploy it with Supabase CLI before using the page. Do not query the orders table directly from the public browser.
- Language selector currently handles the selector, document language and RTL, with a starter translation map. Full professional translation of every existing page/content remains a separate localization pass.
- Affiliate tables are private to authenticated users. A secure affiliate sign-in/OTP Edge Function and commission calculation hook from the order creation/webhook flow are required before live affiliate balances are shown.

## Deployment
Commit and push the complete extracted project to the connected GitHub repository. Cloudflare Pages should deploy the frontend. Supabase SQL migrations and Edge Functions are deployed separately from the static site.
- La relance automatique COD a été retirée du projet. Le tableau de risque COD reste disponible pour consultation.
- La sélection de langue FR/EN/AR a été retirée. Le site conserve son contenu actuel.
- Les photos d’outfit sont soumises sans note ni commentaire et doivent être approuvées dans Admin → Feedback avant affichage dans la galerie publique.
- Les liens Instagram/TikTok et l’espace influenceur sont placés dans le footer avant la ligne de copyright.
