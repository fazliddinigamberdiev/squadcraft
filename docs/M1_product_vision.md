> **Status note (26 Nov 2026).** This is the M1 document as submitted, converted from `M1_Product_Vision_SquadCraft_4.docx` without changing its content. The final app differs from the M1 plan in places; see "Differences from M1/M2" in the README.

**ISE4133 Software Engineering  
M1: Product Vision**



# Worksheet 1: Product Vision and Scope

**Team Name / Product Name:** SquadCraft

**Members / Contact Channel / Next Meeting:** **RAKHMATULLAEV UMID** , **ABDULLAEV UMRBEK**, **IGAMBERDIEV FAZLIDDIN** / face-to-face / 23rd of September

**Target User, Situation, and Current Problem:  
**• Target User: Football club Sporting Directors, Chief Scouts, and Transfer Managers.  
• Situation: During active transfer windows or mid-season squad crises (e.g., unexpected injuries), decision-makers must rapidly analyze squad depth, player valuation, and potential recruitment targets.  
• Problem: Squad planning relies on fragmented tools (scouting databases, agent feeds, manual spreadsheets), making it slow and difficult to dynamically align squad gaps, style-of-play tactical shifts, financial constraints, and emergency free-agent pickups in real time.

**Current Workaround or Alternative; Observations and Sources:  
**• Workaround: Scouting teams manually aggregate data from platforms like Transfermarkt, Wyscout, or StatsBomb into custom Excel spreadsheets and present static reports to management.  
• Observations & Source: Industry reports and sporting director interviews show that mid-window tactical changes (e.g., new manager arrival) or sudden long-term injuries force frantic, last-minute manual searches, often leading to panic buys or missed transfer windows.

## What / Who / Why

**WHAT (Proposed Product & Boundary):** An AI-driven football transfer intelligence platform that ingests a team's current squad data, provides live valuations, and dynamically generates actionable transfer recommendations across specific scenario triggers (upgrade targets, long-term replacement planning, emergency free agents, and offloading tactical mismatches).

**WHO (Primary User in Specific Situation):** Football Club Sporting Directors and Recruitment Analysts who need immediate, context-aware squad suggestions during active transfer planning and emergency squad reorganizations.

**WHY (Observable Outcome or Benefit):** Reduces the time needed to identify high-fit transfer targets and emergency replacements from days to minutes, preventing misaligned signings when tactical systems or squad availability abruptly change.

## Product Vision Statement

> **FOR** Football Club Sporting Directors and Recruitment Managers **WHO** need fast, data-backed squad planning and emergency transfer solutions, **THE** TransferMind **IS A** dynamic transfer intelligence and squad management web platform **THAT** automatically delivers real-time player valuations, strategic replacement suggestions (peak vs. young potential), free-agent alerts, and targeted offloading recommendations. **Unlike** static scouting databases like Wyscout or Transfermarkt, **OUR PRODUCT** actively analyzes dynamic club scenarios (e.g., manager style changes, long-term injuries) to automatically match and recommend actionable buy/sell candidate lists.

## Scope

**First Version: One Main User Task  
**Input a club/squad roster to receive a live squad audit with tailored acquisition and offloading recommendations.  
  
**Up to Three Essential First-Version Features:  
**1. Dynamic Roster & Valuation Dashboard: Displays live player valuations, contract statuses, and squad depth by position.  
2. Multi-Tiered Recruitment Recommendations: Generates two distinct candidate lists per position: (a) Immediate Upgrade - World-class performers outperforming the current starter; (b) Future-Proof Potential - High-upside young players under a target fee threshold to succeed aging stars.  
3. Emergency & Tactical Scenario Engines: (a) Free Agent Finder - Triggers an emergency list of unattached players when a positional injury occurs post-window; (b) System Mismatch Offloader - Identifies players unsuited to a new manager's playstyle and suggests a list of compatible buyer clubs.  
  
**One Feature Excluded for Now, and Why:  
**Automated contract/wage negotiation simulation and direct agent contact integration. Reason: Negotiation logic involves complex legal and agent-specific variables that distract from verifying the core algorithmic recommendation accuracy.  
  
**Important Data or External Dependency:  
**Live player market values, injury tracking, performance metrics, and tactical playstyle attributes. Access Plan: Integrate public sports data APIs (e.g., API-Football, Transfermarkt scraper APIs, or open StatsBomb datasets) during prototyping.

# Worksheet 2: Assumptions and Verification

## Assumptions Table

