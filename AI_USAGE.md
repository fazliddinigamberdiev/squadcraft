# AI usage

| Item | Tool | What the AI did | How it was verified |
|---|---|---|---|
| `README.md` | Claude (Anthropic) | Drafted the README from reading `index.html` and `data.js`. | Counts (96 clubs, 82 real / 14 simulated, 154 free agents: 138 verified / 16 reported) were checked against the code and data; run instructions tested by loading the page. |
| `tests/run_checks.js` | Claude (Anthropic) | Wrote 19 headless checks against the app's real code. | Ran with `npm test`: 19/19 pass. One early failure (T5) was a flaw in the test (hidden suggestion list kept old markup), so the test was fixed, not the app. |

Team members should review and edit this file to match what they personally did.
