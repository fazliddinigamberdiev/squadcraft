// Collects the current squad of every club from API-Football into ./squads.json   (Node 18+, run on your computer)
//   export APIFOOTBALL_KEY=your_key_here
//   node tools/fetch_squads.js
// Cost: 5 requests (all teams per country) + 1 per club (96). The free plan allows ~100 per day, so the script
// stops cleanly when the quota is used up; run it again the next day and it continues where it stopped.
// squads.json is a work file for matching: do NOT commit it. The key is read from the environment only.
const fs = require("fs"), path = require("path");
const KEY = process.env.APIFOOTBALL_KEY;
if (!KEY) { console.error("Set your key first:  export APIFOOTBALL_KEY=your_key_here"); process.exit(1); }
const cfg = new Function("window", fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8") + ";return window.SC_CONFIG;")({});
const OUTF = "squads.json", TEAMF = "teams_by_country.json";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["fc", "cf", "afc", "ac", "as", "sc", "ssc", "us", "sv", "vfb", "vfl", "tsg", "club", "calcio", "de", "la", "el", "1", "05", "07", "04", "1899", "1907", "1913", "09"]);
const words = t => norm(t).split(" ").filter(w => w && !STOP.has(w));
const BAD = /(\bw|\bu\d{2}|\bii|\biii|\bb|\bwomen|\breserves?|\bamateur)$/;
// same search-name overrides as the logo script (our display name -> API name)
const ALT = { "BL-TSG": "Hoffenheim", "L1-RCL": "Lens", "L1-RCS": "Strasbourg", "L1-REN": "Rennes", "LL-ALA": "Alaves", "PL-COV": "Coventry", "PL-IPS": "Ipswich", "PL-LEE": "Leeds", "SA-INT": "Inter", "SA-MIL": "AC Milan", "L1-PSG": "Paris Saint Germain", "L1-OM": "Marseille", "L1-OL": "Lyon", "BL-FCB": "Bayern",
  "BL-BVB": "Borussia Dortmund", "BL-BMG": "Borussia Monchengladbach", "BL-KOE": "FC Koln", "BL-SVW": "Werder Bremen", "LL-ATH": "Athletic Club", "LL-ATM": "Atletico Madrid", "LL-BAR": "Barcelona", "LL-RSO": "Real Sociedad",
  "L1-ASM": "Monaco", "L1-BRE": "Brest", "L1-NIC": "Nice", "PL-BHA": "Brighton", "PL-MCI": "Manchester City", "PL-MUN": "Manchester United", "PL-NEW": "Newcastle", "PL-NFO": "Nottingham Forest", "PL-TOT": "Tottenham" };
let used = 0;
async function api(p) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch("https://v3.football.api-sports.io" + p, { headers: { "x-apisports-key": KEY } });
    used++;
    if (r.status === 429) { console.log("  rate limited, waiting 30s"); await sleep(30000); continue; }
    const j = await r.json();
    if (j.errors && !Array.isArray(j.errors) && Object.keys(j.errors).length) {
      const m = JSON.stringify(j.errors);
      if (/rateLimit/i.test(m)) { console.log("  rate limited, waiting 30s"); await sleep(30000); continue; }
      throw new Error(m);
    }
    return j;
  }
  throw new Error("rate limited");
}
const load = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 1));
(async () => {
  const r0 = await fetch(`${cfg.url}/rest/v1/v_club_profile?select=id,name,country&order=id`, { headers: { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey } });
  if (!r0.ok) throw new Error("Could not read clubs from the database: " + r0.status);
  const clubs = await r0.json();
  const teams = load(TEAMF), squads = load(OUTF);
  try {
    for (const country of [...new Set(clubs.map(c => c.country))]) {
      if (teams[country]) continue;
      const j = await api("/teams?country=" + encodeURIComponent(country));
      teams[country] = (j.response || []).map(x => ({ id: x.team.id, name: x.team.name, national: x.team.national }));
      save(TEAMF, teams); console.log("teams", country, teams[country].length); await sleep(7000);
    }
    for (const c of clubs) {
      if (squads[c.id]) { console.log("skip ", c.id); continue; }
      const want = words(c.name), alt = norm(ALT[c.id] || "");
      const cand = (teams[c.country] || []).filter(t => !t.national && !BAD.test(norm(t.name)))
        .map(t => ({ t, s: words(t.name).filter(w => want.includes(w) || (alt && words(alt).includes(w))).length * 2 - Math.abs(words(t.name).length - want.length)
                          + (norm(t.name) === norm(c.name) || norm(t.name) === alt ? 5 : 0) }))
        .sort((a, b) => b.s - a.s);
      if (!cand.length || cand[0].s <= 0) { console.log("MISS ", c.id, c.name); continue; }
      const t = cand[0].t;
      const j = await api("/players/squads?team=" + t.id);
      const players = (j.response && j.response[0] && j.response[0].players) || [];
      squads[c.id] = { team_id: t.id, team_name: t.name, players };
      save(OUTF, squads);
      console.log("ok   ", c.id.padEnd(7), c.name, "<-", t.name, `(${players.length} players)`);
      await sleep(7000);
    }
  } catch (e) { console.log("STOPPED:", e.message, "- run it again later, it continues where it stopped."); }
  console.log(`\n${Object.keys(squads).length}/${clubs.length} clubs collected, ${used} requests used this run.`);
})();
