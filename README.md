# WAGWAN — HTML/CSS/JS + Supabase

This version keeps the storefront and admin UI in plain HTML/CSS/JavaScript. Supabase provides the real backend, authentication, database, storage, RLS and atomic stock-safe COD order creation.

## 1. Configure Supabase

1. Create a Supabase project.
2. Open SQL Editor and run **supabase-schema.sql**.
3. In Storage, create a bucket named **product-images** and make it public for image delivery. The SQL policies restrict writes/deletes to admin users.
4. Create your personal account in **Authentication → Users**.
5. In SQL Editor, run this once with your own email:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

6. Edit `supabase-config.js`:

```js
window.WAGWAN_SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
window.WAGWAN_SUPABASE_ANON_KEY = 'YOUR_ANON_OR_PUBLISHABLE_KEY';
```

Never put a `service_role` or secret key in the project.

## 2. Run locally

Because this is a static site, you can use VS Code Live Server or any static web server. Opening HTML directly with `file://` can cause browser module/network restrictions; Live Server is recommended.

## 3. Admin login

Open `/admin/login.html`. The page signs in with Supabase Auth and checks the user's `profiles.role`. Only accounts whose role is `admin` can access the admin data.

## Security model

- No service-role key in frontend.
- Products/categories are public-read only through RLS.
- Orders and order items are admin-read/admin-update only.
- Customer information is not publicly selectable.
- COD orders are created through a SECURITY DEFINER PostgreSQL RPC that validates input, recalculates the price server-side and decrements stock inside one transaction with row locks.
- Product images can be read publicly but only authenticated admins can upload/update/delete them.
- Admin browser access is protected by Supabase Auth + the `profiles.role` check.

No web application can honestly be guaranteed to be impossible to hack. This project is hardened against the common mistakes that would expose the database or admin data, but you must also protect your Supabase account, email, password and recovery methods and keep Supabase updated.


## 4. Customer feedback

The storefront includes a public feedback form. New feedback is stored as `pending` and is never shown publicly until an admin approves it. In `/admin/index.html`, open **Feedback** to approve, reject or delete submissions. The `feedback` table is protected with RLS: public users can only insert pending feedback and read approved feedback; only admins can moderate/delete.

## 5. Responsive design

The storefront now includes a dedicated mobile navigation and responsive layouts for phones, tablets, laptops and large desktop screens. Product grids, product pages, cart, checkout, feedback and admin interfaces adapt without horizontal page overflow.

## 6. Additional data tables

The schema now also creates `product_sizes` and `customers` and keeps them synchronized with product stock/order activity.


### V8 responsive updates
- Dedicated portrait mobile hero image: `assets/hero-wagwan-mobile.png` used only up to 767px.
- Product page optimized for phones/tablets.
- Admin dashboard/sidebar/forms/tables optimized for phones and iPads.


## SENDIT
See `SENDIT-SETUP.md` for the complete Sendit delivery integration.


## V11.3 — Dashboard-only Sendit deployment
The six Sendit admin functions are now standalone and can be copied one-by-one into Supabase Dashboard without the shared `_sendit-common.ts` dependency. See `SENDIT-DASHBOARD-DEPLOY.md`.

---

## WAGWAN V12 additions

See `V12-SETUP.md` and run `supabase/wagwan-v12-migration.sql` in Supabase SQL Editor.

V12 adds separate Admin sections for Analytics, Abandoned Carts, Coupons and Loyalty. Analytics uses a persistent anonymous visitor ID and unique event keys. Product views are unique per visitor/product, Add to Cart is unique per visitor, and returning to the site never increments the unique visitor count again.


## V14.2 homepage community layout correction
- Outfit submission form is embedded in the Feedback community three-column row, between public reviews and the feedback form.
- It is no longer a separate section below the FAQ.
- Footer remains logo left, copyright centered, SHOP · ADMIN right.
