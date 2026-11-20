-- SquadCraft TransferMind — database schema (Supabase / PostgreSQL 17)
-- Run order: this file (schema), then db/seed/reference.sql + db/seed/load_data.sql (data), then db/seed/simulated_squads.sql.
-- Everything the app shows or computes lives here: tables, RLS policies, views and SQL functions (called by the
-- front end through PostgREST: /rest/v1/rpc/<function>). The front end contains no player data and no rules.

-- ===================== reference + market data (public, read-only) =====================
create table if not exists leagues (
  code text primary key, name text not null unique, country text not null,
  value_multiplier numeric not null check (value_multiplier > 0));
create table if not exists positions (
  code text primary key, name text not null, target_depth smallint not null check (target_depth > 0),
  sort_order smallint not null unique);
create table if not exists playstyles (
  name text primary key, w_press numeric not null check (w_press >= 0), w_passing numeric not null check (w_passing >= 0),
  w_pace numeric not null check (w_pace >= 0), w_physical numeric not null check (w_physical >= 0),
  description text, check (w_press + w_passing + w_pace + w_physical > 0));
create table if not exists data_sources (
  id smallint primary key, name text not null, url text, as_of date not null, notes text);
create table if not exists clubs (
  id text primary key, league_code text not null references leagues(code), short_code text not null, name text not null unique,
  strength smallint not null check (strength between 0 and 100), default_style text not null references playstyles(name),
  aliases text not null default '', has_real_squad boolean not null default false, logo_url text,
  unique (league_code, short_code), check (id = league_code || '-' || short_code));
create table if not exists players (
  tm_id integer primary key, name text not null, pos text not null references positions(code),
  sub_position text not null, age smallint not null check (age between 15 and 50), nationality text not null,
  contract_until smallint check (contract_until between 2020 and 2040), market_value_m numeric not null check (market_value_m >= 0),
  est_rating smallint not null check (est_rating between 1 and 99), est_potential smallint not null check (est_potential between 1 and 99),
  press smallint not null check (press between 0 and 100), passing smallint not null check (passing between 0 and 100),
  pace smallint not null check (pace between 0 and 100), physical smallint not null check (physical between 0 and 100),
  est_wage_k numeric not null check (est_wage_k >= 0), tm_slug text not null,
  club_id text not null references clubs(id), source_id smallint not null references data_sources(id),
  check (est_potential >= est_rating));
create table if not exists free_agents (
  id integer primary key, tm_id integer unique, name text not null, pos text not null references positions(code),
  sub_position text not null, age smallint not null check (age between 15 and 50), nationality text,
  market_value_m numeric not null check (market_value_m >= 0),
  est_rating smallint not null check (est_rating between 1 and 99), est_potential smallint not null check (est_potential between 1 and 99),
  press smallint not null check (press between 0 and 100), passing smallint not null check (passing between 0 and 100),
  pace smallint not null check (pace between 0 and 100), physical smallint not null check (physical between 0 and 100),
  est_wage_k numeric not null check (est_wage_k >= 0), tm_slug text, last_club text not null, free_since date,
  status text not null check (status in ('verified','reported')), source_id smallint not null references data_sources(id),
  check (est_potential >= est_rating));

create index if not exists clubs_league_idx on clubs(league_code);
create index if not exists clubs_default_style_idx on clubs(default_style);
create index if not exists players_club_pos_idx on players(club_id, pos);
create index if not exists players_source_idx on players(source_id);
create index if not exists players_pos_idx on players(pos);
create index if not exists free_agents_pos_status_idx on free_agents(pos, status);
create index if not exists free_agents_source_idx on free_agents(source_id);

-- ===================== user workspaces (private per access key) =====================
-- No login. The browser keeps a random UUID "access key" and sends it in the x-owner-token header.
-- PostgREST exposes request headers to SQL; RLS policies compare owner_token with it.
create or replace function fn_owner_token() returns uuid language sql stable set search_path = public as $$
  select case
    when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid
    else null
  end
  from (select current_setting('request.headers', true)::json ->> 'x-owner-token' as t) s;
$$;

create table if not exists rosters (
  id uuid primary key default gen_random_uuid(),
  owner_token uuid not null default fn_owner_token(),
  name text not null check (char_length(name) between 1 and 60),
  base_club_id text references clubs(id) on delete set null,
  style text not null default 'Possession' references playstyles(name),
  budget_m numeric not null default 60 check (budget_m between 0 and 1000),
  window_state text not null default 'open' check (window_state in ('open','closed')),
  created_at timestamptz not null default now());
