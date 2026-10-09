-- WAGWAN: secure, one-time PARTAGEZ VOTRE OUTFIT loyalty reward.
-- Safe additive migration: preserves existing accounts, balances, transactions and reviews.

create table if not exists public.wagwan_photo_reward_claims (
  id uuid primary key default gen_random_uuid(),
  photo_review_id uuid unique references public.wagwan_photo_reviews(id) on delete set null,
  loyalty_account_id uuid not null references public.loyalty_accounts(id) on delete restrict,
  normalized_phone text not null unique,
  points integer not null default 5 check (points = 5),
  created_at timestamptz not null default now()
);

alter table public.wagwan_photo_reward_claims enable row level security;
revoke all on public.wagwan_photo_reward_claims from anon, authenticated;

-- Canonicalize Moroccan phone numbers without trusting browser-supplied account IDs.
create or replace function public.wagwan_normalize_loyalty_phone(p_phone text)
returns text
language plpgsql immutable
set search_path = public
as $$
declare d text;
begin
  d := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  if d like '00212%' then d := substring(d from 3); end if;
  if d like '212%' and length(d)=12 and substring(d from 4 for 1) in ('6','7') then
    return '+' || d;
  elsif d like '0%' and length(d)=10 and substring(d from 2 for 1) in ('6','7') then
    return '+212' || substring(d from 2);
  elsif length(d)=9 and substring(d from 1 for 1) in ('6','7') then
    return '+212' || d;
  end if;
  return null;
end;
$$;

-- Preserve protection for rewards already recorded by the previous implementation.
insert into public.wagwan_photo_reward_claims(photo_review_id, loyalty_account_id, normalized_phone, points)
select r.id, a.id, public.wagwan_normalize_loyalty_phone(r.phone), 5
from public.wagwan_photo_reviews r
join public.loyalty_accounts a
  on public.wagwan_normalize_loyalty_phone(a.phone)=public.wagwan_normalize_loyalty_phone(r.phone)
where r.points_awarded is true
  and public.wagwan_normalize_loyalty_phone(r.phone) is not null
on conflict do nothing;

-- Also backfill claims whose historical transaction note identifies the photo review,
-- even if the old frontend failed to set points_awarded=true afterwards.
insert into public.wagwan_photo_reward_claims(photo_review_id, loyalty_account_id, normalized_phone, points)
select r.id, t.account_id, public.wagwan_normalize_loyalty_phone(r.phone), 5
from public.loyalty_transactions t
join public.wagwan_photo_reviews r
  on t.note = 'Approved photo review ' || r.id::text
where public.wagwan_normalize_loyalty_phone(r.phone) is not null
on conflict do nothing;

create or replace function public.moderate_wagwan_photo_review(p_review_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.wagwan_photo_reviews%rowtype;
  a public.loyalty_accounts%rowtype;
  canonical_phone text;
  claim_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if p_status not in ('approved','rejected') then
    raise exception 'Invalid photo review status';
  end if;

  select * into r from public.wagwan_photo_reviews where id=p_review_id for update;
  if not found then raise exception 'Photo review not found'; end if;
  if r.status <> 'pending' then
    return jsonb_build_object('status','already_moderated','photo_review_id',r.id,'points_awarded',r.points_awarded);
  end if;

  if p_status='rejected' then
    update public.wagwan_photo_reviews set status='rejected', moderated_at=now() where id=r.id;
    return jsonb_build_object('status','rejected','photo_review_id',r.id,'points_awarded',false);
  end if;

  canonical_phone := public.wagwan_normalize_loyalty_phone(r.phone);
  update public.wagwan_photo_reviews set status='approved', moderated_at=now() where id=r.id;
  if canonical_phone is null then
    return jsonb_build_object('status','approved_no_phone','photo_review_id',r.id,'points_awarded',false);
  end if;

  -- Match the stored loyalty account by canonical phone and lock it against concurrent awards.
  select * into a
  from public.loyalty_accounts la
  where public.wagwan_normalize_loyalty_phone(la.phone)=canonical_phone
  order by la.created_at asc
  limit 1
  for update;
  if not found then
    return jsonb_build_object('status','no_loyalty_account','photo_review_id',r.id,'points_awarded',false);
  end if;

  -- Serialize all reward attempts for this loyalty account. This also protects accounts
  -- whose phone number changes after their one-time photo reward.
  perform pg_advisory_xact_lock(hashtext(a.id::text)::bigint);
  if exists (select 1 from public.wagwan_photo_reward_claims c where c.loyalty_account_id=a.id) then
    update public.wagwan_photo_reviews set points_awarded=false where id=r.id;
    return jsonb_build_object('status','already_rewarded','photo_review_id',r.id,'loyalty_account_id',a.id,'points_awarded',false);
  end if;

  -- Unique constraints on review and canonical phone remain the final duplicate guard.
  insert into public.wagwan_photo_reward_claims(photo_review_id,loyalty_account_id,normalized_phone,points)
  values(r.id,a.id,canonical_phone,5)
  on conflict do nothing
  returning id into claim_id;

  if claim_id is null then
    update public.wagwan_photo_reviews set points_awarded=false where id=r.id;
    return jsonb_build_object('status','already_rewarded','photo_review_id',r.id,'loyalty_account_id',a.id,'points_awarded',false);
  end if;

  update public.loyalty_accounts
  set points_balance=points_balance+5,
      lifetime_earned=lifetime_earned+5,
      updated_at=now()
  where id=a.id;

  insert into public.loyalty_transactions(account_id,order_id,type,points,note)
  values(a.id,null,'adjustment',5,'PARTAGEZ VOTRE OUTFIT reward; review='||r.id::text||'; claim='||claim_id::text);

  update public.wagwan_photo_reviews set points_awarded=true where id=r.id;
  return jsonb_build_object('status','rewarded','photo_review_id',r.id,'loyalty_account_id',a.id,'points_awarded',true,'points',5);
end;
$$;

revoke all on function public.moderate_wagwan_photo_review(uuid,text) from public, anon;
grant execute on function public.moderate_wagwan_photo_review(uuid,text) to authenticated;
revoke all on function public.wagwan_normalize_loyalty_phone(text) from public, anon, authenticated;
grant execute on function public.wagwan_normalize_loyalty_phone(text) to authenticated;
