-- =============================================================================
-- v2.0.26 — Road to Worlds cloud save: public.career_saves
--
-- Run once in the Supabase SQL Editor (production project). ADDITIVE and
-- IDEMPOTENT: it creates one table and two functions. Nothing that exists is
-- touched (no column on `profiles`, no view, no trigger on an existing table),
-- so every build already in production keeps working, before and after.
--
-- What it stores: one row per account and career slot (0..2), a copy of the save
-- the browser keeps in localStorage. localStorage stays the source the game
-- plays from; this row is the backup and the way to another device.
--
-- Shape:
--   * the save travels gzip-compressed (about 30 to 50 KB against 230 to 350 KB of
--     JSON, measured on a seven-season career) and is stored as bytea;
--   * `revision` is owned by the server and goes up by one on every write. A push
--     says which revision the device last saw; if the row moved on (another
--     device played), the push is refused with status 'conflict' and the game
--     asks the player which copy to keep. Nothing is overwritten silently;
--   * only the owner can read or delete a row (row-level security); writes go
--     through push_career_save only (no INSERT / UPDATE grant on the table);
--   * deleting the account removes the rows (FK on auth.users, cascade).
--
-- Rollback (the game falls back to local-only saves, nothing else breaks):
--   drop function if exists public.push_career_save(integer, text, integer, bigint, jsonb, text, text, text, text, timestamptz, bigint, boolean);
--   drop function if exists public.get_career_save(integer);
--   drop table if exists public.career_saves;
-- =============================================================================

