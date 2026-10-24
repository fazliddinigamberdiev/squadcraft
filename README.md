# SquadCraft (TransferMind)

Smart football squad audit and transfer management tool. ISE4133 Software Engineering team project.

**Team:** Rakhmatullaev Umid, Abdullaev Umrbek, Igamberdiev Fazliddin

SquadCraft lets a club manager or sporting director pick one of the 96 clubs in the 2026/27 Premier League, Serie A, LaLiga, Bundesliga or Ligue 1, audit the squad, and get transfer and free-agent suggestions that fit the manager's playstyle and budget.

## Run it

No build step, server or install is needed.

1. Clone or download this repository.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
3. Type a club name (for example `Arsenal` or `man utd`) or click a club in the grid.

`index.html` loads `data.js` from the same folder, so keep the two files together.

## Features (current prototype)

| Tab | What it does |
|---|---|
| Squad Audit | Squad value, average age, expiring contracts, style mismatches, depth by position (available vs target), sortable roster. The **Injure** button simulates a long-term injury. |
| Recruitment | For a chosen position: *Immediate Upgrade* targets that beat your starter within budget, and *Future-Proof* young players under a fee cap. Both are ranked using playstyle fit. |
| Emergency Free Agents | Unattached players for the injured player's position, filtered by wage, age and a "verified only" switch. |
| Offload Planner | After a manager playstyle change, players who no longer fit and the clubs that could buy them. |

## Data and limitations

- **Real squads:** 82 clubs (about 2,380 players) from the open [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) project, snapshot **6 July 2026**. Transfers after that date are not included.
- **Free agents:** 154 players. 138 are verified from transfertracker.ai (22 Oct 2026). 16 were reported as unattached in news (2-4 Sep 2026) and are labelled "verify" in the UI.
- **Simulated data:** the 14 newly promoted clubs have **simulated** squads (made-up players, generated from a seed per club so they are the same on every load). They are marked "sim" in the UI.
- **Estimates:** ratings, potential, playstyle attributes and wages are SquadCraft model estimates, not official figures.
- **Privacy:** there is no backend and no account. The only thing stored is your last selected club id in `localStorage`. The page does load fonts from Google Fonts (see Known issues).

## Tests

Headless functional checks load the real `index.html` and `data.js` in jsdom and drive the UI (search, audit, injury flow, free agents, recruitment, offload, HTML escaping).

```bash
cd tests
npm install
npm test
```

Expected result: `19/19 checks passed`.

## Known issues / not started

- Data is a static snapshot. There is no refresh pipeline yet.
- Fonts are loaded from Google Fonts, which sends the visitor's IP address to Google. Planned fix: self-host the fonts.
- Estimated ratings and playstyle fit have not been validated against real scouting data.
- No automated accessibility or mobile testing yet.

## Files

- `index.html` - UI and all application logic
- `data.js` - player and free-agent data snapshot
- `tests/` - headless checks (`run_checks.js`)
- `AI_USAGE.md` - AI assistance record
