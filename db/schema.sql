-- =====================================================================
-- SquadCraft TransferMind - database schema (PostgreSQL / Supabase)
-- ISE4133 Software Engineering, Team 9
--
-- Generated from the live Supabase project "Squatcraft" on 2026-10-25.
-- This file only defines STRUCTURE (tables, constraints, indexes, security,
-- functions, views). It contains no data, no passwords and no API keys.
--
-- The data (2,382 players, 154 free agents) comes from data.js
-- (submitted commit 33aa3cf). The prototype app still reads data.js;
-- connecting it to this database is planned for weeks 11-12.
--
-- Run order: this whole file, top to bottom, on an empty database.
-- Requires the Supabase roles "anon" and "authenticated".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Lookup tables
-- ---------------------------------------------------------------------

create table public.leagues (
  code             text    not null,
  name             text    not null,
  country          text    not null,
  value_multiplier numeric not null,
  constraint leagues_pkey PRIMARY KEY (code),
  constraint leagues_name_key UNIQUE (name),
  constraint leagues_value_multiplier_check CHECK (value_multiplier > 0)
);

create table public.positions (
  code         text     not null,
  name         text     not null,
  target_depth smallint not null,   -- how many players a squad should have here
  sort_order   smallint not null,
  constraint positions_pkey PRIMARY KEY (code),
  constraint positions_sort_order_key UNIQUE (sort_order),
  constraint positions_target_depth_check CHECK (target_depth > 0)
);

create table public.playstyles (
  name        text    not null,
  w_press     numeric not null,     -- weights used by fn_style_fit
  w_passing   numeric not null,
  w_pace      numeric not null,
  w_physical  numeric not null,
  description text,
  constraint playstyles_pkey PRIMARY KEY (name),
  constraint playstyles_w_press_check    CHECK (w_press    >= 0),
  constraint playstyles_w_passing_check  CHECK (w_passing  >= 0),
  constraint playstyles_w_pace_check     CHECK (w_pace     >= 0),
  constraint playstyles_w_physical_check CHECK (w_physical >= 0),
  constraint playstyles_check CHECK (w_press + w_passing + w_pace + w_physical > 0)
);

create table public.data_sources (
  id     smallint not null,
  name   text     not null,
  url    text,
  as_of  date     not null,         -- snapshot date of the source
  notes  text,
  constraint data_sources_pkey PRIMARY KEY (id)
);


-- ---------------------------------------------------------------------
-- 2. Clubs and players
-- ---------------------------------------------------------------------

create table public.clubs (
  id              text     not null,            -- league_code || '-' || short_code
  league_code     text     not null,
  short_code      text     not null,
  name            text     not null,
  strength        smallint not null,
  default_style   text     not null,
  aliases         text     not null default ''::text,   -- search aliases
  has_real_squad  boolean  not null default false,      -- false = simulated squad (front end only)
  constraint clubs_pkey PRIMARY KEY (id),
  constraint clubs_name_key UNIQUE (name),
  constraint clubs_league_code_short_code_key UNIQUE (league_code, short_code),
  constraint clubs_check CHECK (id = league_code || '-' || short_code),
  constraint clubs_strength_check CHECK (strength >= 0 AND strength <= 100),
  constraint clubs_league_code_fkey FOREIGN KEY (league_code)   REFERENCES public.leagues(code),
  constraint clubs_default_style_fkey FOREIGN KEY (default_style) REFERENCES public.playstyles(name)
);

create table public.players (
  tm_id           integer  not null,            -- Transfermarkt player id
  name            text     not null,
  pos             text     not null,
  sub_position    text     not null,
  age             smallint not null,
  nationality     text     not null,
  contract_until  smallint,                     -- NULL = not in source (app treats it as 2027)
  market_value_m  numeric  not null,            -- EUR million
  est_rating      smallint not null,            -- SquadCraft estimate, not official
  est_potential   smallint not null,            -- SquadCraft estimate, not official
  press           smallint not null,
  passing         smallint not null,
  pace            smallint not null,
  physical        smallint not null,
  est_wage_k      numeric  not null,            -- EUR thousand, estimate
  tm_slug         text     not null,
  club_id         text     not null,
  source_id       smallint not null,
  constraint players_pkey PRIMARY KEY (tm_id),
  constraint players_age_check            CHECK (age >= 15 AND age <= 50),
  constraint players_contract_until_check CHECK (contract_until >= 2020 AND contract_until <= 2040),
  constraint players_market_value_m_check CHECK (market_value_m >= 0),
  constraint players_est_rating_check     CHECK (est_rating >= 1 AND est_rating <= 99),
  constraint players_est_potential_check  CHECK (est_potential >= 1 AND est_potential <= 99),
  constraint players_check                CHECK (est_potential >= est_rating),
  constraint players_press_check          CHECK (press   >= 0 AND press   <= 100),
  constraint players_passing_check        CHECK (passing >= 0 AND passing <= 100),
  constraint players_pace_check           CHECK (pace    >= 0 AND pace    <= 100),
  constraint players_physical_check       CHECK (physical >= 0 AND physical <= 100),
  constraint players_est_wage_k_check     CHECK (est_wage_k >= 0),
  constraint players_club_id_fkey   FOREIGN KEY (club_id)   REFERENCES public.clubs(id),
  constraint players_pos_fkey       FOREIGN KEY (pos)       REFERENCES public.positions(code),
  constraint players_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.data_sources(id)
);


