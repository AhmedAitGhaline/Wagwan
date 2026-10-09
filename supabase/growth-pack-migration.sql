-- WAGWAN Growth Pack migration (additive/idempotent)
create extension if not exists pgcrypto;

create table if not exists public.wagwan_store_settings (
  id integer primary key default 1 check (id = 1),
  instagram_url text not null default '',
  tiktok_url text not null default '',
  social_feed_enabled boolean not null default false,
  bundle_enabled boolean not null default true,
  bundle_qty integer not null default 2,
  bundle_discount_percent numeric(5,2) not null default 10,
  free_shipping_threshold numeric(10,2) not null default 0,
  loyalty_photo_review_points integer not null default 5,
  updated_at timestamptz not null default now()
);
insert into public.wagwan_store_settings(id) values (1) on conflict(id) do nothing;

-- Configurable number used only by the storefront's floating WhatsApp button.
alter table public.wagwan_store_settings
  add column if not exists whatsapp_sticky_phone text not null default '212618175188';

create table if not exists public.wagwan_size_waitlist (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  product_name text not null,
  size text not null check(size in ('S','M','L','XL')),
  phone text not null,
  email text,
  status text not null default 'waiting' check(status in ('waiting','notified','fulfilled','cancelled')),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique(product_id,size,phone)
);

create table if not exists public.wagwan_photo_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  product_name text,
  customer_name text not null,
  phone text,
  rating integer check(rating between 1 and 5),
  comment text,
  photo_url text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  points_awarded boolean not null default false,
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create table if not exists public.wagwan_affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  code text not null unique,
  commission_percent numeric(5,2) not null default 10 check(commission_percent between 0 and 100),
  access_pin_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.wagwan_affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.wagwan_affiliates(id) on delete cascade,
  order_id uuid,
  order_code text,
  order_total numeric(10,2) not null default 0,
  commission_amount numeric(10,2) not null default 0,
  status text not null default 'pending' check(status in ('pending','approved','paid','cancelled')),
  created_at timestamptz not null default now(),
  unique(affiliate_id,order_id)
);

create table if not exists public.wagwan_cod_confirmation_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  order_code text,
  phone text not null,
  status text not null default 'awaiting_confirmation' check(status in ('awaiting_confirmation','confirmed','cancelled','reminder_queued','reminder_sent','delivered','refused')),
  risk_score integer not null default 0,
  risk_label text not null default 'normal' check(risk_label in ('normal','watch','high_risk')),
  reminder_due_at timestamptz,
  reminder_sent_at timestamptz,
  response_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wagwan_cod_phone_idx on public.wagwan_cod_confirmation_events(phone);

-- Public, read-only store settings. Public form tables only permit insert; moderation/admin access is authenticated.
alter table public.wagwan_store_settings enable row level security;
alter table public.wagwan_size_waitlist enable row level security;
alter table public.wagwan_photo_reviews enable row level security;
alter table public.wagwan_affiliates enable row level security;
alter table public.wagwan_affiliate_commissions enable row level security;
alter table public.wagwan_cod_confirmation_events enable row level security;

drop policy if exists "public can read store settings" on public.wagwan_store_settings;
create policy "public can read store settings" on public.wagwan_store_settings for select to anon, authenticated using (true);
drop policy if exists "authenticated can insert store settings" on public.wagwan_store_settings;
create policy "authenticated can insert store settings" on public.wagwan_store_settings for insert to authenticated with check (public.is_admin());
drop policy if exists "authenticated can update store settings" on public.wagwan_store_settings;
create policy "authenticated can update store settings" on public.wagwan_store_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public can join size waitlist" on public.wagwan_size_waitlist;
create policy "public can join size waitlist" on public.wagwan_size_waitlist for insert to anon, authenticated with check (length(phone) between 9 and 20);
drop policy if exists "authenticated can manage size waitlist" on public.wagwan_size_waitlist;
create policy "authenticated can manage size waitlist" on public.wagwan_size_waitlist for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public can submit photo review" on public.wagwan_photo_reviews;
create policy "public can submit photo review" on public.wagwan_photo_reviews for insert to anon, authenticated with check (status = 'pending' and points_awarded = false);
drop policy if exists "public can read approved photo reviews" on public.wagwan_photo_reviews;
create policy "public can read approved photo reviews" on public.wagwan_photo_reviews for select to anon, authenticated using (status = 'approved');
drop policy if exists "authenticated can manage photo reviews" on public.wagwan_photo_reviews;
create policy "authenticated can manage photo reviews" on public.wagwan_photo_reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Affiliate identity/contact data and commission records are not public-readable. Dashboard is a secure admin-only area until affiliate authentication is configured.
drop policy if exists "authenticated can manage affiliates" on public.wagwan_affiliates;
create policy "authenticated can manage affiliates" on public.wagwan_affiliates for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "authenticated can manage affiliate commissions" on public.wagwan_affiliate_commissions;
create policy "authenticated can manage affiliate commissions" on public.wagwan_affiliate_commissions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "authenticated can manage COD events" on public.wagwan_cod_confirmation_events;
create policy "authenticated can manage COD events" on public.wagwan_cod_confirmation_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Photo outfit submissions do not contain a rating or written review.
alter table public.wagwan_photo_reviews alter column rating drop not null;
alter table public.wagwan_photo_reviews alter column comment drop not null;

-- Remove the deprecated COD reminder scheduler configuration from existing projects.
alter table public.wagwan_store_settings drop column if exists cod_reminder_enabled;
alter table public.wagwan_store_settings drop column if exists cod_reminder_hours;
alter table public.wagwan_store_settings drop column if exists language_default;
alter table public.wagwan_cod_confirmation_events drop column if exists reminder_due_at;
alter table public.wagwan_cod_confirmation_events drop column if exists reminder_sent_at;

-- Retire reminder-only states while preserving COD risk history.
update public.wagwan_cod_confirmation_events set status='awaiting_confirmation' where status in ('reminder_queued','reminder_sent');
alter table public.wagwan_cod_confirmation_events drop constraint if exists wagwan_cod_confirmation_events_status_check;
alter table public.wagwan_cod_confirmation_events add constraint wagwan_cod_confirmation_events_status_check check(status in ('awaiting_confirmation','confirmed','cancelled','delivered','refused'));
