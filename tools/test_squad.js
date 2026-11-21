// Squad test: 2 API requests. Looks up one club by name, then prints its current squad as the API returns it.
//   export APIFOOTBALL_KEY=your_new_key        (never paste the key into chat or the repo)
//   node test_squad.js "Real Madrid"
const KEY = process.env.APIFOOTBALL_KEY;
if (!KEY) { console.error("Set your key first:  export APIFOOTBALL_KEY=your_key_here"); process.exit(1); }
const name = process.argv[2] || "Real Madrid";
const get = async p => (await fetch("https://v3.football.api-sports.io" + p, { headers: { "x-apisports-key": KEY } })).json();
(async () => {
  const t = await get("/teams?search=" + encodeURIComponent(name));
  console.log("errors:", JSON.stringify(t.errors));
  const team = (t.response || []).map(x => x.team).find(x => !x.national);
  if (!team) { console.log("no team found"); return; }
  console.log("team:", team.id, team.name, team.country);
  const s = await get("/players/squads?team=" + team.id);
  console.log("errors:", JSON.stringify(s.errors));
  const players = (s.response && s.response[0] && s.response[0].players) || [];
  console.log("players returned:", players.length);
  console.log("fields in first player:", players[0] ? Object.keys(players[0]).join(", ") : "-");
  console.log(JSON.stringify(players.slice(0, 5), null, 1));
  require("fs").writeFileSync("squad_test.json", JSON.stringify(s, null, 1));
  console.log("full response saved to squad_test.json");
})();
