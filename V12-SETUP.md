# WAGWAN V12 — Setup

## 1. Existing Supabase setup
Keep the existing V11 schema/migrations and your existing WhatsApp / Sendit / email setup.

## 2. Run the new migration
In Supabase → SQL Editor, run:

`supabase/wagwan-v12-migration.sql`

This adds:

- `analytics_visitors`
- `analytics_events`
- `coupons`
- `coupon_usages`
- `loyalty_accounts`
- `loyalty_transactions`
- `wagwan_cart_sessions`
- `checkout_leads`
- coupon analytics view
- new COD order RPC with coupon + loyalty support
- loyalty trigger: 1 delivered order = 5 points

## 3. Loyalty rules
- 1 delivered order = 5 points.
- 5 points = 5 DH discount.
- Points are awarded only when an order changes to `delivered`.
- Points can be redeemed in multiples of 5.

## 4. Analytics rules
- Unique visitor: one anonymous `visitor_id` forever. Returning on another day does NOT add another visitor.
- Product view: one count per visitor per product. Clicking the same product 100 times still counts as 1 for that visitor/product.
- Add to cart: one count per visitor total. Repeated Add to Cart actions do not increase the unique Add to Cart KPI.
- Checkout started: one count per visitor.
- Orders: one count per created order.

## 5. Abandoned carts
Two cases are separated:

### Anonymous cart
A visitor adds a product and leaves before checkout. The cart is stored without personal contact information. It is useful for analytics, but cannot be contacted by WhatsApp.

### Recoverable checkout lead
Once a visitor starts checkout and supplies a phone number, WAGWAN can store the checkout lead. If the visitor leaves before ordering, it appears in Admin → Abandoned Carts and can be used for a recovery workflow.

## 6. Coupons
Admin → Coupons lets you create:

- Code/name
- Discount percentage
- Maximum uses
- Expiration
- Minimum order
- Maximum discount
- Commission percentage

Checkout supports applying a coupon.

## 7. Real-time
Analytics, coupon usage, loyalty accounts and abandoned checkout data are subscribed through Supabase Realtime. The dashboard updates without a manual refresh.

## 8. Important
The migration should be run after the existing V11 schema and after the migrations that your current project already uses (WhatsApp/email/Sendit as applicable).

## Welcome 5% popup / manual promo lead capture

The homepage shows a compact welcome announcement after 5 seconds. It is client-only and never rendered inside the Admin Panel.

When a visitor submits their Moroccan WhatsApp number, WAGWAN stores the relationship between the anonymous `visitor_id` and the phone number. No coupon is generated automatically and no WhatsApp message is sent automatically: the promo-code delivery is intentionally manual.

The migration adds/uses:
- `analytics_visitors.phone`
- `wagwan_cart_sessions.phone`
- `wagwan_cart_sessions.lead_type` (`anonymous`, `number_promo`, `checkout`)
- `welcome_discount_claims`
- `mark_cart_presence()` for active/lost cart presence

Abandoned Carts are separated into:
- Checkout Leads: visitor filled checkout but did not submit the order.
- Number Promo Leads: visitor gave their number in the welcome announcement and then left a cart.
- Anonymous Cart Sessions: visitor left a cart without giving a promo number and without filling checkout.

Status is `ACTIVE` while the visitor is sending live presence updates and `PERDU` after they leave or become inactive.