create table if not exists roster_players (
  id bigint generated always as identity primary key,
  roster_id uuid not null references rosters(id) on delete cascade,
  owner_token uuid not null default fn_owner_token(),
  name text not null check (char_length(name) between 1 and 80),
  pos text not null references positions(code),
  sub_position text not null default '' check (char_length(sub_position) <= 40),
  age smallint not null check (age between 15 and 50),
  nationality text not null default '' check (char_length(nationality) <= 40),
  contract_until smallint check (contract_until between 2020 and 2040),
  market_value_m numeric not null default 1 check (market_value_m between 0 and 500),
  est_rating smallint not null default 65 check (est_rating between 1 and 99),
  est_potential smallint not null default 65 check (est_potential between 1 and 99),
  press smallint not null default 50 check (press between 0 and 100),
  passing smallint not null default 50 check (passing between 0 and 100),
  pace smallint not null default 50 check (pace between 0 and 100),
  physical smallint not null default 50 check (physical between 0 and 100),
  est_wage_k numeric not null default 5 check (est_wage_k between 0 and 2000),
  tm_id integer, tm_slug text, injured boolean not null default false,
  constraint roster_players_potential_ok check (est_potential >= est_rating));
create index if not exists rosters_owner_idx on rosters(owner_token);
create index if not exists rosters_base_club_idx on rosters(base_club_id);
create index if not exists rosters_style_idx on rosters(style);
create index if not exists roster_players_roster_idx on roster_players(roster_id, pos);
create index if not exists roster_players_owner_idx on roster_players(owner_token);
create index if not exists roster_players_pos_idx on roster_players(pos);

create or replace function tg_limit_rosters() returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.rosters where owner_token = new.owner_token) >= 20 then
    raise exception 'Workspace limit reached (20). Delete one first.';
  end if;
  return new;
end $$;
create or replace function tg_limit_roster_players() returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.roster_players where roster_id = new.roster_id) >= 60 then
    raise exception 'A squad can have at most 60 players.';
  end if;
  return new;
end $$;
drop trigger if exists rosters_limit on rosters;
create trigger rosters_limit before insert on rosters for each row execute function tg_limit_rosters();
drop trigger if exists roster_players_limit on roster_players;
create trigger roster_players_limit before insert on roster_players for each row execute function tg_limit_roster_players();

-- ===================== row level security =====================
alter table leagues enable row level security;       alter table positions enable row level security;
alter table playstyles enable row level security;    alter table data_sources enable row level security;
alter table clubs enable row level security;         alter table players enable row level security;
alter table free_agents enable row level security;   alter table rosters enable row level security;
alter table roster_players enable row level security;

do $$ declare t text; begin
  foreach t in array array['leagues','positions','playstyles','data_sources','clubs','players','free_agents'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
  end loop; end $$;

drop policy if exists "own rosters select" on rosters;
drop policy if exists "own rosters insert" on rosters;
drop policy if exists "own rosters update" on rosters;
drop policy if exists "own rosters delete" on rosters;
create policy "own rosters select" on rosters for select to anon, authenticated using (owner_token = (select fn_owner_token()));
create policy "own rosters insert" on rosters for insert to anon, authenticated with check (owner_token = (select fn_owner_token()));
create policy "own rosters update" on rosters for update to anon, authenticated using (owner_token = (select fn_owner_token())) with check (owner_token = (select fn_owner_token()));
create policy "own rosters delete" on rosters for delete to anon, authenticated using (owner_token = (select fn_owner_token()));

drop policy if exists "own players select" on roster_players;
drop policy if exists "own players insert" on roster_players;
drop policy if exists "own players update" on roster_players;
drop policy if exists "own players delete" on roster_players;
create policy "own players select" on roster_players for select to anon, authenticated using (owner_token = (select fn_owner_token()));
create policy "own players insert" on roster_players for insert to anon, authenticated
  with check (owner_token = (select fn_owner_token())
              and exists (select 1 from rosters r where r.id = roster_players.roster_id and r.owner_token = (select fn_owner_token())));
create policy "own players update" on roster_players for update to anon, authenticated
  using (owner_token = (select fn_owner_token()))
  with check (owner_token = (select fn_owner_token())
              and exists (select 1 from rosters r where r.id = roster_players.roster_id and r.owner_token = (select fn_owner_token())));
create policy "own players delete" on roster_players for delete to anon, authenticated using (owner_token = (select fn_owner_token()));

-- ===================== hardening (found by security review) =====================
-- 1. A player row may never be moved to another squad or owner (otherwise a user could stuff rows into someone else's squad,
--    where the victim cannot see them but they count toward the 60-player limit).
create or replace function tg_lock_roster_players() returns trigger language plpgsql set search_path = public as $$
begin
  if new.roster_id is distinct from old.roster_id or new.owner_token is distinct from old.owner_token then
    raise exception 'A player cannot be moved to another squad.';
  end if;
  return new;
end $$;
drop trigger if exists roster_players_lock on roster_players;
create trigger roster_players_lock before update on roster_players for each row execute function tg_lock_roster_players();

-- same for rosters: owner_token can never change
create or replace function tg_lock_rosters() returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_token is distinct from old.owner_token then raise exception 'A squad cannot change owner.'; end if;
  return new;
end $$;
drop trigger if exists rosters_lock on rosters;
create trigger rosters_lock before update on rosters for each row execute function tg_lock_rosters();

-- 2. no blank names
alter table rosters drop constraint if exists rosters_name_not_blank;
alter table rosters add constraint rosters_name_not_blank check (btrim(name) <> '');
alter table roster_players drop constraint if exists roster_players_name_not_blank;
alter table roster_players add constraint roster_players_name_not_blank check (btrim(name) <> '');

-- 3. global cap on stored squads (anyone can create new access keys, so per-key limits alone do not bound storage).
--    SECURITY DEFINER only so the count sees all users' rows; it returns nothing and cannot be called through the API.
create or replace function tg_global_cap_rosters() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.rosters) >= 3000 then
    raise exception 'The demo database is full. Please try again later.';
  end if;
  return new;