create table if not exists public.career_saves (
  user_id        uuid        not null references auth.users on delete cascade,
  slot           smallint    not null check (slot between 0 and 2),
  -- The career's own id: a different id in the same slot is a different career.
  career_id      text        not null check (char_length(career_id) between 1 and 64),
  save_version   integer     not null check (save_version > 0),
  -- The save's action counter (how far this career has been played).
  seq            bigint      not null default 0 check (seq >= 0),
  -- Club, season, week, difficulty: what the saves screen and the conflict
  -- notice show without downloading the save.
  summary        jsonb       not null default '{}'::jsonb check (pg_column_size(summary) <= 4096),
  encoding       text        not null check (encoding in ('gzip', 'json')),
  payload        bytea       not null check (octet_length(payload) between 2 and 2097152),
  -- A random id per browser (not a person, not a fingerprint): tells "my own
  -- last push" from "another device".
  device_id      text        not null check (char_length(device_id) between 1 and 64),
  client_release text        check (client_release is null or char_length(client_release) <= 32),
  -- The device's clock at the last career action (shown to the player).
  saved_at       timestamptz not null,
  revision       bigint      not null default 1,
  -- The server's clock at the last write.
  updated_at     timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table public.career_saves enable row level security;

drop policy if exists "a user reads only their own career saves" on public.career_saves;
create policy "a user reads only their own career saves"
  on public.career_saves for select using ((select auth.uid()) = user_id);

drop policy if exists "a user deletes only their own career saves" on public.career_saves;
create policy "a user deletes only their own career saves"
  on public.career_saves for delete using ((select auth.uid()) = user_id);

-- No INSERT / UPDATE policy and no such grant: writes go through the function.
revoke all on public.career_saves from public, anon, authenticated;
grant select, delete on public.career_saves to authenticated;

-- -----------------------------------------------------------------------------
-- Write one slot. Returns a json object:
--   { "status": "ok",       "revision": n, "updated_at": ... }
--   { "status": "conflict", "revision": n, "updated_at": ..., "device_id": ...,
--     "career_id": ..., "seq": n, "saved_at": ..., "summary": {...} }
--   { "status": "missing" }   the row this device last saw was deleted elsewhere
--
-- p_expected_revision: the revision this device last saw (null = "I know of no
--   row for this slot"). p_force = true writes regardless: the player has just
--   chosen "keep this device's career" in the conflict notice.
-- Every argument must be SENT (null when there is no value): PostgREST finds the
--   function by the names it receives, so a missing key is "function not found".
-- p_payload is base64 text (the gzip bytes, or the JSON text when p_encoding is
--   'json': a browser without CompressionStream).
-- -----------------------------------------------------------------------------
create or replace function public.push_career_save(
  p_slot              integer,
  p_career_id         text,
  p_save_version      integer,
  p_seq               bigint,
  p_summary           jsonb,
  p_encoding          text,
  p_payload           text,
  p_device_id         text,
  p_client_release    text,
  p_saved_at          timestamptz,
  p_expected_revision bigint,
  p_force             boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid   uuid := auth.uid();
  v_row   public.career_saves%rowtype;
  v_bytes bytea;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  v_bytes := decode(p_payload, 'base64');

  select * into v_row
    from public.career_saves c
   where c.user_id = v_uid and c.slot = p_slot
     for update;

  if not found then
    if p_expected_revision is not null and not coalesce(p_force, false) then
      return jsonb_build_object('status', 'missing');
    end if;
    begin
      insert into public.career_saves as c
        (user_id, slot, career_id, save_version, seq, summary, encoding, payload,
         device_id, client_release, saved_at, revision, updated_at)
      values
        (v_uid, p_slot, p_career_id, p_save_version, p_seq, coalesce(p_summary, '{}'::jsonb),
         p_encoding, v_bytes, p_device_id, p_client_release, p_saved_at, 1, now())
      returning c.* into v_row;
      return jsonb_build_object('status', 'ok', 'revision', v_row.revision, 'updated_at', v_row.updated_at);
    exception when unique_violation then
      -- Another device created the row between the select and the insert.
      select * into v_row
        from public.career_saves c
       where c.user_id = v_uid and c.slot = p_slot
         for update;
      if not found then
        -- ...and it is gone again already: the caller simply pushes once more.
        return jsonb_build_object('status', 'missing');
      end if;
      if not coalesce(p_force, false) then
        return jsonb_build_object(
          'status', 'conflict', 'revision', v_row.revision, 'updated_at', v_row.updated_at,
          'device_id', v_row.device_id, 'career_id', v_row.career_id, 'seq', v_row.seq,
          'saved_at', v_row.saved_at, 'summary', v_row.summary);
      end if;
      -- Forced: the player chose this device's career, so the update below runs.
    end;
  end if;

  if not coalesce(p_force, false)
     and (p_expected_revision is null or v_row.revision <> p_expected_revision) then
    return jsonb_build_object(
      'status', 'conflict', 'revision', v_row.revision, 'updated_at', v_row.updated_at,
      'device_id', v_row.device_id, 'career_id', v_row.career_id, 'seq', v_row.seq,
      'saved_at', v_row.saved_at, 'summary', v_row.summary);
  end if;

  update public.career_saves as c
     set career_id      = p_career_id,
         save_version   = p_save_version,
         seq            = p_seq,
         summary        = coalesce(p_summary, '{}'::jsonb),
         encoding       = p_encoding,
         payload        = v_bytes,
         device_id      = p_device_id,
         client_release = p_client_release,
         saved_at       = p_saved_at,
         revision       = c.revision + 1,
         updated_at     = now()
   where c.user_id = v_uid and c.slot = p_slot
  returning c.* into v_row;

  return jsonb_build_object('status', 'ok', 'revision', v_row.revision, 'updated_at', v_row.updated_at);
end
$function$;

revoke all on function public.push_career_save(integer, text, integer, bigint, jsonb, text, text, text, text, timestamptz, bigint, boolean) from public, anon;
grant execute on function public.push_career_save(integer, text, integer, bigint, jsonb, text, text, text, text, timestamptz, bigint, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Read one slot WITH its payload (base64 text, no line breaks). Null when the
-- slot has no row. The list of slots (no payload) is a plain select on the
-- table, which row-level security limits to the owner.
-- -----------------------------------------------------------------------------
create or replace function public.get_career_save(p_slot integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
           'slot', c.slot, 'career_id', c.career_id, 'save_version', c.save_version,
           'seq', c.seq, 'summary', c.summary, 'encoding', c.encoding,
           'payload', translate(encode(c.payload, 'base64'), E'\n', ''),
           'device_id', c.device_id, 'client_release', c.client_release,
           'saved_at', c.saved_at, 'revision', c.revision, 'updated_at', c.updated_at)
    from public.career_saves c
   where c.user_id = auth.uid() and c.slot = p_slot;
$function$;

revoke all on function public.get_career_save(integer) from public, anon;
grant execute on function public.get_career_save(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Checks to run after applying (all three should hold):
--
-- 1) The table exists, is empty, and row-level security is on:
--      select count(*) as career_rows from public.career_saves;
--      select relrowsecurity from pg_class where oid = 'public.career_saves'::regclass;   -- true
--
-- 2) Exactly two policies (select, delete):
--      select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'career_saves' order by cmd;
--
-- 3) The functions are not callable by anon:
--      select has_function_privilege('anon', 'public.get_career_save(integer)', 'execute');   -- false
--
-- Later, to see how much it holds:
--      select count(*) as career_rows, pg_size_pretty(pg_total_relation_size('public.career_saves')) as size from public.career_saves;
-- -----------------------------------------------------------------------------

-- Supabase reloads the API schema after DDL by itself; this makes it explicit.
notify pgrst, 'reload schema';
