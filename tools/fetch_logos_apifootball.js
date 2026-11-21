// Downloads club crests from API-Football (api-sports.io) into ./logos/<club id>.png   (Node 18+, run on your computer)
//   export APIFOOTBALL_KEY=your_key_here        (get a free key at https://dashboard.api-football.com)
//   node tools/fetch_logos_apifootball.js
// One search request per club (96 total; the free plan allows ~100 per day and 10 per minute, so this takes ~12 minutes).
// Already-downloaded clubs are skipped, so you can stop and re-run. A report is written to logos/_report.txt.
// The key is read from the environment only: never put it in the repo or send it to anyone.
const fs = require("fs"), path = require("path");
const KEY = process.env.APIFOOTBALL_KEY;
if (!KEY) { console.error("Set your key first:  export APIFOOTBALL_KEY=your_key_here"); process.exit(1); }
const cfg = new Function("window", fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8") + ";return window.SC_CONFIG;")({});
const OUT = path.join(__dirname, "..", "logos");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["fc", "cf", "afc", "ac", "as", "sc", "ssc", "us", "sv", "vfb", "vfl", "tsg", "club", "calcio", "de", "la", "el", "1", "05", "07", "04", "1899", "1907", "1913", "09"]);
const words = t => norm(t).split(" ").filter(w => w && !STOP.has(w));
// search words that differ from our display names
const SEARCH = { "BL-TSG": "Hoffenheim", "L1-RCL": "Lens", "L1-RCS": "Strasbourg", "L1-REN": "Rennes", "LL-ALA": "Alaves", "PL-COV": "Coventry", "PL-IPS": "Ipswich", "PL-LEE": "Leeds", "SA-INT": "Inter", "SA-MIL": "AC Milan", "L1-PSG": "Paris Saint Germain", "L1-OM": "Marseille", "L1-OL": "Lyon", "BL-FCB": "Bayern",
  "BL-BVB": "Borussia Dortmund", "BL-BMG": "Borussia Monchengladbach", "BL-KOE": "FC Koln", "BL-SVW": "Werder Bremen", "LL-ATH": "Athletic Club",
  "LL-ATM": "Atletico Madrid", "LL-BAR": "Barcelona", "LL-RSO": "Real Sociedad", "L1-ASM": "Monaco", "L1-BRE": "Brest", "L1-NIC": "Nice",
  "PL-BHA": "Brighton", "PL-MCI": "Manchester City", "PL-MUN": "Manchester United", "PL-NEW": "Newcastle", "PL-NFO": "Nottingham Forest", "PL-TOT": "Tottenham" };
async function api(pathq) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch("https://v3.football.api-sports.io" + pathq, { headers: { "x-apisports-key": KEY } });
    if (r.status === 429) { console.log("  rate limited, waiting 30s"); await sleep(30000); continue; }
    const j = await r.json();
    if (j.errors && Object.keys(j.errors).length && !Array.isArray(j.errors)) { throw new Error(JSON.stringify(j.errors)); }
    return j;
  }
  throw new Error("rate limited");
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const doneFile = path.join(OUT, "_done_apifootball.json");
  const done = fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, "utf8")) : {};
  const r0 = await fetch(`${cfg.url}/rest/v1/v_club_profile?select=id,name,country&order=id`, { headers: { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey } });
  if (!r0.ok) throw new Error("Could not read clubs from the database: " + r0.status);
  const clubs = await r0.json();
  const report = [];
  for (const c of clubs) {
    if (done[c.id]) { console.log("skip ", c.id); continue; }
    try {
      const q = norm(SEARCH[c.id] || c.name);
      const j = await api("/teams?search=" + encodeURIComponent(q.length < 3 ? q + "  " : q));
      const want = words(c.name);
      // skip women's, youth and reserve teams ("Bayern Munich W", "Arsenal U21", "Roma II"); prefer exact name matches
      const BAD = /(\bw|\bu\d{2}|\bii|\biii|\bb|\bwomen|\breserves?|\bamateur)$/;
      const cand = (j.response || []).filter(x => !x.team.national && x.team.country === c.country && !BAD.test(norm(x.team.name)))
        .map(x => ({ x, s: words(x.team.name).filter(w => want.includes(w)).length * 2 - Math.abs(words(x.team.name).length - want.length)
                          + (norm(x.team.name) === norm(c.name) || norm(x.team.name) === norm(SEARCH[c.id] || "") ? 5 : 0) }))
        .sort((a, b) => b.s - a.s);
      if (!cand.length) { report.push(`${c.id}  ${c.name}  NOT FOUND`); console.log("MISS ", c.id, c.name); }
      else {
        const t = cand[0].x.team;
        const img = await fetch(t.logo);
        if (!img.ok) throw new Error("image " + img.status);
        fs.writeFileSync(path.join(OUT, c.id + ".png"), Buffer.from(await img.arrayBuffer()));
        done[c.id] = t.name; fs.writeFileSync(doneFile, JSON.stringify(done, null, 1));
        report.push(`${c.id}  ${c.name}  <-  ${t.name} (${t.country})` + (cand.length > 1 ? `   [${cand.length} candidates - check]` : ""));
        console.log("ok   ", c.id.padEnd(7), c.name, " <- ", t.name);
      }
    } catch (e) { report.push(`${c.id}  ${c.name}  ERROR ${e.message}`); console.log("ERR  ", c.id, e.message); if (/quota|limit|token|key/i.test(e.message)) break; }
    await sleep(7000);
  }
  fs.writeFileSync(path.join(OUT, "_report.txt"), report.join("\n") + "\n");
  console.log("\nDone. Check the logos/ folder and logos/_report.txt.");
})();
