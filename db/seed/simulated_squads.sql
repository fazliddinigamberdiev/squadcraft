-- Simulated squads for the 14 newly promoted clubs (no real data). Made-up players generated inside the database.
-- Deterministic: setseed(hash of club id) so the same club always gets the same squad. Run once, after load_data.sql:
--   select fn_seed_simulated_squads();   -- returns the number of players created (328 in the delivered database)
create or replace function fn_seed_simulated_squads() returns integer language plpgsql set search_path = public as $$
declare
  c record;
  names jsonb := '{
   "PL":{"f":["Jack","Harry","Callum","Ollie","Reece","Mason","Kieran","Josh","Ethan","Lewis","Tyrese","Jordan","Ben","Alfie","Rhys","Connor"],"l":["Walker","Hughes","Barnes","Fletcher","Mitchell","Doyle","Carter","Palmer","Holloway","Bennett","Whitaker","Gray","Ashworth","Crane","Pearce","Ellison"]},
   "SA":{"f":["Luca","Matteo","Davide","Federico","Alessandro","Lorenzo","Nicolò","Andrea","Simone","Gianluca","Riccardo","Tommaso","Marco","Pietro"],"l":["Rossi","Bianchi","Ferraro","Esposito","Colombo","Ricci","Marino","Greco","Bruno","Galli","Conti","De Luca","Mancini","Lombardi"]},
   "LL":{"f":["Pablo","Sergio","Álvaro","Iker","Javier","Unai","Hugo","Mario","Adrián","Rubén","Diego","Marcos","Iván","Raúl"],"l":["García","Martínez","López","Sánchez","Romero","Navarro","Torres","Ruiz","Moreno","Herrera","Iglesias","Ortega","Castro","Vidal"]},
   "BL":{"f":["Jonas","Leon","Felix","Lukas","Niklas","Tim","Florian","Maximilian","Paul","Jannik","Kevin","Moritz","Julian","Elias"],"l":["Müller","Schmidt","Weber","Wagner","Becker","Hoffmann","Schulz","Koch","Richter","Klein","Wolf","Neumann","Braun","Krüger"]},
   "L1":{"f":["Hugo","Théo","Lucas","Mathis","Enzo","Nathan","Rayan","Kylian","Adrien","Bastien","Maxence","Yanis","Jules","Noé"],"l":["Martin","Bernard","Dubois","Lefèvre","Moreau","Laurent","Girard","Fontaine","Rousseau","Mercier","Blanc","Garnier","Chevalier","Faure"]},
   "INT":{"f":["Mateo","Kai","Ilyas","Emre","Bruno","Sami","Viktor","Malik","Nikola","Aziz","Yusuf","Kenji","Amir","Kofi","Rui","Timur","Ousmane","Bilal","Dario","Erling"],"l":["Okafor","Santos","Kovač","Lindqvist","Rahimov","Petrov","Haddad","Novak","Silva","Mendes","Larsen","Tanaka","Yılmaz","Mensah","Aliyev","Diallo","Kurt","Nordin","Abiola","Correia"]}
  }'::jsonb;
  bias jsonb := '{
   "GK":{"press":-15,"passing":0,"pace":-10,"physical":10},
   "CB":{"press":0,"passing":-5,"pace":-5,"physical":12},
   "FB":{"press":5,"passing":0,"pace":10,"physical":0},
   "DM":{"press":5,"passing":5,"pace":-5,"physical":8},
   "CM":{"press":5,"passing":10,"pace":0,"physical":0},
   "AM":{"press":0,"passing":12,"pace":5,"physical":-8},
   "W":{"press":3,"passing":0,"pace":14,"physical":-8},
   "ST":{"press":2,"passing":-3,"pace":6,"physical":8}
  }'::jsonb;
  sbias jsonb := '{
   "High-Press":{"press":8,"pace":4},
   "Possession":{"passing":9},
   "Counter-Attack":{"pace":8,"physical":3},
   "Low-Block":{"physical":8,"press":-3}
  }'::jsonb;
  subpos jsonb := '{"GK":"Goalkeeper","CB":"Centre-Back","FB":"Full-Back","DM":"Defensive Midfield","CM":"Central Midfield","AM":"Attacking Midfield","W":"Winger","ST":"Centre-Forward"}'::jsonb;
  pos_list text[] := array['GK','CB','FB','DM','CM','AM','W','ST'];
  v_pos text; i int; n int; lvl int;
  v_age int; v_rating int; v_pot int;
  v_press int; v_pass int; v_pace int; v_phys int;
  v_contract int; v_wage numeric; v_val numeric; agef numeric; cf numeric; yrs_left int;
  v_local boolean; v_pool jsonb; v_first text; v_last text; v_lastpool jsonb;
  v_id int; v_total int := 0; v_drops int;