-- ---------------------------------------------------------------------
-- 3. Free agents
-- ---------------------------------------------------------------------

create table public.free_agents (
  id              integer  generated always as identity not null,
  tm_id           integer,                      -- NULL = no Transfermarkt profile
  name            text     not null,
  pos             text     not null,
  sub_position    text     not null,
  age             smallint not null,
  nationality     text,
  market_value_m  numeric  not null,
  est_rating      smallint not null,
  est_potential   smallint not null,
  press           smallint not null,
  passing         smallint not null,
  pace            smallint not null,
  physical        smallint not null,
  est_wage_k      numeric  not null,
  tm_slug         text,
  last_club       text     not null,
  free_since      date,                         -- month precision; NULL = unknown
  status          text     not null,            -- 'verified' or 'reported'
  source_id       smallint not null,
  constraint free_agents_pkey PRIMARY KEY (id),
  constraint free_agents_tm_id_key UNIQUE (tm_id),
  constraint free_agents_age_check            CHECK (age >= 15 AND age <= 50),
  constraint free_agents_market_value_m_check CHECK (market_value_m >= 0),
  constraint free_agents_est_rating_check     CHECK (est_rating >= 1 AND est_rating <= 99),
  constraint free_agents_est_potential_check  CHECK (est_potential >= 1 AND est_potential <= 99),
  constraint free_agents_check                CHECK (est_potential >= est_rating),
  constraint free_agents_press_check          CHECK (press   >= 0 AND press   <= 100),
  constraint free_agents_passing_check        CHECK (passing >= 0 AND passing <= 100),
  constraint free_agents_pace_check           CHECK (pace    >= 0 AND pace    <= 100),
  constraint free_agents_physical_check       CHECK (physical >= 0 AND physical <= 100),
  constraint free_agents_est_wage_k_check     CHECK (est_wage_k >= 0),
  constraint free_agents_status_check         CHECK (status = ANY (ARRAY['verified'::text, 'reported'::text])),
  constraint free_agents_pos_fkey       FOREIGN KEY (pos)       REFERENCES public.positions(code),
  constraint free_agents_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.data_sources(id)
);


-- ---------------------------------------------------------------------
-- 4. Indexes (for the club/position and free-agent lookups)
-- ---------------------------------------------------------------------

CREATE INDEX clubs_league_idx           ON public.clubs       USING btree (league_code);
CREATE INDEX players_club_pos_idx       ON public.players     USING btree (club_id, pos);
CREATE INDEX free_agents_pos_status_idx ON public.free_agents USING btree (pos, status);


-- ---------------------------------------------------------------------
-- 5. Security: row-level security, read-only public access
--    (no insert/update/delete policy exists, so the public key cannot write)
-- ---------------------------------------------------------------------

alter table public.leagues       enable row level security;
alter table public.positions     enable row level security;
alter table public.playstyles    enable row level security;
alter table public.data_sources  enable row level security;
alter table public.clubs         enable row level security;
alter table public.players       enable row level security;
alter table public.free_agents   enable row level security;

create policy "public read" on public.leagues      for select to anon, authenticated using (true);
create policy "public read" on public.positions    for select to anon, authenticated using (true);
create policy "public read" on public.playstyles   for select to anon, authenticated using (true);
create policy "public read" on public.data_sources for select to anon, authenticated using (true);
create policy "public read" on public.clubs        for select to anon, authenticated using (true);
create policy "public read" on public.players      for select to anon, authenticated using (true);
create policy "public read" on public.free_agents  for select to anon, authenticated using (true);


-- ---------------------------------------------------------------------
-- 6. Functions (the same scoring rules as the JavaScript in index.html)
-- ---------------------------------------------------------------------

