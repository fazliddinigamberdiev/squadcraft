// Collects summer-2026 DEPARTURES for every club from API-Football (/transfers?team=<id>), one request per club.
//   export APIFOOTBALL_KEY=...        (key stays in the environment, never in a file)
//   node tools/fetch_squads.js        (first: squads.json gives the team id of each of our clubs)
//   node tools/fetch_transfers.js     -> writes transfers_out.json  (resumable: run again after the daily quota resets)
// A "departure" is a transfer dated on/after SINCE where the player left this team. Nothing is changed in the database.
const fs = require("fs");
const KEY = process.env.APIFOOTBALL_KEY;
if (!KEY) { console.error("Set APIFOOTBALL_KEY first."); process.exit(1); }
const SINCE = "2026-05-01";
const squads = JSON.parse(fs.readFileSync("squads.json", "utf8"));
const out = fs.existsSync("transfers_out.json") ? JSON.parse(fs.readFileSync("transfers_out.json", "utf8")) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let done = 0;
  for (const [clubId, s] of Object.entries(squads)) {
    if (out[clubId]) continue;
    const r = await fetch(`https://v3.football.api-sports.io/transfers?team=${s.team_id}`, { headers: { "x-apisports-key": KEY } });
    const j = await r.json();
    if (j.errors && Object.keys(j.errors).length) {
      console.log("API said:", JSON.stringify(j.errors), "- stopping. Run again later; finished clubs are kept.");
      break;
    }
    const deps = [];
    for (const row of j.response || []) {
      for (const t of row.transfers || []) {
        if (t.date >= SINCE && t.teams && t.teams.out && t.teams.out.id === s.team_id)
          deps.push({ api_id: row.player.id, name: row.player.name, date: t.date, type: t.type, to: t.teams.in && t.teams.in.name, to_id: t.teams.in && t.teams.in.id });
      }
    }
    out[clubId] = { team_id: s.team_id, team: s.team_name, departures: deps };
    fs.writeFileSync("transfers_out.json", JSON.stringify(out, null, 1));
    console.log(`${clubId} ${s.team_name}: ${deps.length} departures`);
    done++;
    await sleep(6500); // free plan: 10 requests per minute
  }
  console.log(`${Object.keys(out).length}/${Object.keys(squads).length} clubs collected (${done} this run).`);
})();
