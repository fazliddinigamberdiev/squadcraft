// Finds players who LEFT a club of ours for a club outside our 96 (Node 18+, run on your computer, no API key)
//   node tools/plan_departures.js     -> writes departures_report.txt and departures.json in the current folder
// Needs squads.json (fetch_squads.js) and transfers_out.json (fetch_transfers.js). Nothing is changed in the database.
// A player is listed only when ALL of these hold:
//   - he is in our database at club X and is NOT found in X's current API squad,
//   - X has exactly one departure record (after 1 May 2026) for a player whose name fits his,
//   - that record is not a "Return from loan" and its destination is not one of our 96 clubs.
const fs = require("fs"), path = require("path");
const { matchClub, scoreName, toks } = require("./match_photos.js");
(async () => {
  const cfg = new Function("window", fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8") + ";return window.SC_CONFIG;")({});
  const H = { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey };
  const get = async q => { const r = await fetch(cfg.url + "/rest/v1/" + q, { headers: H }); if (!r.ok) throw new Error("Database read failed: " + r.status); return r.json(); };
  const squads = JSON.parse(fs.readFileSync("squads.json", "utf8"));
  const trans = JSON.parse(fs.readFileSync("transfers_out.json", "utf8"));
  const clubs = await get("v_club_profile?select=id,name,is_real");
  const real = new Set(clubs.filter(c => c.is_real).map(c => c.id)), cname = Object.fromEntries(clubs.map(c => [c.id, c.name]));
  const ours = new Set(Object.values(trans).map(t => t.team_id));
  let dbp = [];
  for (let off = 0; ; off += 1000) { const rows = await get(`players?select=tm_id,name,pos,age,club_id&order=tm_id&limit=1000&offset=${off}`); dbp = dbp.concat(rows); if (rows.length < 1000) break; }
  const byClub = {}; dbp.forEach(p => (byClub[p.club_id] = byClub[p.club_id] || []).push(p));

  const out = [], lines = [], byType = {};
  for (const [club, sq] of Object.entries(squads)) {
    if (!real.has(club) || !trans[club]) continue;
    const db = byClub[club] || [];
    const r = matchClub(db, sq.players);
    const deps = trans[club].departures.filter(d => d.type !== "Return from loan" && !ours.has(d.to_id));
    const hits = [];
    for (const d of r.unmatched) {
      const c = deps.filter(x => scoreName(d, toks(x.name)) >= 2);
      const ids = new Set(c.map(x => x.api_id));
      if (ids.size !== 1) continue;
      const x = c.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      hits.push({ tm_id: d.tm_id, name: d.name, pos: d.pos, age: d.age, club, type: x.type, to: x.to || "-", date: x.date, api: x.name });
      byType[x.type] = (byType[x.type] || 0) + 1;
    }
    out.push(...hits);
    const arrivals = sq.players.length - r.matches.length;
    lines.push(`\n## ${cname[club]}: in DB ${db.length}, leaving ${hits.length}, current API squad ${sq.players.length}, API players not in DB ~${arrivals}`);
    hits.forEach(h => lines.push(`${h.name} (${h.pos}, ${h.age}): ${h.type} -> ${h.to} on ${h.date}   [API: ${h.api}]`));
  }
  fs.writeFileSync("departures.json", JSON.stringify(out, null, 1));
  fs.writeFileSync("departures_report.txt", `${out.length} departures to clubs outside our 96\nBy type: ${JSON.stringify(byType)}\n` + lines.join("\n") + "\n");
  console.log(`${out.length} departures found. By type: ${JSON.stringify(byType)}. See departures_report.txt (nothing has been changed).`);
})();