end $$;
revoke execute on function tg_global_cap_rosters() from public, anon, authenticated;
drop trigger if exists rosters_global_cap on rosters;
create trigger rosters_global_cap before insert on rosters for each row execute function tg_global_cap_rosters();

-- ===================== views (security_invoker: they obey the caller's RLS) =====================
create or replace view v_club_summary with (security_invoker = true) as
  select c.id as club_id, c.name as club, c.league_code, c.default_style, c.has_real_squad,
         count(p.tm_id)::int as squad_size, coalesce(sum(p.market_value_m), 0) as total_value_m,
         round(avg(p.age), 1) as avg_age,
         (count(p.tm_id) filter (where coalesce(p.contract_until::int, 2027) <= 2027))::int as contracts_expiring
  from clubs c left join players p on p.club_id = c.id group by c.id;

create or replace view v_squad_depth with (security_invoker = true) as
  select c.id as club_id, c.name as club, pos.code as pos, pos.target_depth,
         count(p.tm_id)::int as squad_count, (count(p.tm_id) - pos.target_depth)::int as depth_gap,
         max(p.est_rating) as starter_rating
  from clubs c cross join positions pos left join players p on p.club_id = c.id and p.pos = pos.code
  where c.has_real_squad group by c.id, c.name, pos.code, pos.target_depth, pos.sort_order;

create or replace view v_free_agents_verified with (security_invoker = true) as
  select id, tm_id, name, pos, sub_position, age, nationality, market_value_m, est_rating, est_potential,
         press, passing, pace, physical, est_wage_k, tm_slug, last_club, free_since, status, source_id
  from free_agents where status = 'verified';

-- Club profile: strength = mean rating of the best 14 players (real squads) and budget = 20% of squad value, rounded to 5M, 5..250
create or replace view v_club_profile with (security_invoker = true) as
  with agg as (
    select s.club_id, round(avg(s.est_rating) filter (where s.rk <= 14))::int as top_avg,
           sum(s.market_value_m) as total_value, count(*)::int as squad_size
    from (select club_id, est_rating, market_value_m,
                 row_number() over (partition by club_id order by est_rating desc) as rk from players) s
    group by s.club_id)
  select c.id, c.name, c.short_code as code, c.league_code as lg, l.name as league_name, l.country,
         c.default_style as style, c.aliases, c.has_real_squad as is_real,
         case when c.has_real_squad then coalesce(a.top_avg, c.strength::int) else c.strength::int end as strength,
         case when c.has_real_squad
              then least(250::numeric, greatest(5::numeric, round(coalesce(a.total_value, 0) * 0.2 / 5) * 5))
              else greatest(5::numeric, round((c.strength - 64) * 6 * l.value_multiplier / 5) * 5) end as budget_m,
         coalesce(a.squad_size, 0) as squad_size,
         c.logo_url
  from clubs c join leagues l on l.code = c.league_code left join agg a on a.club_id = c.id;

-- ===================== privileges (new Supabase projects give anon/authenticated nothing by default) =====================
grant usage on schema public to anon, authenticated;
grant select on leagues, positions, playstyles, data_sources, clubs, players, free_agents,
                v_club_summary, v_squad_depth, v_free_agents_verified, v_club_profile to anon, authenticated;
grant select, insert, update, delete on rosters, roster_players to anon, authenticated;

-- ===================== functions (all rules live here) =====================
-- All SECURITY INVOKER (default) with a fixed search_path: they run with the caller's rights, so RLS still applies.

-- style fit 0..100 of one player for a playstyle: weighted mean of press/passing/pace/physical
create or replace function fn_style_fit(p_pos text, p_press int, p_passing int, p_pace int, p_physical int, p_style text)
returns int language sql stable set search_path = public as $$
  select case when p_pos = 'GK'
    then round(least(95::numeric, greatest(30::numeric, 55 + (p_passing - 55) * s.w_passing / 4 + (p_physical - 55) * s.w_physical / 5 + 12)))::int
    else round((s.w_press * p_press + s.w_passing * p_passing + s.w_pace * p_pace + s.w_physical * p_physical)
               / (s.w_press + s.w_passing + s.w_pace + s.w_physical))::int
  end
  from public.playstyles s where s.name = p_style;
$$;

-- lowercase, strip accents/punctuation (used by club search)
create or replace function fn_norm(t text) returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(regexp_replace(
    translate(lower(coalesce(t,'')), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿšž', 'aaaaaaceeeeiiiinooooouuuuyysz'),
    '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- midterm helpers (original club-level, no workspace)
create or replace function fn_weakest_position(p_club_id text) returns text language sql stable set search_path = public as $$
  select pos.code from public.positions pos
  left join lateral (select max(p.est_rating) as best, count(*) as n from public.players p where p.club_id = p_club_id and p.pos = pos.code) s on true
  order by coalesce(s.best, 50) + s.n::numeric / pos.target_depth * 8, pos.sort_order limit 1;
$$;

create or replace function fn_emergency_candidates(p_club_id text, p_pos text, p_style text, p_max_wage numeric default 999,
  p_allow_over_32 boolean default false, p_verified_only boolean default false, p_target_rating int default null, p_limit int default 12)
returns table(rnk int, name text, sub_position text, age smallint, est_rating smallint, est_wage_k numeric, style_fit int,
              rating_gap int, status text, last_club text, score numeric)
language sql stable set search_path = public as $$
  with t as (
    select coalesce(p_target_rating, (select max(p.est_rating) from public.players p where p.club_id = p_club_id and p.pos = p_pos), 70)::int as target
  ), c as (
    select f.id, f.name, f.sub_position, f.age, f.est_rating, f.est_wage_k, f.status, f.last_club, t.target,
           public.fn_style_fit(f.pos, f.press, f.passing, f.pace, f.physical, p_style) as fit
    from public.free_agents f cross join t
    where f.pos = p_pos and f.est_wage_k <= p_max_wage and (p_allow_over_32 or f.age <= 32)
      and (not p_verified_only or f.status = 'verified')
  ), s as (
    select c.*, (c.est_rating * 1.5 + c.fit * 0.6 - abs(c.est_rating - c.target) * 0.8)::numeric as sc from c
  )
  select (row_number() over (order by s.sc desc, s.id))::int, s.name, s.sub_position, s.age, s.est_rating, s.est_wage_k,
         s.fit, (s.est_rating - s.target)::int, s.status, s.last_club, round(s.sc, 2)
  from s order by 1 limit p_limit;
$$;

-- club search with scoring: exact 100, prefix 80, word prefix 60, substring 40, multi-word 30
create or replace function fn_search_clubs(p_q text, p_limit int default 7)
returns table(id text, name text, code text, lg text, league_name text, style text, is_real boolean, strength int, budget_m numeric, score int)
language sql stable set search_path = public as $$
  with q as (select public.fn_norm(p_q) as q),
  c as (select v.*, public.fn_norm(v.name) as n, public.fn_norm(v.code) as nc,
               public.fn_norm(v.name || ' ' || v.code || ' ' || v.aliases) as keys from public.v_club_profile v),
  s as (
    select c.*, case
        when q.q = '' then 0
        when c.n = q.q or c.nc = q.q then 100
        when c.n like q.q || '%' then 80
        when exists (select 1 from unnest(string_to_array(c.keys, ' ')) w where w like q.q || '%') then 60
        when position(q.q in c.keys) > 0 then 40
        when array_length(string_to_array(q.q, ' '), 1) > 1
             and not exists (select 1 from unnest(string_to_array(q.q, ' ')) qw
                             where not exists (select 1 from unnest(string_to_array(c.keys, ' ')) kw where kw like qw || '%')) then 30
        else 0 end as score
    from c cross join q)
  select s.id, s.name, s.code, s.lg, s.league_name, s.style, s.is_real, s.strength::int, s.budget_m, s.score
  from s where s.score > 0 order by s.score desc, s.strength desc, s.name limit greatest(1, least(p_limit, 20));
$$;

create or replace function fn__roster(p_roster uuid) returns rosters language plpgsql stable set search_path = public as $$
declare r public.rosters;
begin
  select * into r from public.rosters where id = p_roster;
  if not found then raise exception 'Workspace not found'; end if;
  return r;
end $$;

-- create a workspace: empty (p_club_id null) or an editable copy of a club's squad
create or replace function fn_create_workspace(p_club_id text default null, p_name text default null)
returns uuid language plpgsql set search_path = public as $$
#variable_conflict use_column
declare v_id uuid; v_club record;
begin
  if public.fn_owner_token() is null then raise exception 'Missing or invalid x-owner-token header'; end if;
  if p_club_id is null then
    insert into public.rosters (name) values (coalesce(nullif(btrim(p_name), ''), 'My squad')) returning id into v_id;
    return v_id;
  end if;
  select * into v_club from public.v_club_profile where id = p_club_id;
  if not found then raise exception 'Unknown club: %', p_club_id; end if;
  insert into public.rosters (name, base_club_id, style, budget_m)
    values (coalesce(nullif(btrim(p_name), ''), v_club.name), v_club.id, v_club.style, v_club.budget_m) returning id into v_id;
  insert into public.roster_players (roster_id, name, pos, sub_position, age, nationality, contract_until, market_value_m,
      est_rating, est_potential, press, passing, pace, physical, est_wage_k, tm_id, tm_slug)
  select v_id, p.name, p.pos, p.sub_position, p.age, p.nationality, p.contract_until, p.market_value_m,
         p.est_rating, p.est_potential, p.press, p.passing, p.pace, p.physical, p.est_wage_k,
         case when p.source_id = 1 then p.tm_id end, case when p.source_id = 1 then nullif(p.tm_slug, '') end
  from public.players p where p.club_id = p_club_id;
  return v_id;
end $$;

-- S1: position groups. thin_depth = fewer than 2 players (all 8 positions are always listed)
create or replace function fn_workspace_depth(p_roster uuid)
returns table(pos text, pos_name text, target_depth int, n_total int, n_available int, n_injured int, thin_depth boolean,
              best_rating int, starter_name text, group_value_m numeric, players jsonb)
language plpgsql stable set search_path = public as $$
#variable_conflict use_column
begin
  perform public.fn__roster(p_roster);
  return query
  select ps.code, ps.name, ps.target_depth::int, count(rp.id)::int,
         (count(rp.id) filter (where not rp.injured))::int, (count(rp.id) filter (where rp.injured))::int,
         count(rp.id) < 2, (max(rp.est_rating) filter (where not rp.injured))::int,
         (array_agg(rp.name order by rp.est_rating desc, rp.id) filter (where not rp.injured))[1],
         coalesce(sum(rp.market_value_m), 0),
         coalesce(jsonb_agg(jsonb_build_object('id', rp.id, 'name', rp.name, 'age', rp.age, 'market_value_m', rp.market_value_m,
             'contract_until', rp.contract_until, 'est_rating', rp.est_rating, 'injured', rp.injured,
             'tm_id', rp.tm_id, 'tm_slug', rp.tm_slug) order by rp.est_rating desc, rp.id) filter (where rp.id is not null), '[]'::jsonb)
  from public.positions ps left join public.roster_players rp on rp.roster_id = p_roster and rp.pos = ps.code
  group by ps.code, ps.name, ps.target_depth, ps.sort_order order by ps.sort_order;
end $$;

create or replace function fn_workspace_weakest_position(p_roster uuid) returns text language sql stable set search_path = public as $$
  select ps.code from public.positions ps
  left join lateral (select max(rp.est_rating) as best, count(*) as n from public.roster_players rp
                     where rp.roster_id = p_roster and rp.pos = ps.code and not rp.injured) s on true
  order by coalesce(s.best, 50) + s.n::numeric / ps.target_depth * 8, ps.sort_order limit 1;
$$;

create or replace function fn_workspace_kpis(p_roster uuid)
returns table(squad_size int, squad_value_m numeric, avg_age numeric, contracts_expiring int, injuries int,
              style_mismatches int, thin_positions int, weakest_pos text)
language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare r public.rosters;
begin
  r := public.fn__roster(p_roster);
  return query
  select count(*)::int, coalesce(sum(rp.market_value_m), 0), round(avg(rp.age), 1),
         (count(*) filter (where coalesce(rp.contract_until, 2027) <= 2027))::int,
         (count(*) filter (where rp.injured))::int,
         (count(*) filter (where public.fn_style_fit(rp.pos, rp.press, rp.passing, rp.pace, rp.physical, r.style) < 58))::int,
         (select count(*) from public.fn_workspace_depth(p_roster) d where d.thin_depth)::int,
         public.fn_workspace_weakest_position(p_roster)
  from public.roster_players rp where rp.roster_id = p_roster;
end $$;

-- roster rows with style fit and flags: expiring (<=2027), aging (>=31), prospect (<=21 and pot-rating>=8), mismatch (fit<58)
create or replace function fn_workspace_roster(p_roster uuid)
returns table(id bigint, name text, pos text, sub_position text, age int, nationality text, contract_until int, market_value_m numeric,
              est_rating int, est_potential int, press int, passing int, pace int, physical int, est_wage_k numeric, tm_id int, tm_slug text,
              injured boolean, style_fit int, flag_expiring boolean, flag_aging boolean, flag_prospect boolean, flag_mismatch boolean)
language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare r public.rosters;
begin
  r := public.fn__roster(p_roster);
  return query
  select rp.id, rp.name, rp.pos, rp.sub_position, rp.age::int, rp.nationality, rp.contract_until::int, rp.market_value_m,
         rp.est_rating::int, rp.est_potential::int, rp.press::int, rp.passing::int, rp.pace::int, rp.physical::int,
         rp.est_wage_k, rp.tm_id, rp.tm_slug, rp.injured, f.fit,
         coalesce(rp.contract_until, 2027) <= 2027, rp.age >= 31, rp.age <= 21 and rp.est_potential - rp.est_rating >= 8, f.fit < 58
  from public.roster_players rp
  cross join lateral (select public.fn_style_fit(rp.pos, rp.press, rp.passing, rp.pace, rp.physical, r.style) as fit) f
  where rp.roster_id = p_roster
  order by (select ps.sort_order from public.positions ps where ps.code = rp.pos), rp.est_rating desc, rp.id;
end $$;

create or replace function fn_workspace_overview(p_roster uuid) returns jsonb language plpgsql stable set search_path = public as $$
declare r public.rosters;
begin
  r := public.fn__roster(p_roster);
  return jsonb_build_object(
    'workspace', to_jsonb(r),
    'club', (select to_jsonb(v) from public.v_club_profile v where v.id = r.base_club_id),
    'kpis', (select to_jsonb(k) from public.fn_workspace_kpis(p_roster) k),
    'depth', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.fn_workspace_depth(p_roster) d),
    'roster', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.fn_workspace_roster(p_roster) x));
end $$;

-- S2 Immediate Upgrade: rating strictly above the current (best non-injured) starter; optional fee cap and league
create or replace function fn_recommend_upgrade(p_roster uuid, p_pos text, p_max_fee numeric default null, p_league text default null, p_limit int default 10)
returns jsonb language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare r public.rosters; v_start record; v_total int; v_rows jsonb; v_filtered boolean;
begin
  r := public.fn__roster(p_roster);
  if not exists (select 1 from public.positions where code = p_pos) then raise exception 'Unknown position: %', p_pos; end if;
  if p_max_fee is not null and p_max_fee < 0 then raise exception 'Fee limit cannot be negative'; end if;
  v_filtered := p_max_fee is not null or (p_league is not null and p_league <> 'ALL');
  select rp.name, rp.age, rp.est_rating into v_start from public.roster_players rp
   where rp.roster_id = p_roster and rp.pos = p_pos and not rp.injured order by rp.est_rating desc, rp.id limit 1;
  with pool as (
    select p.tm_id, p.name, p.age, p.market_value_m, p.est_rating, p.est_potential, p.est_wage_k, p.tm_slug,
           c.name as club, c.league_code as lg, public.fn_style_fit(p.pos, p.press, p.passing, p.pace, p.physical, r.style) as fit
    from public.players p join public.clubs c on c.id = p.club_id
    where c.has_real_squad and p.pos = p_pos and p.est_rating > coalesce(v_start.est_rating, 0)
      and (r.base_club_id is null or p.club_id <> r.base_club_id)
      and (p_max_fee is null or p.market_value_m <= p_max_fee)
      and (p_league is null or p_league = 'ALL' or c.league_code = p_league)
      and not exists (select 1 from public.roster_players x where x.roster_id = p_roster and x.tm_id = p.tm_id)
  ), ranked as (
    select pool.*, count(*) over () as total from pool
    order by est_rating desc, fit desc, est_potential desc, tm_id limit greatest(1, least(p_limit, 50)))
  select coalesce(max(total), 0)::int,
         coalesce(jsonb_agg(jsonb_build_object('tm_id', tm_id, 'name', name, 'age', age, 'market_value_m', market_value_m,
           'est_rating', est_rating, 'est_potential', est_potential, 'est_wage_k', est_wage_k, 'club', club, 'lg', lg,
           'style_fit', fit, 'rating_gain', est_rating - coalesce(v_start.est_rating, 0), 'tm_slug', tm_slug)
           order by est_rating desc, fit desc, est_potential desc, tm_id), '[]'::jsonb)
  into v_total, v_rows from ranked;
  return jsonb_build_object('position', p_pos,
    'starter', case when v_start.name is null then null else jsonb_build_object('name', v_start.name, 'age', v_start.age, 'est_rating', v_start.est_rating) end,
    'total', v_total,
    'message', case when v_total > 0 then null when v_filtered then 'No candidates match these limits' else 'No player rates above the current starter' end,
    'candidates', v_rows);
end $$;

-- S2 Future-Proof: age <= p_max_age (default 21) and value <= fee (inclusive); no potential filter
create or replace function fn_recommend_future(p_roster uuid, p_pos text, p_max_fee numeric, p_max_age int default 21, p_league text default null, p_limit int default 10)
returns jsonb language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare r public.rosters; v_start record; v_total int; v_rows jsonb;
begin
  r := public.fn__roster(p_roster);
  if not exists (select 1 from public.positions where code = p_pos) then raise exception 'Unknown position: %', p_pos; end if;
  if p_max_fee is null or p_max_fee < 0 then raise exception 'Enter a maximum fee (0 or more)'; end if;
  if p_max_age is null or p_max_age < 15 or p_max_age > 50 then raise exception 'Age limit must be between 15 and 50'; end if;
  select rp.name, rp.age, rp.est_rating into v_start from public.roster_players rp
   where rp.roster_id = p_roster and rp.pos = p_pos and not rp.injured order by rp.est_rating desc, rp.id limit 1;
  with pool as (
    select p.tm_id, p.name, p.age, p.market_value_m, p.est_rating, p.est_potential, p.est_wage_k, p.tm_slug,
           c.name as club, c.league_code as lg, public.fn_style_fit(p.pos, p.press, p.passing, p.pace, p.physical, r.style) as fit
    from public.players p join public.clubs c on c.id = p.club_id
    where c.has_real_squad and p.pos = p_pos and p.age <= p_max_age and p.market_value_m <= p_max_fee
      and (r.base_club_id is null or p.club_id <> r.base_club_id)
      and (p_league is null or p_league = 'ALL' or c.league_code = p_league)
      and not exists (select 1 from public.roster_players x where x.roster_id = p_roster and x.tm_id = p.tm_id)
  ), ranked as (
    select pool.*, count(*) over () as total from pool
    order by est_rating desc, fit desc, est_potential desc, tm_id limit greatest(1, least(p_limit, 50)))
  select coalesce(max(total), 0)::int,
         coalesce(jsonb_agg(jsonb_build_object('tm_id', tm_id, 'name', name, 'age', age, 'market_value_m', market_value_m,
           'est_rating', est_rating, 'est_potential', est_potential, 'est_wage_k', est_wage_k, 'club', club, 'lg', lg,
           'style_fit', fit, 'tm_slug', tm_slug) order by est_rating desc, fit desc, est_potential desc, tm_id), '[]'::jsonb)
  into v_total, v_rows from ranked;
  return jsonb_build_object('position', p_pos,
    'starter', case when v_start.name is null then null else jsonb_build_object('name', v_start.name, 'age', v_start.age, 'est_rating', v_start.est_rating) end,
    'total', v_total, 'message', case when v_total = 0 then 'No candidates match these limits' else null end, 'candidates', v_rows);
end $$;

-- Emergency free agents: score = rating*1.5 + fit*0.6 - |rating - target|*0.8 (target = best injured player at the position, else starter, else 70)
create or replace function fn_emergency(p_roster uuid, p_pos text, p_max_wage numeric default 999, p_allow_over_32 boolean default false,
  p_verified_only boolean default false, p_limit int default 12)
returns jsonb language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare r public.rosters; v_target int; v_ref text; v_rows jsonb; v_total int;
begin
  r := public.fn__roster(p_roster);
  if not exists (select 1 from public.positions where code = p_pos) then raise exception 'Unknown position: %', p_pos; end if;
  select rp.est_rating, rp.name into v_target, v_ref from public.roster_players rp
   where rp.roster_id = p_roster and rp.pos = p_pos and rp.injured order by rp.est_rating desc, rp.id limit 1;
  if v_target is null then
    select rp.est_rating into v_target from public.roster_players rp
     where rp.roster_id = p_roster and rp.pos = p_pos and not rp.injured order by rp.est_rating desc, rp.id limit 1;
  end if;
  v_target := coalesce(v_target, 70);
  with c as (
    select f.id, f.tm_id, f.name, f.sub_position, f.age, f.nationality, f.est_rating, f.est_wage_k, f.market_value_m,
           f.status, f.last_club, f.free_since, f.tm_slug, public.fn_style_fit(f.pos, f.press, f.passing, f.pace, f.physical, r.style) as fit
    from public.free_agents f
    where f.pos = p_pos and f.est_wage_k <= p_max_wage and (p_allow_over_32 or f.age <= 32)
      and (not p_verified_only or f.status = 'verified')
      and (f.tm_id is null or not exists (select 1 from public.roster_players x where x.roster_id = p_roster and x.tm_id = f.tm_id))
  ), s as (
    select c.*, (c.est_rating * 1.5 + c.fit * 0.6 - abs(c.est_rating - v_target) * 0.8)::numeric as sc, count(*) over () as total
    from c order by sc desc, id limit greatest(1, least(p_limit, 50)))
  select coalesce(max(total), 0)::int,
         coalesce(jsonb_agg(jsonb_build_object('id', id, 'tm_id', tm_id, 'name', name, 'sub_position', sub_position, 'age', age,
           'nationality', nationality, 'est_rating', est_rating, 'est_wage_k', est_wage_k, 'market_value_m', market_value_m,
           'style_fit', fit, 'rating_gap', est_rating - v_target, 'status', status, 'last_club', last_club, 'free_since', free_since,
           'tm_slug', tm_slug, 'score', round(sc, 2)) order by sc desc, id), '[]'::jsonb)
  into v_total, v_rows from s;
  return jsonb_build_object('position', p_pos, 'target_rating', v_target, 'reference_player', v_ref, 'total', v_total,
    'injured', (select coalesce(jsonb_agg(jsonb_build_object('id', rp.id, 'name', rp.name, 'pos', rp.pos, 'est_rating', rp.est_rating)
                                          order by rp.est_rating desc), '[]'::jsonb)
                from public.roster_players rp where rp.roster_id = p_roster and rp.injured),
    'message', case when v_total = 0 then 'No out-of-contract players match these limits' else null end, 'candidates', v_rows);
end $$;

-- Offload planner: non-injured players with fit < 60 (not young prospects) matched to up to 3 buyer clubs
-- (budget >= value, their style fits the player better, score = fit*0.7 + need*25 - |club strength - rating|*0.8)
create or replace function fn_offload(p_roster uuid, p_limit int default 8)
returns jsonb language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare r public.rosters; v_rows jsonb;
begin
  r := public.fn__roster(p_roster);
  with out as (
    select rp.*, public.fn_style_fit(rp.pos, rp.press, rp.passing, rp.pace, rp.physical, r.style) as fit
    from public.roster_players rp where rp.roster_id = p_roster and not rp.injured
  ), sel as (
    select * from out where fit < 60 and not (age <= 21 and est_potential - est_rating >= 8)
    order by fit, id limit greatest(1, least(p_limit, 20))
  ), cp as (
    select club_id, pos, count(*) as n, max(est_rating) as best from public.players group by club_id, pos
  ), cand as (
    select s.id as pid, v.id as cid, v.name as cname, v.lg, v.style as cstyle,
           public.fn_style_fit(s.pos, s.press, s.passing, s.pace, s.physical, v.style) as f,
           (coalesce(cp.n, 0) < ps.target_depth or (cp.best is not null and cp.best < s.est_rating + 2)) as need,
           s.fit as pfit, s.est_rating, v.strength
    from sel s join public.positions ps on ps.code = s.pos cross join public.v_club_profile v
    left join cp on cp.club_id = v.id and cp.pos = s.pos
    where (r.base_club_id is null or v.id <> r.base_club_id) and v.budget_m >= s.market_value_m
  ), ranked as (
    select cand.*, row_number() over (partition by pid
             order by (f * 0.7 + (case when need then 25 else 0 end) - abs(strength - est_rating) * 0.8) desc, cid) as rk
    from cand where f > pfit)
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'pos', s.pos, 'age', s.age, 'est_rating', s.est_rating, 'est_potential', s.est_potential,
      'market_value_m', s.market_value_m, 'contract_until', s.contract_until, 'tm_id', s.tm_id, 'tm_slug', s.tm_slug, 'style_fit', s.fit,
      'flag_expiring', coalesce(s.contract_until, 2027) <= 2027, 'flag_aging', s.age >= 31,
      'flag_prospect', s.age <= 21 and s.est_potential - s.est_rating >= 8,
      'buyers', (select coalesce(jsonb_agg(jsonb_build_object('club_id', k.cid, 'club', k.cname, 'lg', k.lg, 'style', k.cstyle,
                                                              'style_fit', k.f, 'needs_position', k.need) order by k.rk), '[]'::jsonb)
                 from ranked k where k.pid = s.id and k.rk <= 3)) order by s.fit, s.id), '[]'::jsonb)
  into v_rows from sel s;
  return v_rows;