| **Assumption**                                                                                                                                                                     | **Why it matters**                                                                                 | **Evidence now**                                                                 | **Confidence** |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|----------------|
| 1\. Recommendation Relevance: Scouting teams will trust and value automated AI playstyle and potential recommendations over traditional human-driven scouting spreadsheets.        | If decision-makers do not trust the algorithm's tactical logic, they will not use the platform.    | None; based on general industry trends toward data analytics in football.        | Low (L)        |
| 2\. Buyer Matching Accuracy: Clubs can accurately predict which rival clubs would accept an offered surplus player based on playstyle compatibility.                               | Offloading misfitted players relies entirely on finding plausible destination clubs.               | Manual scouting reports routinely perform similar tactical compatibility checks. | Medium (M)     |
| 3\. API Data Feeds: Publicly accessible football APIs provide sufficiently real-time and structured data (injuries, values, positions) to feed our recommendation engine reliably. | Core platform functionality breaks if live injury and market value data are inaccurate or delayed. | Standard APIs (API-Football) document live injury feeds and squad listings.      | High (H)       |

## Prototype and Verification Plan

**Riskiest Assumption and Question to Answer:  
**• Riskiest Assumption: Assumption 1 (Will sports analysts find AI-generated player swap and recruitment suggestions actionable and tactically sound?).  
• Question: Do data-driven transfer recommendations (e.g., "replace aging Veteran X with Young Prospect Y" or "offload Player Z to Club A based on system mismatch") match the logical decisions of real football managers/analysts?  
  
**Smallest Useful Prototype (What it will deliberately NOT build):  
**• Prototype: A low-code / Figma interactive wireframe connected to a mock database of 3–4 teams and ~100 top European players.  
• Deliberately Excluded: Live real-time API integrations, user account authentication, custom backend engines, and full global player databases.  
  
**Target Participant or Test Condition; Task or Procedure:  
**• Participants: 3–5 semi-professional/amateur club analysts, football researchers, or experienced football management game analysts (e.g., Football Manager community scouts).  
• Procedure: Give participants a scenario (e.g., "Your club just hired a High-Pressing Manager, your main CB is out for 6 months, and your core Winger is 33 years old"). Have them navigate the prototype dashboard and evaluate the generated list of free agents, young prospects, and potential offload target clubs.  
  
**Observation that Would Support the Assumption:  
**Participants rate \>75% of the recommended players and target buyer clubs as "highly plausible" or "actionable insights they would include in a scouting briefing."  
  
**Observation that Would Make Us Revise the Vision:  
**Participants dismiss recommendations as "unrealistic," "tactically mismatched," or prefer doing manual spreadsheet filtering because the AI lacks nuanced context.

# Worksheet 3: AI Critique and Team Decisions

**AI Critique Prompt:  
**"You are a critical product coach. Context: \[WHAT: Football transfer intelligence platform. WHO: Sporting directors & analysts. WHY: Fast replacement and offloading suggestions. VISION: FOR Sporting Directors WHO need fast transfer planning, TransferMind IS A web platform THAT automatically recommends targets and offloading options. UNLIKE static databases, OUR PRODUCT matches dynamic triggers like injuries/style changes to buy/sell lists.\] Restate user/problem/value, identify assumptions/ambiguities, and suggest evidence for riskiest assumption."  
  
**Tool and Date:** ChatGPT / Claude — September 20, 2026

## Team Decisions Matrix

| **Suggestion or Claim from AI**                                                                                                               | **Decision** | **Team's Reason**                                                                                                                       | **Verification Action**                                                                              |
|-----------------------------------------------------------------------------------------------------------------------------------------------|--------------|-----------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| The platform assumes football clubs are willing to input their internal tactical parameters and transfer budgets into a third-party web tool. | Accept       | High security/privacy concerns exist in professional football concerning internal target lists.                                         | Add a non-functional prototype workflow demonstrating local/encrypted data handling for club inputs. |
| 'Playstyle mismatch' is subjective and hard to define quantitatively purely through public stats.                                             | Modify       | Standard metrics (e.g., pressing frequency, passing length, defensive line height) can serve as strong proxies for playstyle alignment. | Test simplified playstyle tag definitions during our user prototype review.                          |
| Free agents usually have underlying fitness or wage issues that raw position matching ignores.                                                | Accept       | A free agent list is useless if the player's wage demands exceed the club's structure.                                                  | Add a 'Wage Bracket' filter to the emergency free-agent search criteria in M2 design.                |

## Submission Sign-off Checklist

**☑** Team details, What / Who / Why, and the vision statement are complete.

**☑** Scope identifies a main task and excludes at least one feature.

**☑** At least three assumptions are clearly separated from observations.

**☑** One risky assumption has a prototype and verification plan.

**☑** The actual critique and reasoned team decisions are recorded.

**☑** Every member can explain the final vision and its remaining uncertainty.

**  
Team Sign-off:** \[Member Names & Date\]
