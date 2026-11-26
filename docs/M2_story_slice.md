> **Status note (26 Nov 2026).** The text below is the M2 document as submitted (dated 20 Sept 2026), converted from `M2_story_slice_pdf.pdf` without changing its content. Only the "Saved file / location" line was filled in, and the section "Update after implementation" at the end was added. The final app differs from M2 in places; see "Differences from M1/M2" in the README.

# M2 Story Slice: Two Stories, Checkable Outcomes

ISE4133 Software Engineering | Week 4 | Worksheets 1 and 2

**Status: Draft.** All criteria describe expected future behavior. No check has been executed, and no result is claimed.

## Worksheet 1: Context and Story 1

### Team, product, members, date

| | |
|---|---|
| Product | SquadCraft |
| Members | Rakhmatullaev Umid, Abdullaev Umrbek, Igamberdiev Fazliddin |
| Date | 20 Sept 2026 |

### M1 input: user and problem

- **User:** Football club Sporting Directors, Chief Scouts, Transfer Managers, and Recruitment Analysts.
- **Problem:** Squad planning relies on fragmented tools (scouting databases, agent feeds, manual spreadsheets). Aligning squad gaps, tactical shifts, budget limits, and emergency signings is slow during a transfer window or an injury crisis.
- **Feedback received:** No feedback yet. The only review so far is the AI critique in M1 Worksheet 3 (Claude, 20 Sept 2026). No real user has reviewed the idea.

### Decision: retain the M1 direction, narrowed

**Decision:** Keep the M1 direction, but narrow this slice to the first-version main task: the user provides a squad roster and receives a squad audit with acquisition recommendations. The System Mismatch Offloader and Emergency Free Agent Finder are deferred.

**Reason:** The roster dashboard and the recommendations are the foundation for both deferred engines, and they test our riskiest assumption (Assumption 1: analysts will trust the recommendations).

### User profile

- **Role:** Sporting Director or Recruitment Analyst at a football club.
- **Situation:** Active transfer window or mid-season squad crisis (long-term injury, new manager, ageing star).
- **Constraint:** Little time. Data is spread across several tools, and decisions must be justified to management.
- **Evidence source:** M1 sources (industry reports and sporting director interviews). The team has not independently verified them.
- **Assumption (unverified):** These users would enter their squad into a third-party web tool. The M1 critique flagged privacy concerns.

### Scenario

A club has just hired a high-pressing manager, its main centre-back is out for six months, and its core winger is 33. The Sporting Director provides the current squad roster to see where the squad is thin, then asks for candidates for the weak positions. The expected benefit (an assumption, not a measured result) is a shortlist of plausible targets in minutes instead of days of manual spreadsheet work.

### S1: First core story

As a Sporting Director, I want to see my squad's depth by position, with each player's current market value and contract status, so that I can quickly identify which positions are weak, ageing, or expiring.

| ID | Criterion |
|---|---|
| S1-AC1 | **Given** a submitted roster of 25 players, each with a position, a market value, and a contract end date, **When** the dashboard is opened, **Then** every player appears under their position group with their market value and contract end date, and each group displays its number of players. |
| S1-AC2 | **Given** a roster in which a position group has fewer than two players (one player, or none), **When** the dashboard is opened, **Then** that group is marked "Thin depth" (a group with no players is still listed, with a count of 0), and the marker is visible on the dashboard without opening any other screen. |

**Priority and rationale:** Priority 1 (first). Story 2 needs this audit to know which positions need candidates.

**Dependency:** A roster source. For the prototype, mock data of 3-4 teams and about 100 players (per M1).

## Worksheet 2: Story 2 and Team Review

### S2: Second core story

As a Sporting Director, I want two candidate lists for a selected position (an immediate upgrade and a future-proof young prospect), so that I can choose between a signing that improves the team now and one that prepares for the long term.

