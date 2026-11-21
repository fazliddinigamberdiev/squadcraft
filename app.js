/* SquadCraft TransferMind - front end.
   This file only draws screens and sends requests. ALL data and ALL rules (depth, thin depth,
   upgrades, future-proof, free agents, offload) live in the Supabase database as tables and
   SQL functions (see db/schema.sql). Nothing about players is hard-coded here. */
(function () {
"use strict";

const CFG = window.SC_CONFIG;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- anonymous access key (kept in this browser; sent with every request) ---------- */
function newToken() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
}
let TOKEN = null;
try { TOKEN = localStorage.getItem("sc-owner-token"); } catch (e) { /* storage blocked */ }
if (!TOKEN || !UUID_RE.test(TOKEN)) {
  TOKEN = newToken();
  try { localStorage.setItem("sc-owner-token", TOKEN); } catch (e) { /* keep in memory */ }
}

/* ---------- database access ---------- */
const FRIENDLY = [
  [/roster_players_age_check/, "Age must be between 15 and 50."],
  [/roster_players_potential_ok/, "Potential cannot be lower than the rating."],
  [/est_rating_check|est_potential_check/, "Rating and potential must be between 1 and 99."],
  [/market_value_m_check/, "Market value must be between 0 and 500 (€M)."],
  [/est_wage_k_check/, "Wage must be between 0 and 2000 (€k per week)."],
  [/contract_until_check/, "Contract year must be between 2020 and 2040."],
  [/(press|passing|pace|physical)_check/, "Press, passing, pace and physical must be between 0 and 100."],
  [/row-level security/i, "Not allowed: this squad belongs to a different access key."],
  [/violates check constraint/, "One of the values is out of range."]
];
function friendly(msg) {
  for (const [re, text] of FRIENDLY) if (re.test(msg)) return text;
  return msg;
}
async function api(path, opts) {
  const o = opts || {};
  const headers = {
    apikey: CFG.anonKey,
    Authorization: "Bearer " + CFG.anonKey,
    "x-owner-token": TOKEN,
    "Content-Type": "application/json"
  };
  if (o.prefer) headers.Prefer = o.prefer;
  let res;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    res = await fetch(CFG.url + "/rest/v1/" + path, { method: o.method || "GET", headers, signal: ctl.signal, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  } catch (e) {
    throw new Error(e && e.name === "AbortError"
      ? "The database took too long to answer. Try again in a moment."
      : "Cannot reach the database. Check your internet connection (or restore the Supabase project if it is paused).");
  } finally { clearTimeout(timer); }
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
  if (!res.ok) {
    const msg = (data && (data.message || data.hint || data.error)) || ("Database error " + res.status);
    throw new Error(friendly(String(msg)));
  }
  return data;
}
const rpc = (fn, args) => api("rpc/" + fn, { method: "POST", body: args || {} });

/* ---------- small helpers ---------- */
const CREST_COL = ["#3ddc84", "#5cc8ff", "#ffb547", "#ff6b4a", "#a46cff", "#c6f432", "#ff4d6d", "#4be1d4", "#f5f5f5"];
const crestCol = c => CREST_COL[((c.name || "").length + (c.code || "X").charCodeAt(0)) % CREST_COL.length];
// club badge: the logo image when the database has logo_url and the file exists, otherwise a colored code badge
const logoOf = c => c.logo_url || ((S.clubs.find(x => x.id === c.id) || {}).logo_url) || null;
const crest = c => {
  const l = c.id ? logoOf(c) : null;
  return `<span class="crest${l ? " has-logo" : ""}" style="background:${crestCol(c)}">${l ? `<img src="${esc(l)}" alt="" loading="lazy">` : ""}${esc(c.code)}</span>`;
};
// if a logo file is missing, drop the image and show the code badge again
document.addEventListener("error", e => {
  const t = e.target;
  if (t && t.tagName === "IMG" && t.parentElement) {
    const pc = t.parentElement.classList;
    if (pc.contains("has-logo")) { pc.remove("has-logo"); t.remove(); }
    else if (pc.contains("has-photo")) { pc.remove("has-photo"); t.remove(); }
  }
}, true);
const money = v => { v = Number(v); return v >= 1000 ? "€" + (v / 1000).toFixed(2) + "B" : v >= 1 ? "€" + v.toFixed(1) + "M" : "€" + Math.round(v * 1000) + "K"; };
const ovrColor = r => r >= 82 ? "var(--accent2)" : r >= 75 ? "var(--accent)" : r >= 68 ? "var(--warn)" : "var(--muted)";
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
const lgName = code => (S.leagues[code] && S.leagues[code].name) || code;
const lgTag = code => `<span class="lg lg-${esc(code)}">${esc(lgName(code))}</span>`;
const tmUrl = p => (p.tm_id && p.tm_slug) ? `https://www.transfermarkt.com/${encodeURIComponent(p.tm_slug)}/profil/spieler/${encodeURIComponent(p.tm_id)}` : null;
// every player name is a link that opens the in-app player panel; the player object is kept here so the click can find it
const PL = new Map();
let plSeq = 0;
const tmLink = p => {
  if (PL.size > 4000) PL.clear();
  const k = String(++plSeq); PL.set(k, p);
  return `<a class="pl" href="${tmUrl(p) || "#"}" data-pk="${k}" title="Show player details">${esc(p.name)}</a>`;
};
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("a.pl[data-pk]");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  e.preventDefault();
  const p = PL.get(a.dataset.pk);
  if (p) openPlayer(p);
});
function initials(n) { return String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase(); }
function openPlayer(p) {
  const box = $("#pp"); if (!box) return;
  const url = tmUrl(p);
  const row = (l, v) => v == null || v === "" ? "" : `<div class="r"><span>${l}</span><b>${v}</b></div>`;
  const club = p.club_name || p.club || "";
  // photo files are named after the Transfermarkt id (players/<tm_id>.png); if a file is missing the initials circle shows instead
  const photo = p.photo_url || (p.tm_id ? "players/" + encodeURIComponent(p.tm_id) + ".png" : null);
  $("#ppBody").innerHTML = `
    <div class="pp-head">
      <span class="pp-photo${photo ? " has-photo" : ""}">${photo ? `<img src="${esc(photo)}" alt="">` : ""}<i>${esc(initials(p.name))}</i></span>
      <div><h3 id="ppTitle">${esc(p.name)}</h3>
        <div class="meta">${esc(p.sub_position || p.pos || "")}${p.nationality ? " · " + esc(p.nationality) : ""}${club ? " · " + esc(club) : ""}</div>
        <div style="margin-top:6px">${typeof flagsHtml === "function" ? flagsHtml(p) : ""}</div></div>
    </div>
    <div class="pp-grid">
      ${row("Position", esc(p.pos))}${row("Age", p.age)}
      ${row("Market value", p.market_value_m != null ? money(p.market_value_m) : null)}
      ${row("Est. wage / week", p.est_wage_k != null ? "€" + Number(p.est_wage_k) + "k" : null)}
      ${row("Est. rating", p.est_rating != null ? `<span style="color:${ovrColor(p.est_rating)}">${p.est_rating}</span>` : null)}
      ${row("Est. potential", p.est_potential)}
      ${row("Style fit", p.style_fit != null ? fitBar(p.style_fit) : null)}
      ${row("Contract until", p.contract_until == null ? "–" : esc(p.contract_until))}
    </div>
    <div class="pp-foot">${url ? `<a class="btn" href="${url}" target="_blank" rel="noopener noreferrer">View on Transfermarkt ↗</a>` : `<span class="meta">No Transfermarkt page for this player.</span>`}
      <button class="btn" id="ppClose" type="button">Close</button></div>`;
  box.hidden = false;
  $("#ppClose").onclick = closePlayer;
  $("#ppClose").focus();
}
function closePlayer() { const b = $("#pp"); if (b) b.hidden = true; }
document.addEventListener("keydown", e => { if (e.key === "Escape") closePlayer(); });
document.addEventListener("click", e => { if (e.target && e.target.id === "pp") closePlayer(); });
const monthYear = d => { try { return new Date(d + "T00:00:00Z").toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" }); } catch (e) { return d; } };
const fitBar = v => {
  const col = v >= 70 ? "var(--accent)" : v >= 58 ? "var(--warn)" : "var(--bad)";
  return `<span class="fit"><i><b style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></b></i>${v}</span>`;
};
let toastTimer = null;
function toast(msg, ok) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (ok ? " ok" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), ok ? 3000 : 6000);
}
// run fn once at a time per button: ignores double clicks while a request is pending
async function guarded(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try { await fn(); } finally { btn.disabled = false; }
}
const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
const setSelect = (el, items, value) => {
  el.innerHTML = items.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? " selected" : ""}>${esc(l)}</option>`).join("");
};

/* ---------- state ---------- */
const S = {
  positions: [], leagues: {}, styles: {}, clubs: [], myWs: [],
  ws: null, ov: null, tab: "audit",
  sortKey: "pos", sortDir: 1, rPos: null, ePos: null, rLeague: "ALL", editing: null
};
const posName = code => { const p = S.positions.find(x => x.code === code); return p ? p.name : code; };
const posOrder = code => { const p = S.positions.find(x => x.code === code); return p ? p.sort_order : 99; };
const wsRow = () => (S.ov && S.ov.workspace) || null;

/* =================== WELCOME SCREEN =================== */
let sugg = [], sel = -1, chosen = null, searchSeq = 0, chipLg = "ALL";

function renderSuggest() {
  const box = $("#suggest");
  if (!sugg.length) { box.classList.add("hidden"); return; }
  box.innerHTML = sugg.map((c, i) => `<button type="button" role="option" aria-selected="${i === sel}" data-i="${i}">${crest(c)}<span>${esc(c.name)}${c.is_real ? "" : ` <span class="meta">· promoted, simulated squad</span>`}</span>${lgTag(c.lg)}</button>`).join("");
  box.classList.remove("hidden");
  box.querySelectorAll("button").forEach(b => b.onmousedown = e => { e.preventDefault(); choose(sugg[+b.dataset.i]); });
}
function choose(c) {
  chosen = c; $("#clubInput").value = c.name; sugg = []; renderSuggest();
  $("#goBtn").disabled = false; $("#err").textContent = "";
}
async function runSearch(q) {
  const my = ++searchSeq;
  if (!q.trim()) { sugg = []; renderSuggest(); return; }
  try {
    const r = await rpc("fn_search_clubs", { p_q: q, p_limit: 7 });
    if (my !== searchSeq) return;
    sugg = r;
    const exact = r.find(c => c.score >= 100);
    if (exact) chosen = exact;
    renderSuggest();
  } catch (e) { if (my === searchSeq) $("#err").textContent = e.message; }
}
const runSearchSoon = debounce(runSearch, 160);

function renderChips() {
  const opts = [["ALL", "All leagues"], ...Object.entries(S.leagues).map(([k, v]) => [k, v.name])];
  $("#leagueChips").innerHTML = opts.map(([k, l]) => `<button class="chip" aria-pressed="${chipLg === k}" data-lg="${esc(k)}">${esc(l)}</button>`).join("");
  $("#leagueChips").querySelectorAll(".chip").forEach(b => b.onclick = () => { chipLg = b.dataset.lg; renderChips(); renderGrid(); });
}
function renderGrid() {
  const list = S.clubs.filter(c => chipLg === "ALL" || c.lg === chipLg).sort((a, b) => a.name.localeCompare(b.name));
  $("#clubGrid").innerHTML = list.map(c => `<button class="club-btn" data-id="${esc(c.id)}" title="${esc(c.name)} · ${esc(c.league_name)}${c.is_real ? "" : " · simulated squad"}">${crest(c)}<span>${esc(c.name)}${c.is_real ? "" : "<sup class='meta'> sim</sup>"}</span></button>`).join("");
  $("#clubGrid").querySelectorAll(".club-btn").forEach(b => b.onclick = () => openClub(S.clubs.find(c => c.id === b.dataset.id)));
}

async function loadMyWorkspaces() {
  try {
    S.myWs = await api("rosters?select=id,name,base_club_id,style,created_at,roster_players(count)&order=created_at.desc");
  } catch (e) { S.myWs = []; toast(e.message); }
  const panel = $("#wsPanel");
  panel.classList.toggle("hidden", !S.myWs.length);
  $("#wsList").innerHTML = S.myWs.map(w => {
    const c = S.clubs.find(x => x.id === w.base_club_id);
    const n = w.roster_players && w.roster_players[0] ? w.roster_players[0].count : 0;
    return `<div class="ws-item" data-id="${esc(w.id)}">${c ? crest(c) : `<span class="crest" style="background:#8fa39a">SQ</span>`}
      <div class="grow"><b>${esc(w.name)}</b><span class="meta">${c ? esc(c.name) + " · " : "Custom squad · "}${plural(n, "player")} · ${esc(w.style)}</span></div>
      <button class="btn primary" data-open="${esc(w.id)}">Open</button>
      <button class="btn danger" data-delws="${esc(w.id)}" title="Delete this squad">Delete</button></div>`;
  }).join("");
}

async function openClub(c, fresh) {
  if (!c) return;
  try {
    const existing = !fresh && S.myWs.find(w => w.base_club_id === c.id);
    if (existing) { await loadWorkspace(existing.id); toast("Opened your saved squad for " + c.name + ".", true); return; }
    const id = await rpc("fn_create_workspace", { p_club_id: c.id });
    await loadWorkspace(id);
  } catch (e) { $("#err").textContent = e.message; toast(e.message); }
}

/* =================== WORKSPACE =================== */
async function loadWorkspace(id) {
  const ov = await rpc("fn_workspace_overview", { p_roster: id });
  S.ws = id; S.ov = ov; S.rPos = null; S.ePos = null; S.editing = null;
  const w = ov.workspace, club = ov.club;
  $("#clubId").innerHTML = (club ? crest(club) : `<span class="crest" style="background:#8fa39a">SQ</span>`) +
    `<div><b>${esc(w.name)}</b>${club ? lgTag(club.lg) : `<span class="meta">Custom squad</span>`}</div>`;
  $("#resetWs").classList.toggle("hidden", !club);
  setSelect($("#style"), Object.keys(S.styles).map(s => [s, s]), w.style);
  $("#window").value = w.window_state;
  $("#budget").value = Math.min(250, Math.max(5, Number(w.budget_m)));
  $("#budgetVal").textContent = "€" + $("#budget").value + "M";
  $("#welcome").classList.add("hidden"); $("#app").classList.remove("hidden");
  S.tab = "audit";
  switchTab("audit");
  if (!ov.roster.length) openForm(null);
}
async function refresh() {
  if (!S.ws) return;
  try {
    S.ov = await rpc("fn_workspace_overview", { p_roster: S.ws });
    renderAudit();
    loadTab(S.tab);
  } catch (e) { toast(e.message); }
}
async function patchWorkspace(body) {
  await api("rosters?id=eq." + encodeURIComponent(S.ws), { method: "PATCH", body, prefer: "return=minimal" });
}

/* =================== SQUAD AUDIT (S1) =================== */
function flagsHtml(p) {
  const f = [];
  if (p.injured) f.push(`<span class="tag t-bad">Injured</span>`);
  if (p.flag_expiring) f.push(`<span class="tag t-warn">Expiring</span>`);
  if (p.flag_aging) f.push(`<span class="tag t-info">Aging</span>`);
  if (p.flag_prospect) f.push(`<span class="tag t-ok">Prospect</span>`);
  if (p.flag_mismatch) f.push(`<span class="tag t-bad">Style mismatch</span>`);
  return f.join("");
}
function renderAudit() {
  const ov = S.ov, k = ov.kpis, club = ov.club;
  $("#srcPill").textContent = club ? (club.is_real ? "Live database · Transfermarkt values 6 Jul 2026" : "Live database · simulated squad") : "Live database · your own squad";
  $("#dataNote").innerHTML = !club
    ? `<div class="alert info"><p>🛠️ <b>Your own squad.</b> Add players with “＋ Add player” or sign them from the Recruitment and Emergency tabs. Everything you change is saved in the database.</p></div>`
    : club.is_real
      ? `<div class="alert info"><p>📊 <b>Real squad copy:</b> ${plural(k.squad_size, "player")} with Transfermarkt market values as of <b>6 July 2026</b>. This is your own editable copy: injuries and changes do not affect other users. Ratings, style attributes and wages are SquadCraft estimates. Click a name to open the Transfermarkt profile.</p></div>`
      : `<div class="alert"><p>⚠️ <b>${esc(club.name)} were promoted from the second tier.</b> The dataset only covers top-flight squads, so this squad is <b>simulated</b> (made-up players generated inside the database). Recruitment targets and buyers still come from real top-flight players.</p></div>`;

  const thin = ov.depth.filter(d => d.thin_depth);
  $("#thinAlert").innerHTML = thin.length
    ? `<div class="alert"><p>⚠️ <b>Thin depth</b> (fewer than 2 players): ${thin.map(d => `<b>${esc(d.pos)}</b> ${esc(posName(d.pos))} (${d.n_total})`).join(" · ")}</p></div>`
    : `<div class="alert info"><p>✅ No thin positions: every position group has at least 2 players.</p></div>`;

  $("#kpis").innerHTML = [
    ["Players", k.squad_size], ["Squad value", money(k.squad_value_m)], ["Average age", k.avg_age == null ? "–" : Number(k.avg_age).toFixed(1)],
    ["Contracts expiring ≤ 2027", k.contracts_expiring], ["Long-term injuries", k.injuries], ["Style mismatches", k.style_mismatches]
  ].map(([l, v]) => `<div class="panel kpi"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join("");

  $("#injBadge").textContent = k.injuries; $("#injBadge").classList.toggle("hidden", !k.injuries);

  $("#groups").innerHTML = ov.depth.map(d => {
    const t = d.target_depth, n = d.n_available;
    const col = n >= t ? "var(--accent)" : n === t - 1 ? "var(--warn)" : "var(--bad)";
    const list = d.players.length
      ? `<ul class="plist">${d.players.map(p => `<li class="${p.injured ? "inj" : ""}"><span class="n">${tmLink(p)}</span><span class="v">${money(p.market_value_m)}</span><span class="c" title="Contract end year">${p.contract_until == null ? "–" : esc(p.contract_until)}</span></li>`).join("")}</ul>`
      : `<div class="plist-empty">No players in this position.</div>`;
    return `<div class="group ${d.thin_depth ? "thin" : ""}" data-pos="${esc(d.pos)}">
      <div class="group-head"><b>${esc(d.pos)}</b><span class="meta">${esc(d.pos_name)}</span>${d.thin_depth ? `<span class="tag t-thin">Thin depth</span>` : ""}<span class="count" title="players in this group">${plural(d.n_total, "player")}</span></div>
      <div class="bar"><i style="width:${Math.min(100, n / t * 100)}%;background:${col}"></i></div>
      <div class="meta" style="margin-bottom:6px">${n}/${t} available · best ${d.best_rating == null ? "–" : d.best_rating} · ${money(d.group_value_m)}</div>
      ${list}
      <div class="row" style="margin-top:8px"><button class="btn" data-scout="${esc(d.pos)}">Scout ${esc(d.pos)}</button></div></div>`;
  }).join("");

  renderRoster();
}

