// Downloads official club crests (via Wikidata/Wikimedia Commons) into ./logos/<club id>.png  (run on your own computer, Node 18+)
//   node tools/fetch_logos.js
// For each club it asks Wikipedia for the main image of the club's article (normally the crest).
// Existing files are skipped, so you can re-run it. Problems are listed at the end and in logos/_report.txt.
// Crests are trademarks of their clubs: for a non-commercial class project only. Check the folder once by eye.
const fs = require("fs"), path = require("path");
const cfg = new Function("window", fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8") + ";return window.SC_CONFIG;")({});
const OUT = path.join(__dirname, "..", "logos");
const UA = "SquadCraftStudentProject/1.0 (university course project)";
// search words that find the right article when the plain club name is ambiguous
const FIX = {
  "SA-INT": "Inter Milan", "BL-SGE": "Eintracht Frankfurt", "L1-LIL": "Lille OSC", "L1-NIC": "OGC Nice", "L1-RCL": "RC Lens", "L1-ASM": "AS Monaco FC",
  "L1-PFC": "Paris FC", "L1-ANG": "Angers SCO", "L1-AUX": "AJ Auxerre", "L1-TFC": "Toulouse FC", "L1-LOR": "FC Lorient",
  "L1-ETA": "ESTAC Troyes", "L1-LEM": "Le Mans FC", "L1-HAC": "Le Havre AC", "L1-BRE": "Stade Brestois 29",
  "BL-FCU": "1. FC Union Berlin", "BL-SVE": "SV 07 Elversberg", "BL-SCP": "SC Paderborn 07", "BL-S04": "FC Schalke 04",
  "BL-M05": "1. FSV Mainz 05", "BL-FCA": "FC Augsburg", "BL-KOE": "1. FC Köln", "LL-ELC": "Elche CF", "LL-ESP": "RCD Espanyol",
  "LL-GET": "Getafe CF", "LL-LEV": "Levante UD", "LL-OSA": "CA Osasuna", "LL-MAL": "Málaga CF", "LL-RAC": "Racing de Santander",
  "LL-DEP": "Deportivo de La Coruña", "SA-CAG": "Cagliari Calcio", "SA-LEC": "US Lecce", "SA-PAR": "Parma Calcio 1913",
  "SA-MON": "AC Monza", "SA-VEN": "Venezia FC", "SA-FRO": "Frosinone Calcio", "SA-COM": "Como 1907", "SA-MIL": "AC Milan",
  "PL-HUL": "Hull City A.F.C.", "PL-COV": "Coventry City F.C.", "PL-IPS": "Ipswich Town F.C.", "PL-SUN": "Sunderland A.F.C.",
  "PL-LEE": "Leeds United F.C.", "PL-BRE": "Brentford F.C.", "PL-EVE": "Everton F.C.", "PL-NEW": "Newcastle United F.C."
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
// fetch with retry: Wikipedia answers 429 when asked too fast, so wait and try again
async function get(url) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.status !== 429) return r;
    const wait = (Number(r.headers.get("retry-after")) || 5 * (i + 1)) * 1000;
    console.log("  rate limited, waiting", wait / 1000, "s ...");
    await sleep(wait);
  }
  throw new Error("still rate limited (429) - wait a few minutes and run again");
}
async function json(url) { const r = await get(url); if (!r.ok) throw new Error(r.status); return r.json(); }
// Wikipedia search -> Wikidata item -> must be a football club (P31 = Q476028) with a logo image (P154) -> Commons file
async function find(club) {
  const term = FIX[club.id] || `${club.name} football club ${club.country}`;
  const s = await json("https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=5&prop=pageprops&ppprop=wikibase_item&gsrsearch=" + encodeURIComponent(term));
  const pages = Object.values(s.query?.pages || {}).sort((a, b) => a.index - b.index).filter(p => p.pageprops?.wikibase_item);
  if (!pages.length) return null;
  const ids = pages.map(p => p.pageprops.wikibase_item).join("|");
  const w = await json("https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=" + ids);
  for (const p of pages) {
    const claims = w.entities?.[p.pageprops.wikibase_item]?.claims || {};
    const isClub = (claims.P31 || []).some(c => c.mainsnak?.datavalue?.value?.id === "Q476028");
    const logo = claims.P154?.[0]?.mainsnak?.datavalue?.value;
    if (isClub && logo) return { title: p.title, url: "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(logo) + "?width=256" };
  }
  return null;
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const r0 = await fetch(`${cfg.url}/rest/v1/v_club_profile?select=id,name,country&order=id`, { headers: { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey } });
  if (!r0.ok) throw new Error("Could not read clubs from the database: " + r0.status);
  const clubs = await r0.json();
  const doneFile = path.join(OUT, "_done.json");
  const done = fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, "utf8")) : {};
  const report = [];
  for (const c of clubs) {
    const file = path.join(OUT, c.id + ".png");
    if (done[c.id]) { console.log("skip ", c.id); continue; }
    try {
      const hit = await find(c);
      if (!hit) { report.push(`${c.id}  ${c.name}  NO IMAGE FOUND`); console.log("MISS ", c.id, c.name); continue; }
      const img = await get(hit.url);
      if (!img.ok) throw new Error("download " + img.status);
      fs.writeFileSync(file, Buffer.from(await img.arrayBuffer()));
      done[c.id] = hit.title; fs.writeFileSync(doneFile, JSON.stringify(done, null, 1));
      report.push(`${c.id}  ${c.name}  <-  "${hit.title}"`);
      console.log("ok   ", c.id.padEnd(7), c.name, " <- ", hit.title);
    } catch (e) { report.push(`${c.id}  ${c.name}  ERROR ${e.message}`); console.log("ERR  ", c.id, e.message); }
    await sleep(1500);
  }
  fs.writeFileSync(path.join(OUT, "_report.txt"), report.join("\n") + "\n");
  console.log("\nDone. Open the logos/ folder and check the images; see logos/_report.txt for which Wikipedia page each came from.");
})();