end $$;

-- sign a player (by Transfermarkt id) or a free agent (by id) into the workspace; exactly one argument
create or replace function fn_add_from_database(p_roster uuid, p_tm_id int default null, p_free_agent_id int default null)
returns bigint language plpgsql set search_path = public as $$
#variable_conflict use_column
declare v_new bigint;
begin
  perform public.fn__roster(p_roster);
  if (p_tm_id is null) = (p_free_agent_id is null) then raise exception 'Give exactly one of p_tm_id or p_free_agent_id'; end if;
  if p_tm_id is not null then
    insert into public.roster_players (roster_id, name, pos, sub_position, age, nationality, contract_until, market_value_m,
        est_rating, est_potential, press, passing, pace, physical, est_wage_k, tm_id, tm_slug)
    select p_roster, p.name, p.pos, p.sub_position, p.age, p.nationality, p.contract_until, p.market_value_m,
           p.est_rating, p.est_potential, p.press, p.passing, p.pace, p.physical, p.est_wage_k,
           case when p.source_id = 1 then p.tm_id end, case when p.source_id = 1 then nullif(p.tm_slug, '') end
    from public.players p where p.tm_id = p_tm_id returning id into v_new;
  else
    insert into public.roster_players (roster_id, name, pos, sub_position, age, nationality, contract_until, market_value_m,
        est_rating, est_potential, press, passing, pace, physical, est_wage_k, tm_id, tm_slug)
    select p_roster, f.name, f.pos, f.sub_position, f.age, coalesce(f.nationality, ''), null, f.market_value_m,
           f.est_rating, f.est_potential, f.press, f.passing, f.pace, f.physical, f.est_wage_k, f.tm_id, f.tm_slug
    from public.free_agents f where f.id = p_free_agent_id returning id into v_new;
  end if;
  if v_new is null then raise exception 'Player not found'; end if;
  return v_new;
end $$;

grant execute on function fn_owner_token(), fn_style_fit(text,int,int,int,int,text), fn_norm(text), fn_weakest_position(text),
  fn_emergency_candidates(text,text,text,numeric,boolean,boolean,int,int), fn_search_clubs(text,int), fn__roster(uuid),
  fn_create_workspace(text,text), fn_workspace_depth(uuid), fn_workspace_weakest_position(uuid), fn_workspace_kpis(uuid),
  fn_workspace_roster(uuid), fn_workspace_overview(uuid), fn_recommend_upgrade(uuid,text,numeric,text,int),
  fn_recommend_future(uuid,text,numeric,int,text,int), fn_emergency(uuid,text,numeric,boolean,boolean,int), fn_offload(uuid,int),
  fn_add_from_database(uuid,int,int) to anon, authenticated;