-- Playstyle fit 0-100: weighted average of press/passing/pace/physical.
-- Goalkeepers use a separate rule (passing and physical only).
CREATE OR REPLACE FUNCTION public.fn_style_fit(p_pos text, p_press integer, p_passing integer, p_pace integer, p_physical integer, p_style text)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case when p_pos = 'GK'
    then round(least(95::numeric, greatest(30::numeric, 55 + (p_passing - 55) * s.w_passing / 4 + (p_physical - 55) * s.w_physical / 5 + 12)))::int
    else round((s.w_press * p_press + s.w_passing * p_passing + s.w_pace * p_pace + s.w_physical * p_physical)
               / (s.w_press + s.w_passing + s.w_pace + s.w_physical))::int
  end
  from public.playstyles s where s.name = p_style;
$function$;

-- Weakest position of a club: lowest best-player rating, adjusted by squad depth.
CREATE OR REPLACE FUNCTION public.fn_weakest_position(p_club_id text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select pos.code
  from public.positions pos
  left join lateral (
    select max(p.est_rating) as best, count(*) as n
    from public.players p where p.club_id = p_club_id and p.pos = pos.code
  ) s on true
  order by coalesce(s.best, 50) + s.n::numeric / pos.target_depth * 8, pos.sort_order
  limit 1;
$function$;

-- Emergency free agents for an injured player's position, ranked by
-- closeness to the target rating and by playstyle fit.
CREATE OR REPLACE FUNCTION public.fn_emergency_candidates(p_club_id text, p_pos text, p_style text, p_max_wage numeric DEFAULT 999, p_allow_over_32 boolean DEFAULT false, p_verified_only boolean DEFAULT false, p_target_rating integer DEFAULT NULL::integer, p_limit integer DEFAULT 12)
 RETURNS TABLE(rnk integer, name text, sub_position text, age smallint, est_rating smallint, est_wage_k numeric, style_fit integer, rating_gap integer, status text, last_club text, score numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with t as (
    select coalesce(p_target_rating,
                    (select max(p.est_rating) from public.players p where p.club_id = p_club_id and p.pos = p_pos),
                    70)::int as target
  ), c as (
    select f.id, f.name, f.sub_position, f.age, f.est_rating, f.est_wage_k, f.status, f.last_club, t.target,
           public.fn_style_fit(f.pos, f.press, f.passing, f.pace, f.physical, p_style) as fit
    from public.free_agents f cross join t
    where f.pos = p_pos and f.est_wage_k <= p_max_wage
      and (p_allow_over_32 or f.age <= 32)
      and (not p_verified_only or f.status = 'verified')
  ), s as (
    select c.*, (c.est_rating * 1.5 + c.fit * 0.6 - abs(c.est_rating - c.target) * 0.8)::numeric as sc from c
  )
  select (row_number() over (order by s.sc desc, s.id))::int, s.name, s.sub_position, s.age, s.est_rating, s.est_wage_k,
         s.fit, (s.est_rating - s.target)::int, s.status, s.last_club, round(s.sc, 2)
  from s order by 1 limit p_limit;
$function$;


-- ---------------------------------------------------------------------
-- 7. Views (security_invoker = the caller's RLS applies)
-- ---------------------------------------------------------------------

-- One row per club: squad size, total value, average age, expiring contracts.
CREATE VIEW public.v_club_summary WITH (security_invoker = true) AS
 SELECT c.id AS club_id,
    c.name AS club,
    c.league_code,
    c.default_style,
    c.has_real_squad,
    count(p.tm_id)::integer AS squad_size,
    COALESCE(sum(p.market_value_m), 0::numeric) AS total_value_m,
    round(avg(p.age), 1) AS avg_age,
    count(p.tm_id) FILTER (WHERE COALESCE(p.contract_until::integer, 2027) <= 2027)::integer AS contracts_expiring
   FROM clubs c
     LEFT JOIN players p ON p.club_id = c.id
  GROUP BY c.id;

-- Depth per club and position (only clubs with a real squad).
CREATE VIEW public.v_squad_depth WITH (security_invoker = true) AS
 SELECT c.id AS club_id,
    c.name AS club,
    pos.code AS pos,
    pos.target_depth,
    count(p.tm_id)::integer AS squad_count,
    (count(p.tm_id) - pos.target_depth)::integer AS depth_gap,
    max(p.est_rating) AS starter_rating
   FROM clubs c
     CROSS JOIN positions pos
     LEFT JOIN players p ON p.club_id = c.id AND p.pos = pos.code
  WHERE c.has_real_squad
  GROUP BY c.id, c.name, pos.code, pos.target_depth, pos.sort_order;

-- Only free agents that were verified (not just reported in the news).
CREATE VIEW public.v_free_agents_verified WITH (security_invoker = true) AS
 SELECT id,
    tm_id,
    name,
    pos,
    sub_position,
    age,
    nationality,
    market_value_m,
    est_rating,
    est_potential,
    press,
    passing,
    pace,
    physical,
    est_wage_k,
    tm_slug,
    last_club,
    free_since,
    status,
    source_id
   FROM free_agents
  WHERE status = 'verified'::text;