const COLS = [["name", "Player"], ["pos", "Pos"], ["age", "Age", "num"], ["market_value_m", "Market value", "num"], ["est_rating", "Est. OVR", "num"], ["est_potential", "Est. POT", "num"], ["style_fit", "Style fit", "num"], ["est_wage_k", "Est. wage/wk", "num"], ["contract_until", "Contract", "num"], ["flags", "Flags"], ["act", ""]];
function renderRoster() {
  const rows = S.ov.roster.slice();
  const key = S.sortKey, dir = S.sortDir;
  rows.sort((a, b) => {
    if (key === "pos") return (posOrder(a.pos) - posOrder(b.pos)) * dir || b.est_rating - a.est_rating;
    const av = a[key] == null ? 9999 : a[key], bv = b[key] == null ? 9999 : b[key];
    return (typeof av === "string" ? av.localeCompare(bv) : av - bv) * dir;
  });
  $("#roster").innerHTML = `<thead><tr>${COLS.map(([k, l, c]) => `<th class="${c || ""}" data-k="${k}">${l}${S.sortKey === k ? (S.sortDir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
  <tbody>${rows.length ? rows.map(p => `<tr class="${p.injured ? "injured" : ""}" data-id="${p.id}">
    <td><b>${tmLink(p)}</b>${p.sub_position ? `<div class="meta">${esc(p.sub_position)}${p.nationality ? " · " + esc(p.nationality) : ""}</div>` : ""}</td><td>${esc(p.pos)}</td><td class="num">${p.age}</td>
    <td class="num" style="font-weight:600">${money(p.market_value_m)}</td>
    <td class="num" style="color:${ovrColor(p.est_rating)};font-weight:600">${p.est_rating}</td><td class="num">${p.est_potential}</td>
    <td class="num">${fitBar(p.style_fit)}</td>
    <td class="num">€${Number(p.est_wage_k)}k</td><td class="num">${p.contract_until == null ? "–" : p.contract_until}</td><td>${flagsHtml(p)}</td>
    <td style="white-space:nowrap"><button class="btn ${p.injured ? "" : "danger"}" data-inj="${p.id}">${p.injured ? "Mark fit" : "Injure"}</button>
      <button class="btn" data-edit="${p.id}">Edit</button> <button class="btn danger" data-del="${p.id}" title="Remove from squad">✕</button></td></tr>`).join("")
    : `<tr><td colspan="${COLS.length}"><div class="empty" style="border:0">This squad has no players yet. Press “＋ Add player”.</div></td></tr>`}</tbody>`;
}

/* ----- add / edit player form ----- */
function openForm(p) {
  S.editing = p ? p.id : null;
  const v = p || { name: "", pos: S.positions.length ? S.positions[0].code : "GK", age: 25, contract_until: "", market_value_m: 1, est_rating: 65, est_potential: 65, est_wage_k: 5, sub_position: "", nationality: "", press: 50, passing: 50, pace: 50, physical: 50 };
  const num = (id, label, val, min, max, step) => `<div class="field"><label for="f_${id}">${label}</label><input type="number" id="f_${id}" min="${min}" max="${max}" step="${step || 1}" value="${val == null ? "" : esc(val)}"></div>`;
  $("#playerForm").innerHTML = `<h3 style="font-size:15px;margin-bottom:10px">${p ? "Edit player" : "Add a player"}</h3>
    <form id="pf" autocomplete="off"><div class="form-grid">
      <div class="field wide"><label for="f_name">Name</label><input id="f_name" type="text" maxlength="80" required value="${esc(v.name)}"></div>
      <div class="field"><label for="f_pos">Position</label><select id="f_pos">${S.positions.map(x => `<option value="${esc(x.code)}"${x.code === v.pos ? " selected" : ""}>${esc(x.code)} — ${esc(x.name)}</option>`).join("")}</select></div>
      ${num("age", "Age", v.age, 15, 50)}
      ${num("contract_until", "Contract end (year)", v.contract_until, 2020, 2040)}
      ${num("market_value_m", "Market value (€M)", v.market_value_m, 0, 500, 0.1)}
      ${num("est_rating", "Rating (1-99)", v.est_rating, 1, 99)}
      ${num("est_potential", "Potential (1-99)", v.est_potential, 1, 99)}
      ${num("est_wage_k", "Wage (€k / week)", v.est_wage_k, 0, 2000, 0.5)}
    </div>
    <details><summary>More details (style attributes, nationality)</summary><div class="form-grid" style="margin-top:10px">
      <div class="field"><label for="f_sub_position">Sub-position</label><input id="f_sub_position" type="text" maxlength="40" value="${esc(v.sub_position)}"></div>
      <div class="field"><label for="f_nationality">Nationality</label><input id="f_nationality" type="text" maxlength="40" value="${esc(v.nationality)}"></div>
      ${num("press", "Press (0-100)", v.press, 0, 100)}${num("passing", "Passing (0-100)", v.passing, 0, 100)}${num("pace", "Pace (0-100)", v.pace, 0, 100)}${num("physical", "Physical (0-100)", v.physical, 0, 100)}
    </div></details>
    <div class="row" style="margin-top:12px"><button class="btn primary big" type="submit">${p ? "Save changes" : "Add to squad"}</button><button class="btn big" type="button" id="pfCancel">Cancel</button></div></form>`;
  $("#playerForm").classList.remove("hidden");
  $("#pfCancel").onclick = closeForm;
  $("#pf").onsubmit = submitForm;
  $("#f_name").focus();
}
function closeForm() { S.editing = null; $("#playerForm").classList.add("hidden"); $("#playerForm").innerHTML = ""; }
async function submitForm(e) {
  e.preventDefault();
  const n = id => { const x = $("#f_" + id).value; return x === "" ? null : Number(x); };
  const rating = n("est_rating");
  const body = {
    name: $("#f_name").value.trim(), pos: $("#f_pos").value, age: n("age"), contract_until: n("contract_until"),
    market_value_m: n("market_value_m"), est_rating: rating, est_potential: n("est_potential") == null ? rating : n("est_potential"),
    est_wage_k: n("est_wage_k"), sub_position: $("#f_sub_position").value.trim(), nationality: $("#f_nationality").value.trim(),
    press: n("press"), passing: n("passing"), pace: n("pace"), physical: n("physical")
  };
  if (!body.name) return toast("Enter a name.");
  for (const k of ["age", "market_value_m", "est_rating", "est_wage_k", "press", "passing", "pace", "physical"]) if (body[k] == null || Number.isNaN(body[k])) return toast("Fill in every number field (only the contract year can stay empty).");
  if (body.est_potential < body.est_rating) return toast("Potential cannot be lower than the rating.");
  for (const k of ["age", "est_rating", "est_potential", "press", "passing", "pace", "physical"]) if (!Number.isInteger(body[k])) return toast("Age, rating, potential and style attributes must be whole numbers.");
  if (body.contract_until != null && !Number.isInteger(body.contract_until)) return toast("Contract year must be a whole number.");
  const submitBtn = e.submitter || document.querySelector("#pf button[type=submit]");
  if (submitBtn && submitBtn.disabled) return;
  if (submitBtn) submitBtn.disabled = true;
  try {
    if (S.editing) await api("roster_players?id=eq." + encodeURIComponent(S.editing), { method: "PATCH", body, prefer: "return=minimal" });
    else await api("roster_players", { method: "POST", body: Object.assign({ roster_id: S.ws }, body), prefer: "return=minimal" });
    toast(S.editing ? "Player updated." : "Player added.", true);
    closeForm();
    await refresh();
  } catch (err) { toast(err.message); if (submitBtn) submitBtn.disabled = false; }
}

/* =================== RECRUITMENT (S2) =================== */
let recSeq = 0;
function card(p, sub, right, why, btn) {
  return `<div class="card"><div class="ovr" style="color:${ovrColor(p.est_rating)}">${p.est_rating}</div>
    <div><h3>${tmLink(p)}</h3><div class="meta">${sub}</div><div class="why">${why}</div></div>
    <div class="right">${right}${btn ? `<div style="margin-top:6px">${btn}</div>` : ""}</div></div>`;
}
async function loadRecruit() {
  const my = ++recSeq, ov = S.ov, w = ov.workspace;
  if (!S.rPos) S.rPos = ov.kpis.weakest_pos;
  const pos = S.rPos;
  setSelect($("#rPos"), S.positions.map(p => [p.code, p.code + " — " + p.name]), pos);
  setSelect($("#rLeague"), [["ALL", "All top 5 leagues"], ...Object.entries(S.leagues).map(([k, v]) => [k, v.name])], S.rLeague);
  const league = S.rLeague === "ALL" ? null : S.rLeague;
  const upFee = $("#upFee").value === "" ? null : Number($("#upFee").value);
  const feeRaw = $("#youngFee").value, ageRaw = $("#youngAge").value;
  $("#recruitNote").innerHTML = w.window_state === "closed"
    ? `<p>⛔ <b>Transfer window closed.</b> These lists are for planning the next window. For urgent cover use <b>Emergency Free Agents</b>.</p><button class="btn primary" id="toEmergency">Go to free agents</button>`
    : `<p>Targets for <b>${esc(posName(pos))}</b> from clubs with real squad data, ranked for a <b>${esc(w.style)}</b> manager (${esc((S.styles[w.style] || {}).description || "")}). Budget set: <b>€${Number(w.budget_m)}M</b>.</p>`;
  const futureOk = feeRaw !== "" && Number(feeRaw) >= 0 && ageRaw !== "" && Number(ageRaw) >= 15 && Number(ageRaw) <= 50;
  try {
    const [up, fut] = await Promise.all([
      rpc("fn_recommend_upgrade", { p_roster: S.ws, p_pos: pos, p_max_fee: upFee, p_league: league, p_limit: 10 }),
      futureOk ? rpc("fn_recommend_future", { p_roster: S.ws, p_pos: pos, p_max_fee: Number(feeRaw), p_max_age: Number(ageRaw), p_league: league, p_limit: 10 }) : Promise.resolve(null)
    ]);
    if (my !== recSeq) return;
    const st = up.starter;
    $("#starterBox").innerHTML = st
      ? `Current ${esc(posName(pos).toLowerCase())} starter: <b style="color:var(--text)">${esc(st.name)}</b> · OVR ${st.est_rating} · ${st.age} yrs`
      : `<span style="color:var(--bad)">No fit ${esc(posName(pos).toLowerCase())} in your squad — every candidate is listed.</span>`;
    const sR = st ? st.est_rating : null;
    const sub = p => `${esc(pos)} · ${p.age} yrs · ${money(p.market_value_m)} · ${esc(p.club)} ${lgTag(p.lg)}`;
    const price = p => `<div class="price">${money(p.market_value_m)}</div><div class="meta">€${Number(p.est_wage_k)}k/wk</div>`;
    const sign = p => `<button class="btn" data-sign-tm="${p.tm_id}" data-name="${esc(p.name)}">Add to squad</button>`;
    const vs = p => sR == null ? "" : `<span class="tag t-info">OVR ${p.est_rating} vs starter ${sR}</span>`;

    $("#upMeta").textContent = up.total ? `${up.total} match${up.total === 1 ? "" : "es"} · top ${up.candidates.length}` : "Rates above your starter";
    $("#upgradeList").innerHTML = up.candidates.length
      ? up.candidates.map(p => card(p, sub(p), price(p), `<span class="tag t-ok">+${p.rating_gain} OVR</span>${vs(p)}<span class="tag ${p.style_fit >= 70 ? "t-ok" : "t-warn"}">Fit ${p.style_fit}</span>`, sign(p))).join("")
      : `<div class="empty">${esc(up.message)}</div>`;

    if (!fut) {
      $("#youngMeta").textContent = "Enter a fee and an age";
      $("#youngList").innerHTML = `<div class="empty">Enter a maximum fee (0 or more) and a maximum age (15-50).</div>`;
    } else {
      $("#youngMeta").textContent = fut.total ? `${fut.total} match${fut.total === 1 ? "" : "es"} · top ${fut.candidates.length}` : `Age ≤ ${ageRaw} · fee ≤ €${feeRaw}M`;
      $("#youngList").innerHTML = fut.candidates.length
        ? fut.candidates.map(p => card(p, sub(p), price(p), `<span class="tag t-info">Ceiling ${p.est_potential}</span>${vs(p)}<span class="tag ${p.style_fit >= 70 ? "t-ok" : "t-warn"}">Fit ${p.style_fit}</span>`, sign(p))).join("")
        : `<div class="empty">${esc(fut.message)}</div>`;
    }
  } catch (e) { if (my === recSeq) { $("#upgradeList").innerHTML = $("#youngList").innerHTML = `<div class="empty">${esc(e.message)}</div>`; } }
}

/* =================== EMERGENCY FREE AGENTS =================== */
let emSeq = 0;
async function loadEmergency() {
  const my = ++emSeq, ov = S.ov, w = ov.workspace;
  try {
    // default position: the injured player's position, else the weakest one
    if (!S.ePos) {
      const inj = (await rpc("fn_emergency", { p_roster: S.ws, p_pos: ov.kpis.weakest_pos, p_limit: 1 })).injured;
      S.ePos = inj && inj.length ? inj[0].pos : ov.kpis.weakest_pos;
    }
    setSelect($("#ePos"), S.positions.map(p => [p.code, p.code + " — " + p.name]), S.ePos);
    const j = await rpc("fn_emergency", {
      p_roster: S.ws, p_pos: S.ePos, p_max_wage: Number($("#wage").value),
      p_allow_over_32: $("#unfit").checked, p_verified_only: $("#verified").checked, p_limit: 12
    });
    if (my !== emSeq) return;
    const inj = j.injured;
    $("#emergencyAlert").innerHTML = inj.length
      ? `<div class="alert"><p>🚨 <b>${plural(inj.length, "long-term injury").replace("injurys", "injuries")}:</b> ${inj.map(p => `${esc(p.name)} (${esc(p.pos)}, OVR ${p.est_rating})`).join(", ")}. ${w.window_state === "closed" ? "Window is closed — only free agents can be signed." : "Window is open, but free agents are the fastest, cheapest cover."}</p></div>`
      : `<div class="alert info"><p>No injuries right now. In <b>Squad Audit</b>, press <b>Injure</b> on a player to simulate a crisis — this list updates automatically.</p></div>`;
    $("#faCount").textContent = j.total ? `top ${j.candidates.length} of ${j.total}` : "";
    $("#faList").innerHTML = j.candidates.length ? j.candidates.map(p => {
      const st = p.status === "verified"
        ? `<span class="tag t-ok">Free agent · verified${p.free_since ? " · since " + esc(monthYear(p.free_since)) : ""}</span>`
        : `<span class="tag t-warn">Reported free early Sep 2026 · verify</span>`;
      const d = p.rating_gap;
      return card({ est_rating: p.est_rating, name: p.name, tm_id: p.tm_id, tm_slug: p.tm_slug },
        `${esc(p.sub_position)} · ${p.age} yrs${p.nationality ? " · " + esc(p.nationality) : ""} · last club: ${esc(p.last_club)}`,
        `<div class="price">€${Number(p.est_wage_k)}k<span class="meta">/wk est.</span></div><div class="meta">No fee · value ${money(p.market_value_m)}</div>`,
        `${st}<span class="tag ${d >= 0 ? "t-ok" : "t-warn"}">${d >= 0 ? "+" : ""}${d} vs ${j.reference_player ? "injured player" : "starter"}</span><span class="tag ${p.style_fit >= 70 ? "t-ok" : "t-warn"}">Fit ${p.style_fit}</span>`,
        `<button class="btn" data-sign-fa="${p.id}" data-name="${esc(p.name)}">Sign</button>`);
    }).join("") : `<div class="empty">${esc(j.message)}</div>`;
  } catch (e) { if (my === emSeq) $("#faList").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

/* =================== OFFLOAD PLANNER =================== */
let offSeq = 0;
async function loadOffload() {
  const my = ++offSeq, ov = S.ov, w = ov.workspace;
  const changed = ov.club && ov.club.style !== w.style;
  $("#offloadIntro").innerHTML = `Players who fit poorly in a <b>${esc(w.style)}</b> system (${esc((S.styles[w.style] || {}).description || "")}), matched to clubs across the top 5 leagues whose style, squad needs and budget suit them. ${changed ? `<b>Manager change:</b> ${esc(ov.club.style)} → ${esc(w.style)}.` : "Tip: change the manager playstyle above to see who becomes surplus."}`;
  try {
    const list = await rpc("fn_offload", { p_roster: S.ws });
    if (my !== offSeq) return;
    $("#offloadList").innerHTML = list.length ? list.map(p => card(
      { est_rating: p.est_rating, name: p.name, tm_id: p.tm_id, tm_slug: p.tm_slug },
      `${esc(p.pos)} · ${p.age} yrs · POT ${p.est_potential}`,
      `<div class="price">${money(p.market_value_m)}</div><div class="meta">asking price</div>`,
      `<span class="tag t-bad">Fit ${p.style_fit} in ${esc(w.style)}</span>${flagsHtml({ flag_expiring: p.flag_expiring, flag_aging: p.flag_aging, flag_prospect: p.flag_prospect })}
       <div class="buyers">${p.buyers.length ? p.buyers.map(b => `<span class="buyer">${esc(b.club)} ${lgTag(b.lg)} · ${esc(b.style)} · fit <b>${b.style_fit}</b>${b.needs_position ? " · needs " + esc(p.pos) : ""}</span>`).join("") : `<span class="buyer">No suitable buyer can afford ${money(p.market_value_m)} — consider a loan</span>`}</div>`
    )).join("") : `<div class="empty">Every available player fits the ${esc(w.style)} system reasonably well. Nothing to offload.</div>`;
  } catch (e) { if (my === offSeq) $("#offloadList").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

/* =================== TABS AND CONTROLS =================== */
function loadTab(t) {
  if (t === "recruit") return loadRecruit();
  if (t === "emergency") return loadEmergency();
  if (t === "offload") return loadOffload();
}
function switchTab(t) {
  S.tab = t;
  document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  ["audit", "recruit", "emergency", "offload"].forEach(x => $("#tab-" + x).classList.toggle("hidden", x !== t));
  $("#budgetVal").textContent = "€" + $("#budget").value + "M";
  renderAudit();
  loadTab(t);
  window.scrollTo({ top: 0 });
}
async function signTm(btn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await rpc("fn_add_from_database", { p_roster: S.ws, p_tm_id: Number(btn.dataset.signTm) });
    toast("Added " + btn.dataset.name + " to your squad.", true);
    await refresh();
  } catch (e) { toast(e.message); btn.disabled = false; }
}
async function signFa(btn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await rpc("fn_add_from_database", { p_roster: S.ws, p_free_agent_id: Number(btn.dataset.signFa) });
    toast("Signed " + btn.dataset.name + " (free agent).", true);
    await refresh();
  } catch (e) { toast(e.message); btn.disabled = false; }
}
async function deleteWorkspace(id) {
  if (!window.confirm("Delete this squad from the database? This cannot be undone.")) return;
  try {
    await api("rosters?id=eq." + encodeURIComponent(id), { method: "DELETE", prefer: "return=minimal" });
    await loadMyWorkspaces();
    toast("Squad deleted.", true);
  } catch (e) { toast(e.message); }
}

function wire() {
  /* welcome */
  $("#clubInput").addEventListener("input", e => {
    chosen = null; sel = -1; $("#err").textContent = "";
    $("#goBtn").disabled = !e.target.value.trim();
    runSearchSoon(e.target.value);
  });
  $("#clubInput").addEventListener("keydown", e => {
    if (!sugg.length) return;
    if (e.key === "ArrowDown") { sel = (sel + 1) % sugg.length; renderSuggest(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = (sel - 1 + sugg.length) % sugg.length; renderSuggest(); e.preventDefault(); }
    else if (e.key === "Enter" && sel >= 0) { choose(sugg[sel]); e.preventDefault(); }
    else if (e.key === "Escape") { sugg = []; renderSuggest(); }
  });
  $("#clubInput").addEventListener("blur", () => setTimeout(() => { sugg = []; renderSuggest(); }, 120));
  $("#searchForm").addEventListener("submit", async e => {
    e.preventDefault();
    const q = $("#clubInput").value.trim();
    if (!q) return;
    try {
      if (!chosen) {
        const r = await rpc("fn_search_clubs", { p_q: q, p_limit: 7 });
        if (r.length === 1 || (r.length && r[0].score >= 80)) chosen = r[0];
        else {
          $("#err").textContent = r.length ? `Several clubs match “${q}” — pick one from the list.` : `“${q}” isn't in our database (Premier League, Serie A, LaLiga, Bundesliga, Ligue 1, 2026/27). Check the spelling or browse below.`;
          sugg = r; renderSuggest(); return;
        }
      }
      await openClub(chosen);
    } catch (err) { $("#err").textContent = err.message; }
  });
  $("#newCustom").onclick = async () => {
    const name = window.prompt("Name your squad", "My squad");
    if (name === null) return;
    try { const id = await rpc("fn_create_workspace", { p_name: name }); await loadWorkspace(id); }
    catch (e) { toast(e.message); }
  };
  $("#wsList").addEventListener("click", async e => {
    const o = e.target.closest("[data-open]"), d = e.target.closest("[data-delws]");
    if (o) { try { await loadWorkspace(o.dataset.open); } catch (err) { toast(err.message); } }
    if (d) deleteWorkspace(d.dataset.delws);
  });

  /* header */
  $("#switchClub").onclick = async () => {
    $("#app").classList.add("hidden"); $("#welcome").classList.remove("hidden");
    $("#clubInput").value = ""; chosen = null; $("#goBtn").disabled = true; window.scrollTo(0, 0);
    await loadMyWorkspaces();
  };
  $("#renameWs").onclick = async () => {
    const name = window.prompt("Rename this squad", wsRow().name);
    if (!name || !name.trim()) return;
    try { await patchWorkspace({ name: name.trim().slice(0, 60) }); await loadWorkspace(S.ws); } catch (e) { toast(e.message); }
  };
  $("#resetWs").onclick = async () => {
    const club = S.ov.club;
    if (!club || !window.confirm("Replace this squad with a fresh copy of " + club.name + "'s original squad? Your changes to it will be lost.")) return;
    try {
      const old = S.ws;
      const id = await rpc("fn_create_workspace", { p_club_id: club.id });
      await api("rosters?id=eq." + encodeURIComponent(old), { method: "DELETE", prefer: "return=minimal" });
      await loadWorkspace(id);
      toast("Squad reset to the original.", true);
    } catch (e) { toast(e.message); }
  };
  $("#style").onchange = async e => { try { await patchWorkspace({ style: e.target.value }); await refresh(); } catch (err) { toast(err.message); } };
  $("#window").onchange = async e => { try { await patchWorkspace({ window_state: e.target.value }); await refresh(); } catch (err) { toast(err.message); } };
  const saveBudget = debounce(async (id, v) => {
    try {
      await api("rosters?id=eq." + encodeURIComponent(id), { method: "PATCH", body: { budget_m: v }, prefer: "return=minimal" });
      if (S.ws === id) { S.ov.workspace.budget_m = v; if (S.tab === "recruit") loadRecruit(); }
    } catch (err) { toast(err.message); }
  }, 400);
  $("#budget").oninput = e => { $("#budgetVal").textContent = "€" + e.target.value + "M"; saveBudget(S.ws, Number(e.target.value)); };
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => switchTab(b.dataset.tab));

  /* audit */
  $("#groups").addEventListener("click", e => { const b = e.target.closest("[data-scout]"); if (b) { S.rPos = b.dataset.scout; switchTab("recruit"); } });
  $("#addPlayerBtn").onclick = () => openForm(null);
  $("#roster").addEventListener("click", async e => {
    const th = e.target.closest("th"), inj = e.target.closest("[data-inj]"), ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
    if (th) {
      const k = th.dataset.k; if (k === "flags" || k === "act") return;
      if (S.sortKey === k) S.sortDir *= -1; else { S.sortKey = k; S.sortDir = (k === "name" || k === "pos") ? 1 : -1; }
      renderRoster(); return;
    }
    try {
      if (inj) {
        const p = S.ov.roster.find(x => String(x.id) === inj.dataset.inj);
        await api("roster_players?id=eq." + encodeURIComponent(p.id), { method: "PATCH", body: { injured: !p.injured }, prefer: "return=minimal" });
        if (!p.injured) S.ePos = p.pos;
        await refresh();
      } else if (ed) {
        openForm(S.ov.roster.find(x => String(x.id) === ed.dataset.edit)); $("#playerForm").scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (del) {
        const p = S.ov.roster.find(x => String(x.id) === del.dataset.del);
        if (!window.confirm("Remove " + p.name + " from this squad?")) return;
        await api("roster_players?id=eq." + encodeURIComponent(p.id), { method: "DELETE", prefer: "return=minimal" });
        await refresh();
      }
    } catch (err) { toast(err.message); }
  });

  /* recruitment */
  $("#rPos").onchange = e => { S.rPos = e.target.value; loadRecruit(); };
  $("#rLeague").onchange = e => { S.rLeague = e.target.value; loadRecruit(); };
  const recSoon = debounce(loadRecruit, 350);
  ["#upFee", "#youngFee", "#youngAge"].forEach(id => $(id).addEventListener("input", recSoon));
  document.addEventListener("click", e => {
    if (e.target.closest("#toEmergency")) switchTab("emergency");
    const t = e.target.closest("[data-sign-tm]"); if (t) signTm(t);
    const f = e.target.closest("[data-sign-fa]"); if (f) signFa(f);
  });

  /* emergency */
  $("#ePos").onchange = e => { S.ePos = e.target.value; loadEmergency(); };
  ["#wage", "#unfit", "#verified"].forEach(id => $(id).onchange = loadEmergency);

  /* access key */
  $("#copyKey").onclick = async () => {
    try { await navigator.clipboard.writeText(TOKEN); toast("Access key copied.", true); }
    catch (e) { window.prompt("Your access key (copy it):", TOKEN); }
  };
  $("#useKey").onclick = async () => {
    const k = window.prompt("Paste an access key from another device:");
    if (!k) return;
    if (!UUID_RE.test(k.trim())) return toast("That is not a valid access key.");
    if (k.trim().toLowerCase() !== TOKEN && !window.confirm("Switch to this access key? Your squads under the CURRENT key will not be visible until you switch back, so copy your current key first if you need it.")) return;
    TOKEN = k.trim().toLowerCase();
    try { localStorage.setItem("sc-owner-token", TOKEN); } catch (e) { /* ignore */ }
    $("#app").classList.add("hidden"); $("#welcome").classList.remove("hidden");
    await loadMyWorkspaces();
    toast("Access key changed.", true);
  };
}

/* =================== BOOT =================== */
async function boot() {
  wire();
  try {
    const [leagues, positions, styles, clubs] = await Promise.all([
      api("leagues?select=code,name,country&order=name"),
      api("positions?select=code,name,target_depth,sort_order&order=sort_order"),
      api("playstyles?select=name,description&order=name"),
      api("v_club_profile?select=*&order=name")
    ]);
    leagues.forEach(l => S.leagues[l.code] = l);
    S.positions = positions; S.clubs = clubs;
    styles.forEach(s => S.styles[s.name] = s);
    const players = clubs.reduce((a, c) => a + c.squad_size, 0), sim = clubs.filter(c => !c.is_real).length;
    $("#welcomeNote").textContent = `Database: all ${clubs.length} clubs of the 2026/27 Premier League, Serie A, LaLiga, Bundesliga and Ligue 1, with ${players.toLocaleString("en")} players. The ${sim} promoted clubs, marked “sim”, have simulated squads. Everything is loaded live from the database.`;
    renderChips(); renderGrid();
    await loadMyWorkspaces();
  } catch (e) {
    $("#welcomeNote").textContent = "Could not load the database: " + e.message;
    toast(e.message);
  }
}
boot();
})();
