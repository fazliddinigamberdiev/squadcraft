# AI usage

| Item | Tool | What the AI did | How it was verified |
|---|---|---|---|
| `README.md` | Claude (Anthropic) | Drafted and later rewrote the README for the database-backed version. | Counts (96 clubs, 82 real / 14 simulated, 2,382 + 328 players, 154 free agents: 138 verified / 16 reported) checked with SQL `count(*)` queries. |
| `db/schema.sql`, `db/seed/*` | Claude (Anthropic) | Wrote the SQL (tables, RLS, views, functions), the seed generator and the simulated-squad generator, following the M2 story slice rules. | Applied to Supabase and to a clean local PostgreSQL 16 database; row counts matched; RLS isolation tested with two different `x-owner-token` values; M2 acceptance cases (thin depth, upgrade/future-proof empty messages, tie ordering) tested in SQL. |
| `index.html`, `app.js` | Claude (Anthropic) | Converted the static single-file app into a thin client that calls the database (REST + RPC). | `node --check`, jsdom smoke test with mocked responses, and manual use in a browser. |
| `tests/smoke.js` | Claude (Anthropic) | Wrote the jsdom smoke test. | Ran with `npm test`. |

Team members should review and edit this file to match what they personally did.
