// Smoke test: loads index.html + config.js + app.js in jsdom with a MOCKED database (fetch).
// Checks that the page boots, renders clubs from "the database", opens a squad and draws every tab.
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const calls = [];
const player = (id, pos, r, inj) => ({ id, name: "P" + id, pos, sub_position: "", nationality: "X", age: 25, contract_until: 2027, market_value_m: 10, est_rating: r, est_potential: r + 2, est_wage_k: 20, injured: !!inj, tm_id: id, tm_slug: "p" + id, style_fit: 70, flag_expiring: true, flag_aging: false, flag_prospect: false, flag_mismatch: false });
const club = { id: "PL-ARS", name: "Arsenal", code: "ARS", lg: "PL", league_name: "Premier League", style: "Possession", is_real: true, squad_size: 2, strength: 80, budget_m: 100 };
const positions = ["GK","CB","FB","DM","CM","AM","W","ST"].map((c, i) => ({ code: c, name: c, target_depth: 2, sort_order: i }));
const cand = { tm_id: 9, name: "Cand", age: 20, market_value_m: 5, est_rating: 80, est_potential: 88, est_wage_k: 10, club: "Foo", lg: "PL", style_fit: 75, rating_gain: 5, tm_slug: "c" };
function reply(url, method, body) {
  const u = url.split("/rest/v1/")[1];
  if (u.startsWith("leagues")) return [{ code: "PL", name: "Premier League", country: "England" }];
  if (u.startsWith("positions")) return positions;
  if (u.startsWith("playstyles")) return [{ name: "Possession", description: "d" }];
  if (u.startsWith("v_club_profile")) return [club];
  if (u.startsWith("rosters?select")) return [];
  if (u.startsWith("rpc/fn_create_workspace")) return "11111111-1111-4111-8111-111111111111";
  if (u.startsWith("rpc/fn_workspace_overview")) return {
    workspace: { id: "1", name: "Arsenal", style: "Possession", window_state: "open", budget_m: 60 }, club,
    kpis: { squad_size: 2, squad_value_m: 20, avg_age: 25, contracts_expiring: 2, injuries: 1, style_mismatches: 0, thin_positions: 7, weakest_pos: "CB" },
    depth: positions.map(p => ({ pos: p.code, pos_name: p.name, target_depth: 2, n_total: p.code === "GK" ? 2 : 0, n_available: p.code === "GK" ? 1 : 0, n_injured: 0, thin_depth: p.code !== "GK", best_rating: 70, group_value_m: 10, players: p.code === "GK" ? [player(1, "GK", 70), player(2, "GK", 60, true)] : [] })),
    roster: [player(1, "GK", 70), player(2, "GK", 60, true)] };
  if (u.startsWith("rpc/fn_recommend_upgrade")) return { position: "CB", total: 1, starter: null, message: "", candidates: [cand] };
  if (u.startsWith("rpc/fn_recommend_future")) return { position: "CB", total: 0, starter: null, message: "No candidates match these limits", candidates: [] };
  if (u.startsWith("rpc/fn_emergency")) return { position: "GK", total: 1, injured: [{ pos: "GK", name: "P2", est_rating: 60 }], reference_player: "P2", message: "", candidates: [{ id: 5, tm_id: 0, name: "Free", sub_position: "GK", age: 30, nationality: "Y", est_rating: 65, est_wage_k: 8, market_value_m: 1, style_fit: 60, rating_gap: 5, status: "verified", last_club: "Z", free_since: "2026-07-01", tm_slug: "" }] };
  if (u.startsWith("rpc/fn_offload")) return [{ name: "Off", pos: "CM", age: 29, est_rating: 70, est_potential: 70, market_value_m: 5, style_fit: 40, tm_id: 3, tm_slug: "o", flag_expiring: true, flag_aging: false, flag_prospect: false, buyers: [{ club: "Bar", lg: "PL", style: "Counter-Attack", style_fit: 80, needs_position: true }] }];
  return null;
}
(async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/", pretendToBeVisual: true });
  const w = dom.window;
  w.fetch = async (url, o) => { calls.push(url.split("/rest/v1/")[1]); const d = reply(url, o.method, o.body); return { ok: true, status: 200, text: async () => JSON.stringify(d) }; };
  w.scrollTo = () => {};
  w.eval(fs.readFileSync(path.join(root, "config.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(root, "app.js"), "utf8"));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const d = w.document, ok = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  :", m); };
  await wait(100);
  ok(d.querySelectorAll(".club-btn").length === 1, "club grid rendered from database");
  d.querySelector(".club-btn").click(); await wait(100);
  ok(!d.querySelector("#app").classList.contains("hidden"), "workspace opened");
  ok(d.querySelectorAll(".group").length === 8, "8 position groups");
  ok(d.querySelectorAll(".group.thin").length === 7 && d.body.textContent.includes("Thin depth"), "thin depth flagged");
  d.querySelector('[data-tab="recruit"]').click(); await wait(100);
  ok(d.querySelectorAll("#upgradeList .card").length === 1, "upgrade list rendered");
  d.querySelector("#youngFee").value = "10"; d.querySelector("#youngAge").value = "21";
  d.querySelector("#youngFee").dispatchEvent(new w.Event("input")); await wait(500);
  ok(d.querySelector("#youngList").textContent.includes("No candidates match these limits"), "future-proof empty message from DB");
  d.querySelector('[data-tab="emergency"]').click(); await wait(100);
  ok(d.querySelectorAll("#faList .card").length === 1, "free agents rendered");
  d.querySelector('[data-tab="offload"]').click(); await wait(100);
  ok(d.querySelectorAll("#offloadList .card").length === 1, "offload rendered with buyers");
  ok(calls.every(c => !/data\.js/.test(c)), "no data.js use");
})();