| ID | Criterion |
|---|---|
| S2-AC1 (Immediate Upgrade) | **Given** a selected position with a current starter and the target "Immediate Upgrade", **When** recommendations are requested, **Then** the system lists only players in that position whose position-specific performance rating (0-100, from the prototype's mock data) is higher than the current starter's, and each entry shows name, age, market value, and its rating next to the starter's rating. |
| S2-AC2 (Future-Proof) | **Given** the same position, the target "Future-Proof", and a maximum fee entered by the user, **When** recommendations are requested, **Then** the system lists only players aged 21 or under and with a market value at or under the entered fee, and no player above either limit is displayed. |
| Alternate case (covered) | **Given** a position where no player meets both the age limit and the fee limit, **When** the Future-Proof list is requested, **Then** the system shows the message "No candidates match these limits" and displays no players. |

**Priority and rationale:** Priority 2. It delivers the main value (target suggestions) but needs the S1 position audit as input.

**Dependency:** Player performance data and valuations. Mock data for the prototype, later a public sports API.

### Assumptions, draft rules, and open questions

| Type | Item |
|---|---|
| Assumption | Users would enter their squad into a third-party web tool (privacy concern flagged in M1). |
| Assumption | Assumption 1 (from M1): analysts will trust the recommendations. This slice exists to test it. |
| Draft rule (not agreed) | "Thin depth" means fewer than two players in a position group (S1-AC2). |
| Draft rule (not agreed) | "Rates higher" means a higher position-specific performance rating on a 0-100 scale (S2-AC1). |
| Draft rule (not agreed) | The current starter is the highest-rated player in the selected position. |
| Draft rule (not agreed) | "Young potential" means age 21 or under. |
| Draft rule (not agreed) | A fee or age exactly equal to the limit is included ("at or under"). |
| Draft rule (not agreed) | Both lists are sorted with the highest rating first. |
| Open question | Does the user type in a roster, or pick one of the mock teams in the prototype? |
| Open question | What does the system show when no player rates above the current starter (Immediate Upgrade)? |

### Excluded from this slice

System Mismatch Offloader and Emergency Free Agent Finder. **Reason:** Both need extra data (buyer-club playstyles, wage brackets, injury feeds) and rest on Assumption 2, which has only medium confidence. They come after the core recommendations work. Contract and wage negotiation simulation and agent contact remain excluded, as in M1.

### Review the document, then save it

Tick a box only after the reviewer has actually checked it.

- [ ] Both stories relate to the same stated user task and scenario (squad audit followed by recommendations for a weak position).
- [ ] Each criterion has a result another person could inspect (displayed list, marker, message).
- [ ] Assumptions, agreed draft rules, and open questions are distinguishable (see the table above).
- [ ] The document describes expected behavior without inventing test results. No check has been executed.

| | |
|---|---|
| Reviewer | [name to fill in] |
| Ambiguity 1 | "Rate above the current starter": the metric was undefined. Changed S2-AC1 to name one metric, a position-specific performance rating (0-100), and recorded it as a draft rule. |
| Ambiguity 2 | "Thin depth": the threshold was undefined. Changed S1-AC2 to state it directly: fewer than two players in a position group. |
| Saved file / location | `docs/M2_story_slice.md` in the repository |
| Reopened and checked by | [name to fill in] |

### AI use

We used Claude for feedback, since we could not run a survey, and for compiling and polishing this draft from the M1 document. The M1 critique is referenced in AI_USAGE.md; an entry for this drafting is added there, together with the checks made against the M1 file.

## Update after implementation (26 Nov 2026)

This section is new. It is not part of the submitted M2 text above.

| M2 item | Status in the final app |
|---|---|
| S1-AC1, S1-AC2 | Implemented as written (Squad Audit tab; rule in `fn_workspace_depth`; all 8 position groups always listed, empty ones with count 0). Checked in SQL and by `tests/smoke.js`. |
| S2-AC1 | Implemented (`fn_recommend_upgrade`). The rating is `est_rating` (1-99), a SquadCraft estimate from market value and age, not a match-performance rating, and the data is real-player data, not mock data. |
| S2-AC2 and the alternate case | Implemented (`fn_recommend_future`; age default 21, fee inclusive; message "No candidates match these limits"). The lists can also be capped at the squad's transfer budget (checkbox, on by default). |
| Open question: type a roster or pick a team | Both are possible: copy a real club's squad, or start an empty squad and add players. |
| Open question: nobody rates above the starter | The message "No player rates above the current starter" is shown. |
| Excluded: Offloader and Emergency Free Agent Finder | Built after M2 (`fn_offload`, `fn_emergency`), including the wage filter from the M1 critique. |
| Still excluded | Negotiation simulation and agent contact. |
| Reviewer fields and tick boxes | Not filled in. They need a team member to review and sign. |
| User check (M1: 3-5 analysts, more than 75% plausible) | Not done. No claim of verified recommendations is made. |