begin
  for c in
    select cl.id, cl.league_code, cl.strength, cl.default_style, l.value_multiplier as mult, l.country
    from public.clubs cl join public.leagues l on l.code = cl.league_code
    where not cl.has_real_squad and not exists (select 1 from public.players p where p.club_id = cl.id)
    order by cl.id
  loop
    perform setseed((abs(hashtext(c.id)::bigint) % 1000000) / 1000000.0);
    select coalesce(min(tm_id), 0) into v_id from public.players where tm_id < 0;
    foreach v_pos in array pos_list loop
      n := (select target_depth from public.positions where code = v_pos);
      for i in 0 .. n - 1 loop
        lvl := c.strength - case when i >= ceil(n / 2.0) then 5 else 0 end - case when v_pos = 'GK' and i = 2 then 6 else 0 end;
        v_age := floor(random() * 17)::int + 18;
        v_rating := greatest(52, least(92, round(lvl + (floor(random() * 11)::int - 5)
                      - case when v_age < 21 then floor(random() * 6)::int + 2 else 0 end
                      - case when v_age > 32 then floor(random() * 5)::int else 0 end)::int));
        v_pot := case when v_age <= 23 then greatest(v_rating, least(94, v_rating + floor(random() * 11)::int + 4))
                      when v_age <= 27 then v_rating + floor(random() * 4)::int else v_rating end;
        v_press := greatest(25, least(96, floor(random() * 45)::int + 40 + (bias -> v_pos ->> 'press')::int
                     + coalesce((sbias -> c.default_style ->> 'press')::int, 0) - case when v_age > 30 then floor(random() * 11)::int + 5 else 0 end));
        v_pass  := greatest(25, least(96, floor(random() * 45)::int + 40 + (bias -> v_pos ->> 'passing')::int
                     + coalesce((sbias -> c.default_style ->> 'passing')::int, 0)));
        v_pace  := greatest(25, least(96, floor(random() * 45)::int + 40 + (bias -> v_pos ->> 'pace')::int
                     + coalesce((sbias -> c.default_style ->> 'pace')::int, 0) - case when v_age > 30 then floor(random() * 11)::int + 5 else 0 end));
        v_phys  := greatest(25, least(96, floor(random() * 45)::int + 40 + (bias -> v_pos ->> 'physical')::int
                     + coalesce((sbias -> c.default_style ->> 'physical')::int, 0)));
        v_contract := 2026 + floor(random() * 6)::int;
        v_wage := round(exp((v_rating - 60) / 8.5) * 5 * c.mult);
        agef := case when v_age <= 21 then 1.25 + (v_pot - v_rating) / 18.0 when v_age <= 26 then 1.2
                     when v_age <= 29 then 1.0 when v_age <= 31 then 0.65 else 0.35 end;
        yrs_left := v_contract - 2026;
        cf := case when yrs_left <= 0 then 0.55 when yrs_left = 1 then 0.8 else 1 end;
        v_val := greatest(0.3, round(exp((v_rating - 60) / 6.2) * 0.65 * agef * cf * c.mult * 10) / 10);
        v_local := random() < 0.55;
        v_pool := case when v_local then names -> c.league_code else names -> 'INT' end;
        v_first := v_pool -> 'f' ->> floor(random() * jsonb_array_length(v_pool -> 'f'))::int;
        v_lastpool := case when random() < 0.5 then v_pool -> 'l' else names -> 'INT' -> 'l' end;
        v_last := v_lastpool ->> floor(random() * jsonb_array_length(v_lastpool))::int;
        v_id := v_id - 1;
        insert into public.players (tm_id, name, pos, sub_position, age, nationality, contract_until, market_value_m,
           est_rating, est_potential, press, passing, pace, physical, est_wage_k, tm_slug, club_id, source_id)
        values (v_id, v_first || ' ' || v_last, v_pos, subpos ->> v_pos, v_age, case when v_local then c.country else 'International' end,
           v_contract, v_val, v_rating, v_pot, v_press, v_pass, v_pace, v_phys, v_wage, '', c.id, 4);
        v_total := v_total + 1;
      end loop;
    end loop;
    -- realistic gaps: remove 1-2 random players
    v_drops := floor(random() * 2)::int + 1;
    delete from public.players where tm_id in (select tm_id from public.players where club_id = c.id and source_id = 4 order by random() limit v_drops);
    v_total := v_total - v_drops;
  end loop;
  return v_total;
end $$;
revoke execute on function fn_seed_simulated_squads() from public, anon, authenticated;
