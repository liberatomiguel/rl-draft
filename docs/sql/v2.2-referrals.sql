-- =============================================================================
-- v2.2 share kit — friends brought to play: public.referral_codes, public.referrals
--
-- Run once in the Supabase SQL Editor (production project). ADDITIVE and
-- IDEMPOTENT: two new tables and three functions. Nothing that exists is
-- touched, so every build in production keeps working, before and after (a
-- build without the client code never calls these functions; a build with it
-- and without this SQL just counts nothing).
--
-- What it does:
--   * a signed-in player gets a short code (`referral_code()`); every link the
--     game's share sheet sends carries it (`?ref=<code>`);
--   * a device that arrives through such a link, had never played on that
--     browser, and then finishes its first draft run or its first career event
--     sends ONE claim (`claim_referral(code, device)`), signed in or not;
--   * the code's owner reads how many friends came (`my_referral_count()`); at
--     5 the game records the profile mark `share-friends-5` (the Party Leader
--     banner, once its art is in the catalog).
--
-- Rules the server keeps:
--   * one claim per device, ever (`device_id` is the primary key): the first
--     code that brought a device is the one that counts;
--   * a player cannot claim their own code (when signed in);
--   * at most 5 claims a day per code (a script with the public key can call the
--     function; the cap keeps that from paying out in seconds);
--   * the tables have no grants: only the three security-definer functions read
--     or write them. Deleting the account removes its code and every claim made
--     on it (cascade).
--
-- What is stored about the friend: a random device id the browser made (no
-- account, no IP, no name) and when it was claimed.
--
-- Rollback (the share kit keeps working; links still carry the code, nothing
-- is counted):
--   drop function if exists public.my_referral_count();
--   drop function if exists public.claim_referral(text, text);
--   drop function if exists public.referral_code();
--   drop table if exists public.referrals;
--   drop table if exists public.referral_codes;
-- =============================================================================

create table if not exists public.referral_codes (
  user_id    uuid        primary key references auth.users on delete cascade,
  code       text        not null unique check (code ~ '^[a-z0-9]{8}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  -- The friend's browser (a random id made by the game), counted once ever.
  device_id  text        primary key check (char_length(device_id) between 16 and 64),
  code       text        not null references public.referral_codes (code) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists referrals_code_created_idx on public.referrals (code, created_at);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
revoke all on public.referral_codes from public, anon, authenticated;
revoke all on public.referrals from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The signed-in player's code (made on the first call, the same one after).
-- -----------------------------------------------------------------------------
create or replace function public.referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c   text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select rc.code into c from public.referral_codes rc where rc.user_id = uid;
  if c is not null then
    return c;
  end if;
  for attempt in 1..8 loop
    c := substr(md5(uid::text || clock_timestamp()::text || random()::text), 1, 8);
    begin
      insert into public.referral_codes (user_id, code) values (uid, c);
      return c;
    exception when unique_violation then
      -- Another tab made this user's code first, or (rarely) the code exists.
      select rc.code into c from public.referral_codes rc where rc.user_id = uid;
      if c is not null then
        return c;
      end if;
    end;
  end loop;
  raise exception 'could not make a referral code';
end;
$$;

revoke all on function public.referral_code() from public, anon;
grant execute on function public.referral_code() to authenticated;

-- -----------------------------------------------------------------------------
-- A new device that played after arriving through a link. true = counted.
-- -----------------------------------------------------------------------------
create or replace function public.claim_referral(p_code text, p_device text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  code_in text := lower(coalesce(p_code, ''));
  owner   uuid;
  today   integer;
begin
  if p_device is null or char_length(p_device) not between 16 and 64 then
    return false;
  end if;
  if code_in !~ '^[a-z0-9]{8}$' then
    return false;
  end if;
  select rc.user_id into owner from public.referral_codes rc where rc.code = code_in;
  if owner is null then
    return false;
  end if;
  if auth.uid() is not null and auth.uid() = owner then
    return false;
  end if;
  select count(*) into today
    from public.referrals r
   where r.code = code_in and r.created_at > now() - interval '1 day';
  if today >= 5 then
    return false;
  end if;
  insert into public.referrals (device_id, code) values (p_device, code_in)
    on conflict (device_id) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_referral(text, text) from public;
grant execute on function public.claim_referral(text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- How many friends came through the signed-in player's code.
-- -----------------------------------------------------------------------------
create or replace function public.my_referral_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.referrals r
    join public.referral_codes rc on rc.code = r.code
   where rc.user_id = auth.uid();
$$;

revoke all on function public.my_referral_count() from public, anon;
grant execute on function public.my_referral_count() to authenticated;
