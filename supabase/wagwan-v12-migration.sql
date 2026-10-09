-- WAGWAN V12: Analytics + Coupons + Loyalty + Abandoned Cart/Checkout
-- Run AFTER the existing schema + whatsapp/email migrations.
-- Safe to run repeatedly.

create extension if not exists pgcrypto;

-- ---------- Orders: discount / customer / analytics metadata ----------
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists coupon_discount numeric(12,2) not null default 0;
alter table public.orders add column if not exists loyalty_points_used integer not null default 0;
alter table public.orders add column if not exists loyalty_discount numeric(12,2) not null default 0;
alter table public.orders add column if not exists discount_total numeric(12,2) not null default 0;
alter table public.orders add column if not exists visitor_id text;

-- ---------- Analytics ----------
create table if not exists public.analytics_visitors (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null unique,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  event_type text not null check (event_type in ('visit','product_view','add_to_cart','checkout_started','order_created')),
  product_id uuid references public.products(id) on delete set null,
  event_key text not null unique,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_type_created on public.analytics_events(event_type,created_at desc);
create index if not exists idx_analytics_events_visitor on public.analytics_events(visitor_id);
create index if not exists idx_analytics_events_product on public.analytics_events(product_id,event_type);

alter table public.analytics_visitors enable row level security;
alter table public.analytics_events enable row level security;
drop policy if exists "public insert analytics visitors" on public.analytics_visitors;
create policy "public insert analytics visitors" on public.analytics_visitors for insert to anon,authenticated with check (true);
drop policy if exists "public update analytics visitors" on public.analytics_visitors;
create policy "public update analytics visitors" on public.analytics_visitors for update to anon,authenticated using (true) with check (true);
drop policy if exists "admin read analytics visitors" on public.analytics_visitors;
create policy "admin read analytics visitors" on public.analytics_visitors for select to authenticated using (public.is_admin());
drop policy if exists "public insert analytics events" on public.analytics_events;
create policy "public insert analytics events" on public.analytics_events for insert to anon,authenticated with check (true);
drop policy if exists "admin read analytics events" on public.analytics_events;
create policy "admin read analytics events" on public.analytics_events for select to authenticated using (public.is_admin());

-- ---------- Coupons ----------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  expires_at timestamptz,
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  maximum_discount numeric(12,2),
  commission_percent numeric(5,2) not null default 0 check (commission_percent >= 0 and commission_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  visitor_id text,
  discount_amount numeric(12,2) not null default 0,
  order_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_coupon_usages_coupon on public.coupon_usages(coupon_id,created_at desc);

alter table public.coupons enable row level security;
alter table public.coupon_usages enable row level security;
drop policy if exists "public read active coupons" on public.coupons;
create policy "public read active coupons" on public.coupons for select to anon,authenticated using (is_active=true and (expires_at is null or expires_at > now()));
drop policy if exists "admin manage coupons" on public.coupons;
create policy "admin manage coupons" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin read coupon usages" on public.coupon_usages;
create policy "admin read coupon usages" on public.coupon_usages for select to authenticated using (public.is_admin());

-- ---------- Loyalty ----------
create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  full_name text,
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_earned integer not null default 0 check (lifetime_earned >= 0),
  lifetime_redeemed integer not null default 0 check (lifetime_redeemed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type text not null check (type in ('earned','redeemed','adjustment')),
  points integer not null check (points <> 0),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_loyalty_transactions_account on public.loyalty_transactions(account_id,created_at desc);

alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
drop policy if exists "admin read loyalty accounts" on public.loyalty_accounts;
create policy "admin read loyalty accounts" on public.loyalty_accounts for select to authenticated using (public.is_admin());
drop policy if exists "admin manage loyalty accounts" on public.loyalty_accounts;
create policy "admin manage loyalty accounts" on public.loyalty_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin read loyalty transactions" on public.loyalty_transactions;
create policy "admin read loyalty transactions" on public.loyalty_transactions for select to authenticated using (public.is_admin());

-- Public RPC only returns the balance for the supplied phone; no table SELECT is exposed.
create or replace function public.get_loyalty_balance(p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.loyalty_accounts%rowtype;
begin
  select * into a from public.loyalty_accounts where phone=trim(p_phone);
  if not found then return jsonb_build_object('points',0,'discount_dh',0); end if;
  return jsonb_build_object('points',a.points_balance,'discount_dh',a.points_balance);
end; $$;
revoke all on function public.get_loyalty_balance(text) from public;
grant execute on function public.get_loyalty_balance(text) to anon,authenticated;

-- ---------- Abandoned cart / checkout lead ----------
create table if not exists public.wagwan_cart_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null unique,
  cart_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  checkout_started boolean not null default false,
  status text not null default 'active' check (status in ('active','abandoned','converted')),
  order_id uuid references public.orders(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  abandoned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checkout_leads (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  phone text not null,
  email text,
  first_name text,
  last_name text,
  address text,
  city text,
  cart_items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  status text not null default 'active' check (status in ('active','abandoned','converted')),
  last_activity_at timestamptz not null default now(),
  abandoned_at timestamptz,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_checkout_leads_active_phone on public.checkout_leads(phone) where status in ('active','abandoned');

alter table public.wagwan_cart_sessions enable row level security;
alter table public.checkout_leads enable row level security;
drop policy if exists "admin read cart sessions" on public.wagwan_cart_sessions;
create policy "admin read cart sessions" on public.wagwan_cart_sessions for select to authenticated using (public.is_admin());
drop policy if exists "admin read checkout leads" on public.checkout_leads;
create policy "admin read checkout leads" on public.checkout_leads for select to authenticated using (public.is_admin());

create or replace function public.save_cart_session(p_visitor_id text,p_cart_items jsonb,p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.wagwan_cart_sessions(visitor_id,cart_items,subtotal,checkout_started,status,last_activity_at,updated_at)
  values(p_visitor_id,coalesce(p_cart_items,'[]'::jsonb),greatest(coalesce(p_subtotal,0),0),false,'active',now(),now())
  on conflict(visitor_id) do update set cart_items=excluded.cart_items,subtotal=excluded.subtotal,last_activity_at=now(),updated_at=now(),status=case when jsonb_array_length(excluded.cart_items)>0 then 'active' else 'active' end,abandoned_at=null;
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.save_cart_session(text,jsonb,numeric) from public;
grant execute on function public.save_cart_session(text,jsonb,numeric) to anon,authenticated;

create or replace function public.save_checkout_lead(p_visitor_id text,p_phone text,p_email text,p_first_name text,p_last_name text,p_address text,p_city text,p_cart_items jsonb,p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.checkout_leads(visitor_id,phone,email,first_name,last_name,address,city,cart_items,subtotal,status,last_activity_at,updated_at)
  values(trim(p_visitor_id),trim(p_phone),nullif(trim(p_email),''),nullif(trim(p_first_name),''),nullif(trim(p_last_name),''),nullif(trim(p_address),''),nullif(trim(p_city),''),coalesce(p_cart_items,'[]'::jsonb),greatest(coalesce(p_subtotal,0),0),'active',now(),now())
  on conflict(phone) where status in ('active','abandoned') do update set visitor_id=excluded.visitor_id,email=excluded.email,first_name=excluded.first_name,last_name=excluded.last_name,address=excluded.address,city=excluded.city,cart_items=excluded.cart_items,subtotal=excluded.subtotal,status='active',last_activity_at=now(),abandoned_at=null,updated_at=now();
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.save_checkout_lead(text,text,text,text,text,text,text,jsonb,numeric) from public;
grant execute on function public.save_checkout_lead(text,text,text,text,text,text,text,jsonb,numeric) to anon,authenticated;

-- ---------- Loyalty: 1 delivered order = 5 points; 5 points = 5 DH ----------
create or replace function public.award_loyalty_for_delivered_order()
returns trigger language plpgsql security definer set search_path=public as $$
declare a public.loyalty_accounts%rowtype;
begin
  if NEW.status='delivered' and OLD.status is distinct from 'delivered' then
    insert into public.loyalty_accounts(phone,full_name,points_balance,lifetime_earned,updated_at)
    values(NEW.phone,trim(NEW.first_name||' '||NEW.last_name),5,5,now())
    on conflict(phone) do update set full_name=excluded.full_name,points_balance=public.loyalty_accounts.points_balance+5,lifetime_earned=public.loyalty_accounts.lifetime_earned+5,updated_at=now()
    returning * into a;
    insert into public.loyalty_transactions(account_id,order_id,type,points,note)
    values(a.id,NEW.id,'earned',5,'5 points for delivered order');
  end if;
  return NEW;
end; $$;
drop trigger if exists trg_award_loyalty_delivered on public.orders;
create trigger trg_award_loyalty_delivered after update of status on public.orders for each row execute function public.award_loyalty_for_delivered_order();

-- ---------- New order RPC with coupon + loyalty support ----------
create or replace function public.create_cod_order(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_city text,
  p_items jsonb,
  p_coupon_code text default null,
  p_loyalty_points integer default 0,
  p_visitor_id text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  item jsonb; p public.products%rowtype; o public.orders%rowtype; c public.coupons%rowtype; a public.loyalty_accounts%rowtype;
  requested_size text; requested_qty integer; current_stock integer;
  sub numeric(12,2):=0; ship numeric(12,2):=0; coupon_discount numeric(12,2):=0; loyalty_discount numeric(12,2):=0; final_total numeric(12,2):=0;
  coupon text:=nullif(upper(trim(p_coupon_code)),''); lp integer:=greatest(coalesce(p_loyalty_points,0),0);
begin
  if length(trim(p_first_name)) not between 1 and 80 or length(trim(p_last_name)) not between 1 and 80 then raise exception 'Invalid name'; end if;
  if length(trim(p_address)) not between 1 and 300 or length(trim(p_city)) not between 1 and 100 then raise exception 'Invalid address or city'; end if;
  if trim(p_phone) !~ '^(\\+212|0)[67][0-9]{8}$' then raise exception 'Invalid Moroccan phone number'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>30 then raise exception 'Invalid cart'; end if;
  if lp % 5 <> 0 then raise exception 'Loyalty points must be used in multiples of 5'; end if;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into p from public.products where id=(item->>'product_id')::uuid and is_active=true for update;
    if not found then raise exception 'Product not available'; end if;
    requested_size:=upper(item->>'size'); requested_qty:=(item->>'quantity')::integer;
    if requested_size not in ('S','M','L','XL') or requested_qty<1 or requested_qty>50 then raise exception 'Invalid item'; end if;
    current_stock:=case requested_size when 'S' then p.stock_s when 'M' then p.stock_m when 'L' then p.stock_l else p.stock_xl end;
    if current_stock<requested_qty then raise exception 'Out of stock: % size %',p.name,requested_size; end if;
    sub:=sub+(p.price*requested_qty);
  end loop;

  if coupon is not null then
    select * into c from public.coupons where code=coupon for update;
    if not found or not c.is_active then raise exception 'Invalid coupon'; end if;
    if c.expires_at is not null and c.expires_at<=now() then raise exception 'Coupon expired'; end if;
    if c.max_uses is not null and c.uses_count>=c.max_uses then raise exception 'Coupon usage limit reached'; end if;
    if sub<c.minimum_order then raise exception 'Minimum order for this coupon is % DH',c.minimum_order; end if;
    coupon_discount:=round(sub*c.discount_percent/100,2);
    if c.maximum_discount is not null then coupon_discount:=least(coupon_discount,c.maximum_discount); end if;
  end if;

  if lp>0 then
    select * into a from public.loyalty_accounts where phone=trim(p_phone) for update;
    if not found or a.points_balance<lp then raise exception 'Not enough WAGWAN points'; end if;
    loyalty_discount:=least(lp::numeric,greatest(sub-coupon_discount,0));
    loyalty_discount:=floor(loyalty_discount/5)*5;
    lp:=loyalty_discount::integer;
  end if;

  final_total:=greatest(sub+ship-coupon_discount-loyalty_discount,0);
  insert into public.orders(first_name,last_name,phone,customer_email,address,city,status,payment_method,subtotal,shipping,total,coupon_code,coupon_discount,loyalty_points_used,loyalty_discount,discount_total,visitor_id)
  values(trim(p_first_name),trim(p_last_name),trim(p_phone),nullif(lower(trim(p_email)),''),trim(p_address),trim(p_city),'pending','COD',sub,ship,final_total,coupon,coupon_discount,lp,loyalty_discount,coupon_discount+loyalty_discount,nullif(trim(p_visitor_id),''))
  returning * into o;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into p from public.products where id=(item->>'product_id')::uuid for update;
    requested_size:=upper(item->>'size'); requested_qty:=(item->>'quantity')::integer;
    insert into public.order_items(order_id,product_id,product_name,product_image_url,size,quantity,unit_price,line_total) values(o.id,p.id,p.name,p.main_image_url,requested_size,requested_qty,p.price,p.price*requested_qty);
    case requested_size when 'S' then update public.products set stock_s=stock_s-requested_qty,updated_at=now() where id=p.id; when 'M' then update public.products set stock_m=stock_m-requested_qty,updated_at=now() where id=p.id; when 'L' then update public.products set stock_l=stock_l-requested_qty,updated_at=now() where id=p.id; when 'XL' then update public.products set stock_xl=stock_xl-requested_qty,updated_at=now() where id=p.id; end case;
  end loop;

  if coupon is not null then
    update public.coupons set uses_count=uses_count+1,updated_at=now() where id=c.id;
    insert into public.coupon_usages(coupon_id,order_id,visitor_id,discount_amount,order_total) values(c.id,o.id,nullif(trim(p_visitor_id),''),coupon_discount,o.total);
  end if;
  if lp>0 then
    update public.loyalty_accounts set points_balance=points_balance-lp,lifetime_redeemed=lifetime_redeemed+lp,updated_at=now() where id=a.id;
    insert into public.loyalty_transactions(account_id,order_id,type,points,note) values(a.id,o.id,'redeemed',-lp,'Points redeemed at checkout');
  end if;
  if p_visitor_id is not null then
    update public.wagwan_cart_sessions set status='converted',order_id=o.id,last_activity_at=now(),updated_at=now() where visitor_id=p_visitor_id;
    update public.checkout_leads set status='converted',order_id=o.id,last_activity_at=now(),updated_at=now() where visitor_id=p_visitor_id and status in ('active','abandoned');
    insert into public.analytics_events(visitor_id,event_type,event_key,metadata) values(p_visitor_id,'order_created',p_visitor_id||':order:'||o.id::text,jsonb_build_object('order_id',o.id,'order_number',o.order_number)) on conflict(event_key) do nothing;
  end if;
  return jsonb_build_object('id',o.id,'order_number',o.order_number,'total',o.total,'coupon_discount',coupon_discount,'loyalty_discount',loyalty_discount,'loyalty_points_used',lp,'phone',p_phone);
end; $$;
revoke all on function public.create_cod_order(text,text,text,text,text,text,jsonb,text,integer,text) from public;
grant execute on function public.create_cod_order(text,text,text,text,text,text,jsonb,text,integer,text) to anon,authenticated;

-- ---------- Realtime ----------
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.analytics_visitors'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.analytics_events'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.coupons'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.coupon_usages'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.loyalty_accounts'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.wagwan_cart_sessions'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.checkout_leads'; exception when duplicate_object then null; end;
end $$;

-- Useful admin view for coupon analytics.
create or replace view public.coupon_analytics as
select c.id,c.code,c.discount_percent,c.max_uses,c.uses_count,c.commission_percent,c.expires_at,c.is_active,c.created_at,
       count(cu.id)::integer as orders_used,
       coalesce(sum(cu.order_total),0)::numeric(12,2) as revenue_from_coupon_orders,
       coalesce(sum(cu.discount_amount),0)::numeric(12,2) as discounts_given,
       (coalesce(sum(cu.order_total),0)*c.commission_percent/100)::numeric(12,2) as commission
from public.coupons c left join public.coupon_usages cu on cu.coupon_id=c.id
where public.is_admin() group by c.id;


grant select on public.coupon_analytics to authenticated;


-- ---------- Admin settings ----------
create table if not exists public.admin_settings (
  id text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security;
drop policy if exists "admin manage settings" on public.admin_settings;
create policy "admin manage settings" on public.admin_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Welcome 5% WhatsApp lead capture ----------
alter table public.analytics_visitors add column if not exists phone text;
alter table public.wagwan_cart_sessions add column if not exists phone text;
create index if not exists idx_analytics_visitors_phone on public.analytics_visitors(phone);
create index if not exists idx_wagwan_cart_sessions_phone on public.wagwan_cart_sessions(phone);

create table if not exists public.welcome_discount_claims (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null unique,
  phone text not null unique,
  coupon_id uuid unique references public.coupons(id) on delete restrict,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Compatibility for projects where the table already existed with an older shape.
alter table public.welcome_discount_claims add column if not exists updated_at timestamptz not null default now();
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='welcome_discount_claims' and column_name='coupon_id') then
    alter table public.welcome_discount_claims alter column coupon_id drop not null;
  end if;
end $$;
alter table public.analytics_visitors add column if not exists last_seen timestamptz not null default now();
alter table public.welcome_discount_claims enable row level security;
drop policy if exists "admin read welcome discount claims" on public.welcome_discount_claims;
create policy "admin read welcome discount claims" on public.welcome_discount_claims for select to authenticated using (public.is_admin());

drop index if exists ux_welcome_discount_phone;
create unique index if not exists ux_welcome_discount_phone on public.welcome_discount_claims(phone);

create or replace function public.claim_welcome_discount(p_visitor_id text,p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  clean_phone text:=trim(p_phone);
  existing public.welcome_discount_claims%rowtype;
  new_coupon public.coupons%rowtype;
  code text;
begin
  if p_visitor_id is null or length(trim(p_visitor_id))<4 then raise exception 'Invalid visitor'; end if;
  if clean_phone !~ '^(\\+212|0)[67][0-9]{8}$' then raise exception 'Invalid Moroccan phone number'; end if;

  select * into existing from public.welcome_discount_claims where visitor_id=trim(p_visitor_id) or phone=clean_phone limit 1;
  if found then
    update public.analytics_visitors set phone=existing.phone,last_seen_at=now() where visitor_id=trim(p_visitor_id);
    update public.wagwan_cart_sessions set phone=existing.phone,updated_at=now() where visitor_id=trim(p_visitor_id);
    update public.checkout_leads set phone=existing.phone,updated_at=now(),last_activity_at=now() where visitor_id=trim(p_visitor_id) and status in ('active','abandoned');
    select * into new_coupon from public.coupons where id=existing.coupon_id;
    return jsonb_build_object('ok',true,'already_claimed',true,'phone',existing.phone,'code',new_coupon.code);
  end if;

  loop
    code:='W5-'||upper(substr(encode(gen_random_bytes(5),'hex'),1,8));
    begin
      insert into public.coupons(code,discount_percent,max_uses,uses_count,expires_at,minimum_order,commission_percent,is_active)
      values(code,5,1,0,now()+interval '30 days',0,0,true)
      returning * into new_coupon;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.welcome_discount_claims(visitor_id,phone,coupon_id)
  values(trim(p_visitor_id),clean_phone,new_coupon.id);

  insert into public.analytics_visitors(visitor_id,phone,last_seen_at)
  values(trim(p_visitor_id),clean_phone,now())
  on conflict(visitor_id) do update set phone=excluded.phone,last_seen_at=now();

  update public.wagwan_cart_sessions set phone=clean_phone,updated_at=now(),last_activity_at=now() where visitor_id=trim(p_visitor_id);
  update public.checkout_leads set phone=clean_phone,updated_at=now(),last_activity_at=now() where visitor_id=trim(p_visitor_id) and status in ('active','abandoned');

  return jsonb_build_object('ok',true,'already_claimed',false,'phone',clean_phone,'code',new_coupon.code,'coupon_id',new_coupon.id);
end; $$;
revoke all on function public.claim_welcome_discount(text,text) from public;
grant execute on function public.claim_welcome_discount(text,text) to anon,authenticated;

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.welcome_discount_claims'; exception when duplicate_object then null; end;
end $$;

-- ---------- V13: visitor phone capture, abandoned-cart categories and live presence ----------
alter table public.wagwan_cart_sessions add column if not exists lead_type text not null default 'anonymous';
alter table public.wagwan_cart_sessions drop constraint if exists wagwan_cart_sessions_lead_type_check;
alter table public.wagwan_cart_sessions add constraint wagwan_cart_sessions_lead_type_check check (lead_type in ('anonymous','number_promo','checkout'));
alter table public.welcome_discount_claims alter column coupon_id drop not null;
create index if not exists idx_cart_sessions_lead_type on public.wagwan_cart_sessions(lead_type);

create or replace function public.save_cart_session(p_visitor_id text,p_cart_items jsonb,p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare existing_lead text;
begin
  select lead_type into existing_lead from public.wagwan_cart_sessions where visitor_id=trim(p_visitor_id);
  insert into public.wagwan_cart_sessions(visitor_id,cart_items,subtotal,checkout_started,status,last_activity_at,updated_at,lead_type)
  values(trim(p_visitor_id),coalesce(p_cart_items,'[]'::jsonb),greatest(coalesce(p_subtotal,0),0),false,'active',now(),now(),coalesce(existing_lead,'anonymous'))
  on conflict(visitor_id) do update set
    cart_items=excluded.cart_items,
    subtotal=excluded.subtotal,
    last_activity_at=now(),
    updated_at=now(),
    status='active',
    abandoned_at=null,
    lead_type=case when public.wagwan_cart_sessions.lead_type in ('number_promo','checkout') then public.wagwan_cart_sessions.lead_type else 'anonymous' end;
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.save_cart_session(text,jsonb,numeric) from public;
grant execute on function public.save_cart_session(text,jsonb,numeric) to anon,authenticated;

create or replace function public.save_checkout_lead(p_visitor_id text,p_phone text,p_email text,p_first_name text,p_last_name text,p_address text,p_city text,p_cart_items jsonb,p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  insert into public.checkout_leads(visitor_id,phone,email,first_name,last_name,address,city,cart_items,subtotal,status,last_activity_at,updated_at)
  values(trim(p_visitor_id),trim(p_phone),nullif(trim(p_email),''),nullif(trim(p_first_name),''),nullif(trim(p_last_name),''),nullif(trim(p_address),''),nullif(trim(p_city),''),coalesce(p_cart_items,'[]'::jsonb),greatest(coalesce(p_subtotal,0),0),'active',now(),now())
  on conflict(phone) where status in ('active','abandoned') do update set
    visitor_id=excluded.visitor_id,email=excluded.email,first_name=excluded.first_name,last_name=excluded.last_name,address=excluded.address,city=excluded.city,cart_items=excluded.cart_items,subtotal=excluded.subtotal,status='active',last_activity_at=now(),abandoned_at=null,updated_at=now();
  update public.wagwan_cart_sessions
    set phone=trim(p_phone),lead_type='checkout',checkout_started=true,status='active',last_activity_at=now(),updated_at=now(),abandoned_at=null
    where visitor_id=trim(p_visitor_id);
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.save_checkout_lead(text,text,text,text,text,text,text,jsonb,numeric) from public;
grant execute on function public.save_checkout_lead(text,text,text,text,text,text,text,jsonb,numeric) to anon,authenticated;

create or replace function public.mark_cart_presence(p_visitor_id text,p_active boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  update public.wagwan_cart_sessions
  set status=case when p_active then 'active' else 'abandoned' end,
      last_activity_at=now(),
      updated_at=now(),
      abandoned_at=case when p_active then null else coalesce(abandoned_at,now()) end
  where visitor_id=trim(p_visitor_id) and jsonb_array_length(coalesce(cart_items,'[]'::jsonb))>0;

  update public.checkout_leads
  set status=case when p_active then 'active' else 'abandoned' end,
      last_activity_at=now(),
      updated_at=now(),
      abandoned_at=case when p_active then null else coalesce(abandoned_at,now()) end
  where visitor_id=trim(p_visitor_id) and status in ('active','abandoned');

  return jsonb_build_object('ok',true,'active',p_active);
end; $$;
revoke all on function public.mark_cart_presence(text,boolean) from public;
grant execute on function public.mark_cart_presence(text,boolean) to anon,authenticated;

create or replace function public.claim_welcome_discount(p_visitor_id text,p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  clean_phone text:=trim(p_phone);
  existing public.welcome_discount_claims%rowtype;
begin
  if p_visitor_id is null or length(trim(p_visitor_id))<4 then raise exception 'Invalid visitor'; end if;
  if clean_phone !~ '^(\\+212|0)[67][0-9]{8}$' then raise exception 'Invalid Moroccan phone number'; end if;

  select * into existing from public.welcome_discount_claims where visitor_id=trim(p_visitor_id) or phone=clean_phone limit 1;
  if found then
    update public.analytics_visitors set phone=clean_phone,last_seen_at=now() where visitor_id=trim(p_visitor_id);
    update public.wagwan_cart_sessions set phone=clean_phone,lead_type='number_promo',updated_at=now(),last_activity_at=now() where visitor_id=trim(p_visitor_id);
    return jsonb_build_object('ok',true,'already_claimed',true,'phone',clean_phone,'manual_code',true);
  end if;

  insert into public.welcome_discount_claims(visitor_id,phone,coupon_id)
  values(trim(p_visitor_id),clean_phone,null);

  insert into public.analytics_visitors(visitor_id,phone,last_seen_at)
  values(trim(p_visitor_id),clean_phone,now())
  on conflict(visitor_id) do update set phone=excluded.phone,last_seen_at=now();

  update public.wagwan_cart_sessions set phone=clean_phone,lead_type='number_promo',updated_at=now(),last_activity_at=now() where visitor_id=trim(p_visitor_id);
  update public.checkout_leads set phone=clean_phone,updated_at=now(),last_activity_at=now() where visitor_id=trim(p_visitor_id) and status in ('active','abandoned');

  return jsonb_build_object('ok',true,'already_claimed',false,'phone',clean_phone,'manual_code',true);
end; $$;
revoke all on function public.claim_welcome_discount(text,text) from public;
grant execute on function public.claim_welcome_discount(text,text) to anon,authenticated;

-- V13 follow-up: preserve a promo-lead phone even when the visitor adds the cart after claiming the popup.
create or replace function public.save_cart_session(p_visitor_id text,p_cart_items jsonb,p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare existing_lead text; existing_phone text;
begin
  select lead_type,phone into existing_lead,existing_phone from public.wagwan_cart_sessions where visitor_id=trim(p_visitor_id);
  if existing_phone is null then
    select phone into existing_phone from public.analytics_visitors where visitor_id=trim(p_visitor_id);
  end if;
  if existing_lead is null then existing_lead:=case when existing_phone is not null then 'number_promo' else 'anonymous' end; end if;
  insert into public.wagwan_cart_sessions(visitor_id,phone,cart_items,subtotal,checkout_started,status,last_activity_at,updated_at,lead_type)
  values(trim(p_visitor_id),existing_phone,coalesce(p_cart_items,'[]'::jsonb),greatest(coalesce(p_subtotal,0),0),false,'active',now(),now(),existing_lead)
  on conflict(visitor_id) do update set
    phone=coalesce(public.wagwan_cart_sessions.phone,excluded.phone),
    cart_items=excluded.cart_items,
    subtotal=excluded.subtotal,
    last_activity_at=now(),
    updated_at=now(),
    status='active',
    abandoned_at=null,
    lead_type=case when public.wagwan_cart_sessions.lead_type in ('number_promo','checkout') then public.wagwan_cart_sessions.lead_type else excluded.lead_type end;
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.save_cart_session(text,jsonb,numeric) from public;
grant execute on function public.save_cart_session(text,jsonb,numeric) to anon,authenticated;
