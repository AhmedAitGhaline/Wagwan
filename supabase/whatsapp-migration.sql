-- WAGWAN WhatsApp instant confirmation migration
-- Run after the existing WAGWAN schema.

alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists confirmed_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
-- No 10-minute delay is used. The order-insert Database Webhook calls the Edge Function immediately.

create table if not exists public.whatsapp_order_confirmations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_phone text not null,
  status text not null default 'sending' check (status in ('sending','sent','confirmed','cancelled','failed')),
  message_id text,
  sent_at timestamptz,
  responded_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_confirmation_phone_status on public.whatsapp_order_confirmations(customer_phone,status);
create index if not exists idx_whatsapp_confirmation_order on public.whatsapp_order_confirmations(order_id);

alter table public.whatsapp_order_confirmations enable row level security;
drop policy if exists "admin read whatsapp confirmations" on public.whatsapp_order_confirmations;
create policy "admin read whatsapp confirmations" on public.whatsapp_order_confirmations for select to authenticated using (public.is_admin());

-- Atomic transition from pending -> confirmed/cancelled.
-- The existing WAGWAN order RPC already decrements stock when the order is created.
-- Therefore cancellation restores the exact quantities; confirmation leaves stock consumed.
create or replace function public.handle_whatsapp_order_response(
  p_order_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  item record;
  next_status public.order_status;
  result jsonb;
begin
  if p_action not in ('confirmed','cancelled') then raise exception 'Invalid WhatsApp action'; end if;

  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if o.status <> 'pending' then
    return jsonb_build_object('ok',false,'reason','order-already-closed','order',to_jsonb(o));
  end if;

  next_status := case when p_action='confirmed' then 'confirmed'::public.order_status else 'cancelled'::public.order_status end;

  if next_status='cancelled' then
    for item in select * from public.order_items where order_id=o.id loop
      if item.size='S' then
        update public.products set stock_s=stock_s+item.quantity,updated_at=now() where id=item.product_id;
      elsif item.size='M' then
        update public.products set stock_m=stock_m+item.quantity,updated_at=now() where id=item.product_id;
      elsif item.size='L' then
        update public.products set stock_l=stock_l+item.quantity,updated_at=now() where id=item.product_id;
      elsif item.size='XL' then
        update public.products set stock_xl=stock_xl+item.quantity,updated_at=now() where id=item.product_id;
      end if;
    end loop;
  end if;

  if next_status='confirmed' then
    update public.orders set status='confirmed',updated_at=now(),confirmed_at=now() where id=o.id returning * into o;
  else
    update public.orders set status='cancelled',updated_at=now(),cancelled_at=now() where id=o.id returning * into o;
  end if;

  update public.whatsapp_order_confirmations
  set status=p_action,responded_at=now(),updated_at=now()
  where order_id=o.id;

  result := jsonb_build_object('ok',true,'order',to_jsonb(o));
  return result;
end;
$$;

revoke all on function public.handle_whatsapp_order_response(uuid,text) from public;
revoke all on function public.handle_whatsapp_order_response(uuid,text) from anon;
revoke all on function public.handle_whatsapp_order_response(uuid,text) from authenticated;

-- The Edge Function uses the service role and can execute this function.
grant execute on function public.handle_whatsapp_order_response(uuid,text) to service_role;

-- IMPORTANT: create a Supabase Database Webhook in Dashboard:
-- Table: public.orders
-- Event: INSERT
-- URL: https://pjxdaiqnvunjaasmmten.supabase.co/functions/v1/whatsapp-order-confirmation
-- Header: x-wagwan-webhook-secret = the same value as WAGWAN_INTERNAL_WEBHOOK_SECRET
-- This makes WhatsApp sending immediate after the order is inserted.

-- ============================================================
-- V10.1: ROBUST MOROCCAN PHONE NORMALIZATION
-- Accepts common customer input formats and stores 2126.../2127...
-- Supports Latin, Arabic-Indic and Persian digits.
-- WhatsApp storefront flow intentionally targets Moroccan mobile
-- numbers (06/07, +212 6/7). Moroccan landlines (05) are not
-- treated as WhatsApp mobile numbers by this flow.
-- ============================================================

create or replace function public.normalize_moroccan_phone(p_input text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
  local text;
begin
  if p_input is null then
    return null;
  end if;

  -- Convert Arabic-Indic and Persian digits to ASCII digits.
  digits := translate(
    trim(p_input),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );

  -- Remove spaces, +, -, parentheses, dots, slashes, etc.
  digits := regexp_replace(digits, '[^0-9]', '', 'g');

  -- 00 212... / 00212... -> 212...
  if left(digits, 2) = '00' then
    digits := substring(digits from 3);
  end if;

  -- +212 6..., 212 6..., 00212 6..., and forgiving 212 06...
  if left(digits, 3) = '212' then
    local := substring(digits from 4);
    if left(local, 1) = '0' then
      local := substring(local from 2);
    end if;
    if local ~ '^[67][0-9]{8}$' then
      return '212' || local;
    end if;
    return null;
  end if;

  -- 06XXXXXXXX / 07XXXXXXXX
  if digits ~ '^0[67][0-9]{8}$' then
    return '212' || substring(digits from 2);
  end if;

  -- 6XXXXXXXX / 7XXXXXXXX
  if digits ~ '^[67][0-9]{8}$' then
    return '212' || digits;
  end if;

  return null;
end;
$$;

revoke all on function public.normalize_moroccan_phone(text) from public;
grant execute on function public.normalize_moroccan_phone(text) to anon, authenticated, service_role;

-- Replace the COD RPC so validation and storage use the same canonical format.
create or replace function public.create_cod_order(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  p public.products%rowtype;
  o public.orders%rowtype;
  requested_size text;
  requested_qty integer;
  current_stock integer;
  sub numeric(12,2) := 0;
  ship numeric(12,2) := 0;
  normalized_phone text;
begin
  if length(trim(p_first_name)) not between 1 and 80
     or length(trim(p_last_name)) not between 1 and 80 then
    raise exception 'Invalid name';
  end if;

  if length(trim(p_address)) not between 1 and 300
     or length(trim(p_city)) not between 1 and 100 then
    raise exception 'Invalid address or city';
  end if;

  normalized_phone := public.normalize_moroccan_phone(p_phone);
  if normalized_phone is null then
    raise exception 'Invalid Moroccan mobile phone number';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items)=0
     or jsonb_array_length(p_items)>30 then
    raise exception 'Invalid cart';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into p
    from public.products
    where id=(item->>'product_id')::uuid
      and is_active=true
    for update;

    if not found then
      raise exception 'Product not available';
    end if;

    requested_size := upper(item->>'size');
    requested_qty := (item->>'quantity')::integer;

    if requested_size not in ('S','M','L','XL')
       or requested_qty < 1
       or requested_qty > 50 then
      raise exception 'Invalid item';
    end if;

    current_stock := case requested_size
      when 'S' then p.stock_s
      when 'M' then p.stock_m
      when 'L' then p.stock_l
      else p.stock_xl
    end;

    if current_stock < requested_qty then
      raise exception 'Out of stock: % size %', p.name, requested_size;
    end if;

    sub := sub + (p.price * requested_qty);
  end loop;

  insert into public.orders(
    first_name,last_name,phone,address,city,status,payment_method,
    subtotal,shipping,total
  )
  values(
    trim(p_first_name),trim(p_last_name),normalized_phone,trim(p_address),
    trim(p_city),'pending','COD',sub,ship,sub+ship
  )
  returning * into o;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into p
    from public.products
    where id=(item->>'product_id')::uuid
    for update;

    requested_size := upper(item->>'size');
    requested_qty := (item->>'quantity')::integer;

    insert into public.order_items(
      order_id,product_id,product_name,product_image_url,size,
      quantity,unit_price,line_total
    )
    values(
      o.id,p.id,p.name,p.main_image_url,requested_size,
      requested_qty,p.price,p.price*requested_qty
    );

    case requested_size
      when 'S' then
        update public.products
        set stock_s=stock_s-requested_qty,updated_at=now()
        where id=p.id;
      when 'M' then
        update public.products
        set stock_m=stock_m-requested_qty,updated_at=now()
        where id=p.id;
      when 'L' then
        update public.products
        set stock_l=stock_l-requested_qty,updated_at=now()
        where id=p.id;
      when 'XL' then
        update public.products
        set stock_xl=stock_xl-requested_qty,updated_at=now()
        where id=p.id;
    end case;
  end loop;

  return jsonb_build_object(
    'id',o.id,
    'order_number',o.order_number,
    'total',o.total,
    'phone',normalized_phone
  );
end;
$$;

revoke all on function public.create_cod_order(text,text,text,text,text,jsonb) from public;
grant execute on function public.create_cod_order(text,text,text,text,text,jsonb) to anon,authenticated;
