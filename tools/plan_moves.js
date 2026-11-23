// Finds players whose real club changed since our data was collected, and writes SQL to move them (Node 18+, run on your computer, no API key)
//   node tools/plan_moves.js        -> writes moves.sql and moves_report.txt in the current folder
// Uses squads.json (from fetch_squads.js). A move is planned only when ALL of these hold:
//   - the player is not found in his current club's API squad,
//   - exactly ONE API player fits him (name score >= 2, same position group, age within 1) across all squads,
//   - that squad belongs to a real club (simulated clubs have invented players), and it is a different club.
// Players who left for a club outside our 96 are NOT touched. Nothing is changed in the database until you run moves.sql.
const fs = require("fs"), path = require("path");
const { matchClub, scoreName, GROUP, toks } = require("./match_photos.js");
(async () => {
  const cfg = new Function("window", fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8") + ";return window.SC_CONFIG;")({});
  const H = { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey };
  const get = async q => { const r = await fetch(cfg.url + "/rest/v1/" + q, { headers: H }); if (!r.ok) throw new Error("Database read failed: " + r.status); return r.json(); };
  const squads = JSON.parse(fs.readFileSync("squads.json", "utf8"));
  const clubs = await get("v_club_profile?select=id,name,is_real");
  const real = new Set(clubs.filter(c => c.is_real).map(c => c.id)), cname = Object.fromEntries(clubs.map(c => [c.id, c.name]));
  let dbp = [];
  for (let off = 0; ; off += 1000) { const rows = await get(`players?select=tm_id,name,pos,age,club_id&order=tm_id&limit=1000&offset=${off}`); dbp = dbp.concat(rows); if (rows.length < 1000) break; }
  const byClub = {}; dbp.forEach(p => (byClub[p.club_id] = byClub[p.club_id] || []).push(p));
  const used = new Set(), left = [];
  for (const [club, sq] of Object.entries(squads)) {
    if (!real.has(club)) continue;
    const r = matchClub(byClub[club] || [], sq.players);
    r.matches.forEach(m => used.add(m.api)); left.push(...r.unmatched, ...r.ambiguous);
  }
  const pool = [];
  for (const [club, sq] of Object.entries(squads)) if (real.has(club)) for (const p of sq.players) pool.push({ p, club, t: toks(p.name) });
  const moves = [], none = [];
  for (const d of left) {
    const c = pool.filter(a => !used.has(a.p.id) && a.p.position === GROUP[d.pos] && Math.abs(a.p.age - d.age) <= 1 && scoreName(d, a.t) >= 2);
    const ids = new Set(c.map(x => x.p.id));
    if (ids.size === 1 && c[0].club !== d.club_id) { used.add(c[0].p.id); moves.push({ d, to: c[0].club, apiName: c[0].p.name }); } else none.push(d);
  }
  const sql = ["-- Summer 2026 transfers: moves real players to the club the API shows them at", "begin;"];
  moves.forEach(m => sql.push(`update players set club_id = '${m.to}' where tm_id = ${Number(m.d.tm_id)} and club_id = '${m.d.club_id}';  -- ${m.d.name.replace(/'/g, "")}: ${m.d.club_id} -> ${m.to}`));
  sql.push("commit;");
  fs.writeFileSync("moves.sql", sql.join("\n") + "\n");
  fs.writeFileSync("moves_report.txt", `${moves.length} planned moves\n` + moves.map(m => `${m.d.name} (${m.d.pos}, ${m.d.age}): ${cname[m.d.club_id]} -> ${cname[m.to]}   [API: ${m.apiName}]`).join("\n") + "\n");
  console.log(`${moves.length} moves planned. See moves_report.txt and moves.sql (nothing has been changed yet).`);
})();
