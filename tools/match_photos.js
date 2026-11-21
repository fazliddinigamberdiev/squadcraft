// Matches API-Football squad players (squads.json) to our players and downloads their photos to ./players/<tm_id>.png   (Node 18+, run on your computer)
//   node tools/fetch_squads.js          (first: collects squads.json)
//   node tools/match_photos.js          (matches, then downloads; writes players/_report.txt)
// Pass 1 matches inside the same club (name + position/age checks). Pass 2 finds players who moved clubs since our data was collected,
// and only matches them when exactly one API player fits. Simulated clubs (invented players) never get photos.
// Already-downloaded photos are skipped, so you can stop and re-run. No API key needed: photo files are static images.
const fs = require("fs"), path = require("path");
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/ł/g, "l").replace(/đ/g, "d").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();
const toks = t => norm(t).split(" ").filter(Boolean);
const GROUP = { GK: "Goalkeeper", CB: "Defender", FB: "Defender", DM: "Midfielder", CM: "Midfielder", AM: "Midfielder", W: "Attacker", ST: "Attacker" };

// how well does our player name `d` fit the API player name tokens `at`?  3 identical, 2 strong, 1 weak (same club only), 0 no
function scoreName(d, at) {
  const dt = toks(d.name);
  if (!dt.length || !at.length) return 0;
  if (dt.join(" ") === at.join(" ")) return 3;
  if (at[0].length === 1 && at.length > 1) { const rest = at.slice(1); return dt[0][0] === at[0] && rest.every(w => dt.includes(w)) ? 2 : 0; }   // "T. Courtois"
  if (at.length >= 2 && at.every(w => dt.includes(w))) return 2;                 // API name shorter than ours
  if (dt.length >= 2 && dt.every(w => at.includes(w))) return 2;                 // our name shorter than API's
  if (dt.length === 1 && at.length >= 2 && at.includes(dt[0])) return 1;         // "Alisson" vs "Alisson Becker"
  return 0;
}

// pass 1, one club. returns { matches, unmatched, ambiguous }
function matchClub(db, api) {
  const A = api.map(p => ({ p, t: toks(p.name) })), used = new Set(), matches = [], unmatched = [], ambiguous = [];
  for (const d of db) {
    let c = A.filter(a => !used.has(a.p.id)).map(a => ({ a, s: scoreName(d, a.t) })).filter(x => x.s > 0);
    if (c.length > 1) {                                                           // tie-break: best score, same position group, closest age
      const top = Math.max(...c.map(x => x.s)); c = c.filter(x => x.s === top);
      const same = c.filter(x => x.a.p.position === GROUP[d.pos]); if (same.length) c = same;
      if (c.length > 1) { c.sort((x, y) => Math.abs(x.a.p.age - d.age) - Math.abs(y.a.p.age - d.age)); if (Math.abs(c[0].a.p.age - d.age) === Math.abs(c[1].a.p.age - d.age)) { ambiguous.push(d); continue; } }
    }
    if (!c.length) { unmatched.push(d); continue; }
    if (Math.abs(c[0].a.p.age - d.age) > 3 && c[0].s < 3) { unmatched.push(d); continue; }   // same-looking name, different person
    used.add(c[0].a.p.id); matches.push({ tm_id: d.tm_id, api: c[0].a.p.id, name: d.name, photo: c[0].a.p.photo });
  }
  return { matches, unmatched, ambiguous };
}

// pass 2: leftovers against ALL squads; only when exactly one API player fits (score >= 2, same position group, age within 2)
function matchEverywhere(leftovers, squads, usedIds) {
  const pool = [];
  for (const sq of Object.values(squads)) for (const p of sq.players) pool.push({ p, t: toks(p.name) });
  const found = [], rest = [];
  for (const d of leftovers) {
    const c = pool.filter(a => !usedIds.has(a.p.id) && a.p.position === GROUP[d.pos] && Math.abs(a.p.age - d.age) <= 2 && scoreName(d, a.t) >= 2);
    const ids = new Set(c.map(x => x.p.id));
    if (ids.size === 1) { usedIds.add(c[0].p.id); found.push({ tm_id: d.tm_id, api: c[0].p.id, name: d.name, photo: c[0].p.photo, moved: true }); } else rest.push(d);
  }
  return { found, rest };
}
module.exports = { matchClub, matchEverywhere, scoreName };
if (require.main !== module) return;

(async () => {
  const cfg = new Function("window", fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8") + ";return window.SC_CONFIG;")({});
  const H = { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey };
  const get = async q => { const r = await fetch(cfg.url + "/rest/v1/" + q, { headers: H }); if (!r.ok) throw new Error("Database read failed: " + r.status); return r.json(); };
  const squads = JSON.parse(fs.readFileSync("squads.json", "utf8"));
  const real = new Set((await get("v_club_profile?select=id,is_real")).filter(c => c.is_real).map(c => c.id));
  let dbp = [];
  for (let off = 0; ; off += 1000) { const rows = await get(`players?select=tm_id,name,pos,age,club_id&order=tm_id&limit=1000&offset=${off}`); dbp = dbp.concat(rows); if (rows.length < 1000) break; }
  const byClub = {}; dbp.forEach(p => (byClub[p.club_id] = byClub[p.club_id] || []).push(p));
  const OUT = "players"; fs.mkdirSync(OUT, { recursive: true });
  const all = [], rep = [], leftovers = [], usedIds = new Set();
  for (const [club, sq] of Object.entries(squads)) {
    if (!real.has(club)) { rep.push(`${club} ${sq.team_name}: simulated club, no photos`); continue; }
    const r = matchClub(byClub[club] || [], sq.players);
    r.matches.forEach(m => usedIds.add(m.api)); all.push(...r.matches); leftovers.push(...r.unmatched, ...r.ambiguous);
    rep.push(`${club} ${sq.team_name}: ${r.matches.length}/${(byClub[club] || []).length} matched in club`);
  }
  const e = matchEverywhere(leftovers, squads, usedIds);
  all.push(...e.found);
  rep.push("", `Pass 2 (moved clubs): ${e.found.length} found: ` + e.found.map(m => m.name).join(", "));
  rep.push("", `Still without a photo (${e.rest.length}): ` + e.rest.map(p => p.name + " [" + p.club_id + "]").join(", "));
  console.log(`${all.length} players matched (${e.found.length} of them moved clubs). Players in the database: ${dbp.length}. Downloading photos…`);
  let n = 0, fail = 0;
  for (const m of all) {
    const f = path.join(OUT, m.tm_id + ".png");
    if (fs.existsSync(f)) continue;
    try {
      const r = await fetch(m.photo); if (!r.ok) throw new Error(r.status);
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); n++;
      if (n % 100 === 0) console.log(n + " downloaded");
    } catch (er) { fail++; rep.push(`download failed: ${m.name} (${er.message})`); if (fail >= 15) { console.log("Too many failures (maybe a limit). Stopping; run again later."); break; } }
    await new Promise(r => setTimeout(r, 250));
  }
  fs.writeFileSync(path.join(OUT, "_report.txt"), rep.join("\n") + "\n");
  console.log(`Done: ${n} new photos, ${fail} failed. See players/_report.txt`);
})();
