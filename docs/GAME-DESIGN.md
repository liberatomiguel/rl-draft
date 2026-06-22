# Rocket League Esports Draft Game

## Project Base Document

This document defines the core concept, gameplay rules, systems, data structure and MVP scope for a web app based on a Rocket League esports historical draft game.

The goal is to use this document as the main reference when starting the development of the project.

---

# 1. Core Concept

The app is a web-based Rocket League esports draft game.

The player builds a custom 3v3 roster by drafting historical Rocket League esports cards from official RLCS seasons and then simulates a championship run using that drafted team.

The experience should balance:

- Historical Rocket League esports knowledge
- Draft strategy
- Replayability
- Collection/progression
- Simple rules with enough depth under the hood

The game should feel like a fast, personal, draft-style game inspired by sports card modes, but focused on Rocket League esports history.

The game is not meant to replicate Liquipedia. Liquipedia/API data is used only as a data source for educational and personal learning purposes.

---

# 2. Platform

The app will be a responsive web app.

It should work well on:

- Desktop
- Mobile
- Tablet

Mobile experience is important, so the main draft loop must be readable, tappable and fast.

Recommended technical direction for MVP:

- Next.js or React
- Tailwind CSS or similar utility-first styling
- Local JSON data at first
- LocalStorage for early progress
- Supabase later for login, database and synced progress
- Discord login later through OAuth

---

# 3. Main Game Loop

The main loop is:

```txt
Home
↓
Game setup
↓
Draft team
↓
Review team
↓
Simulate tournament
↓
Results screen
↓
Unlock rewards / achievements / collection progress
↓
Return to menu
```

The core mode is called **Classic Draft**.

---

# 4. Classic Draft Structure

In the standard game mode, the player drafts a full Rocket League team structure:

```txt
3 Players
1 Coach
1 Substitute
1 Organization
```

The final drafted roster has 6 slots:

```txt
Player 1
Player 2
Player 3
Coach
Substitute
Organization
```

## Draft Round Behavior

At the start of each draft round, the app randomly selects one historical RLCS lineup from the database.

That lineup displays:

```txt
3 players
coach
substitute
organization
```

The user can choose **one card** from that lineup to add to their own team.

Then the app moves to the next randomly selected lineup.

This continues until all six roster slots are filled.

## Free Choice Rule

The player has free choice.

This means the game does not force a specific slot per round.

Example:

- If the user picks a player, it fills one of the three player slots.
- If the user picks a coach, it fills the coach slot.
- If the user picks an org, it fills the org slot.

If a slot type is already full, cards of that type should either be disabled or clearly marked as unavailable.

Example:

```txt
Player slots full
```

This keeps the draft strategic without overcomplicating the interface.

---

# 5. Draft Randomness

The draft pool must always be purely random.

Difficulty should not manipulate which lineups appear during the draft.

This is important because the draft should feel fair and unpredictable across all difficulties.

Difficulty affects the tournament simulation, rerolls and visibility of information, not the draft lineup pool.

---

# 6. Reroll System

Rerolls allow the player to discard the currently shown lineup and receive a new random lineup.

Rerolls are limited by difficulty.

```txt
Easy: 3 rerolls
Normal: 1 reroll
Hard: 0 rerolls
Legacy: 0 rerolls
```

Rerolling should replace the full lineup, not individual cards.

---

# 7. Difficulty Modes

Difficulty affects:

- Number of rerolls
- Whether overall can be shown or hidden
- Opponent strength in tournament simulation
- Chance of opponents having special cards
- Weight of chemistry and internal modifiers

Difficulty must not affect the draft lineup pool.

## Easy

```txt
Rerolls: 3
Overall: can be shown or hidden
Draft pool: pure random
Tournament opponents: slightly more accessible
Opponent special cards: very rare
Chemistry impact: low
Randomness: slightly more forgiving
```

Easy is meant for learning the game and experimenting.

## Normal

```txt
Rerolls: 1
Overall: can be shown or hidden
Draft pool: pure random
Tournament opponents: balanced
Opponent special cards: rare
Chemistry impact: moderate
Randomness: standard
```

Normal is the default mode.

## Hard

```txt
Rerolls: 0
Overall: locked hidden
Draft pool: pure random
Tournament opponents: stronger
Opponent special cards: moderate
Chemistry impact: relevant
Randomness: less forgiving
```

Hard should reward historical knowledge more than Normal.

## Legacy

Legacy is unlocked after the player wins a tournament on Hard.

```txt
Rerolls: 0
Overall: locked hidden
Draft pool: pure random
Tournament opponents: mostly strong and historically recognized teams
Opponent special cards: moderate/high
Chemistry impact: relevant
Special cards in player draft: normal or slightly reduced chance
```

Legacy should feel like an all-time gauntlet against historically strong teams.

The draft rules remain mostly the same as Hard.

---

# 8. Overall Visibility

Before starting a game, the player can choose whether to see player overalls during the draft.

```txt
Show Overall: ON/OFF
```

In Hard and Legacy, overall is locked hidden.

```txt
Hard: Overall locked hidden
Legacy: Overall locked hidden
```

If the player chooses hidden overall, the draft becomes more dependent on Rocket League esports knowledge.

Recommended reveal behavior:

- During hidden-overall runs, keep overalls hidden throughout the draft and tournament.
- Reveal overalls only on the results screen.

This creates a satisfying post-run reveal.

---

# 9. Player Cards and Player Identity

The game must separate **players** from **player cards**.

A player is a real person/entity.

A player card is a version of that player in a specific lineup, season or moment.

Example:

```txt
Kaydop 2017 Gale Force ≠ Kaydop 2021 Vitality
jstn 2018 NRG ≠ jstn 2023 NRG
Alpha54 2020 Vitality ≠ Alpha54 2023 Vitality
```

Therefore, overall is not attached only to the player. It is attached to the player card.

Each player can have many cards.

---

# 10. Card Types

The game should support different card types.

## Base Cards

Base cards represent a player, coach, sub or org in a specific RLCS season/lineup.

They are the normal cards used in the draft. They can be silver, gold or blue rarity. Silver = ovr 79-; Gold = ovr 80-89; Blue = ovr 90+. On difficulties that dont enable the overall number display, the card will be black and show "??" where the overall number would be.

## Special Cards

Special cards represent historical moments, iconic performances, major wins, world championship runs, legendary peaks or other notable Rocket League esports moments.

Special cards are rare and collectible.

They may have:

- Higher overall
- Higher internal stats
- Special effects
- Different visual design
- Collection entry

---

# 11. Special Card Tiers and Rarities

Special cards can be organized by both type and rarity.

## Possible Special Card Types

```txt
Moment Card
Major MVP Card
Worlds MVP Card
Mythic Card
Legend Card
```

## Possible Rarities

```txt
Rare
Epic
Mythic
Legendary
```

These should be treated as historical collectible cards, not as paid lootbox mechanics.

No paid packs, gambling mechanics, betting mechanics or real/virtual currency wagering should be attached to special cards.

Even though base cards will be black on disabled overall difficulties, special cards can still show, but displaying "??" where the overall number would be.

---

# 12. Special Card Unlock Rule

A special card is unlocked in the collection when:

```txt
1. The card appears during the draft
2. The player selects that card for their team
3. The player completes the run
```

The player does not need to win the tournament.

They only need to finish the run.

This encourages players to finish games even when the tournament is not going well.

---

# 13. Special Card Balance

Special cards should be stronger than normal cards, but not game-breaking.

They should usually provide:

```txt
Moderate overall boost
Specific internal stat boost
Small situational effect
```

Examples of situational effects:

```txt
+ Clutch in Game 5 / Game 7
+ Consistency during Swiss
+ Experience during playoffs
+ Slight upset chance increase
+ Small defensive stability boost
```

*[As built: the shipped effect model is the v3 `attribute_boost` /
`team_attribute_boost` form (boosts on the card's stats; `team_attribute_boost`
for coach specials). The situational types shown above are legacy/back-compat.
See DATA-GUIDE.]*

Avoid making special cards simply “99 overall and unbeatable”.

They should feel exciting, but still balanced.

They should feer rare, but the player still can find them while playing normally.

---

# 14. Card Display During Draft

During the draft, cards should show only the information needed to make a good decision.

Recommended card information:

```txt
Nickname/name
Country
Team/org
Season
Overall, if enabled (if disabled, display "??")
Card type/rarity, if it's a collected special card. If the special card is not yet collected, show "??" where the rarity would be.
```

Avoid showing too many internal attributes during the draft.

The draft should be quick, not a spreadsheet.

---

# 15. Special Card Display in Collection

The collection can show deeper information, especially for special cards.

A card detail page in the collection can show:

```txt
Nickname/name
Card title
Historical moment/context
Overall
Internal stats
Special effect
Rarity
Season
Team/org
Country
Region
Date unlocked
```

The collection should also show progress.

Example:

```txt
Special Cards: 12/120 unlocked
```

Locked cards can appear as silhouettes or hidden cards to encourage replay.

---

# 16. Internal Player Stats

The game should use internal stats for simulation and card depth.

Recommended internal stats:

```txt
Overall
Offense
Defense
Mechanics
Consistency
Experience
Clutch
```

## Overall

The main number shown to the player when overall visibility is enabled.

It is the most important visible rating.

## Offense

Affects scoring potential and pressure.

## Defense

Affects stability and ability to avoid bad losses.

## Mechanics

Affects ceiling, explosive performances and high-roll moments.

## Consistency

Reduces negative variance and collapse chances.

## Experience

Helps in longer series and playoffs.

## Clutch

Helps in Game 5, Game 7, overtime and close series.

---

# 17. Overall Calculation System

Overall should be built in two layers:

```txt
Calculated base overall
+
Manual adjustment
=
Final overall
```

## Calculated Base Overall

The automatic calculation can consider:

```txt
Team placement
Tournament tier
Season strength
Win rate
Titles
Major/Worlds appearances
Top 4 / Top 8 finishes
Individual stats, if available
Region strength/context
Consistency across events
```

## Manual Adjustment

Manual review is necessary because esports data can be misleading.

Some players overperform statistically due to context. Others may be historically elite despite worse team results.

Recommended adjustment range:

```txt
Normal manual adjustment: -3 to +3
Exceptional adjustment: -5 to +5
```

Example:

```txt
overall_calculated: 88
manual_adjustment: +3
final_overall: 91
```

Manual adjustment should be stored separately from the calculated base, so future recalculations remain possible.

*[As built: `manualAdjustment` is effectively always 0 in the generated
dataset — overall tuning happens at source in `teams.md`.]*

---

# 18. Team Overall / Team Rating

The simulation should be mostly driven by the drafted players’ overalls.

Other systems add depth, but player strength must remain the main factor.

Recommended conceptual weighting:

```txt
Players: 75%
Coach: 8%
Substitute: 4%
Organization: 5%
Chemistry: 5%
Special effects: 3%
```

A simple conceptual formula:

```txt
Team Rating =
Average player overall
+ coach modifier
+ sub modifier
+ org modifier
+ chemistry modifier
+ special card modifier
```

The displayed Team Overall should remain understandable.

Detailed internal calculations can stay hidden.

*[As built: a superteam compression (pivot 94 / slope 0.55) is applied above the
pivot before the difficulty shift (live since v0.5).]*

---

# 19. Coach System

Coach cards should influence the simulation, but not dominate it.

Possible coach internal stats:

```txt
Overall
Strategy
Mental
Experience
Development
Clutch
```

For MVP, coach can simply have:

```txt
Coach overall
Main bonus type
Bonus strength
```

Example:

```txt
Coach: Mew
Bonus: Consistency ++
```

---

# 20. Substitute System

Substitute cards have smaller impact than players and coaches.

They can provide stability/depth.

Possible sub effects:

```txt
Small consistency bonus
Small experience bonus
Small chemistry bonus if connected to lineup/org/player
```

The sub should matter, but not decide the whole run.

---

# 21. Organization Buffs

Organizations provide simple buffs.

The user-facing buff system should use simple symbols:

```txt
+++ strong bonus
++ medium bonus
+ light bonus
~ neutral
```

Avoid negative org modifiers in the MVP.

Internally, the symbols can map to stat modifiers:

```txt
+ = +1
++ = +2
+++ = +3
~ = 0
```

Possible org buff categories:

```txt
Offense
Defense
Mechanics
Consistency
Experience
Clutch
```

Examples:

```txt
G2 Esports: Offense ++
Team BDS: Consistency ++
NRG: Experience ++
Team Vitality: Mechanics ++
Cloud9: Clutch ++
FURIA: Mechanics +
```

Org buffs should be easy to read during the draft and team review.

---

# 22. Chemistry System

Chemistry should add depth without becoming too complicated.

No era-based chemistry should be used in the current design.

## Chemistry Sources

```txt
Same historical lineup: +++
Same country: ++
Same organization, different lineups: +
Coach connected to player/team: +
Sub connected to player/team/org: +
```

Examples:

```txt
Monkey Moon + Extra from same Team BDS lineup: +++
Yanxnz + caard from Brazil: ++
jstn + NRG org: +
Mew + BDS players: +
```

## Chemistry Impact by Difficulty

```txt
Easy: chemistry exists but has low impact
Normal: chemistry has moderate impact
Hard: chemistry has relevant impact
Legacy: chemistry has relevant impact
```

*[As built: on Hard and Legacy chemistry is ASYMMETRIC — it applies to the
player's team only; AI opponents get 0 chemistry bonus
(`opponentChemistryMaxBonus=0`). See DESIGN-DECISIONS #54.

v1.4 ADDITIVE rework: each player pair now scores on two INDEPENDENT axes that are
SUMMED — a CONNECTION axis (same lineup 4 > ex-teammates 3 > shared org 2.5) and a
HERITAGE axis (same country 2.5 > same region 1.5); within an axis only the
strongest form counts, but the two axes stack (a same-country pair who also shared
an org scores country + org). Plus additive supplements: org loyalty 2/player, coach
link (cap 3), sub link (cap 2) and a staff-nationality bonus. Raw is normalised
against maxRaw 10 → percent → tier (Perfect ≥100 is a full bar). The old
"strongest single link only" model is gone. The AI-cap-0 split above is unchanged.]*

## Chemistry Display

Recommended display:

```txt
Chemistry: Poor / Okay / Good / Great / Perfect
```

A numeric value can also be shown in the team review, but it should not overload the draft screen.

---

# 23. Team Style / Player Roles

The idea of choosing 1st, 2nd and 3rd player roles is interesting, but should not be part of the MVP.

It adds complexity because Rocket League roles are fluid and change by season, meta and lineup.

For MVP:

```txt
No fixed 1st/2nd/3rd player roles
No offensive/defensive/balanced team style selection
```

Possible V2 feature:

```txt
Team Style:
- Offensive
- Balanced
- Defensive
```

This would modify internal stats slightly.

Example:

```txt
Offensive: + offense, - defensive stability
Balanced: neutral
Defensive: + consistency/defense, - offensive ceiling
```

This should be added only after the core gameplay is validated.

---

# 24. Tournament Simulation

After the draft is complete, the player enters a simulated RLCS-style tournament.

The simulation should use official-inspired RLCS structure:

```txt
Swiss Stage
Playoffs
```

Initial MVP can simplify playoffs if needed.

## Swiss Stage

Recommended structure:

```txt
16 teams
Best of 5 series
Advance with 3 wins
Eliminated with 3 losses
Maximum 5 rounds
```

User sees each round result.

Example:

```txt
Round 1: Your Team vs Team Falcons — Win 3-2
Round 2: Your Team vs G2 — Loss 1-3
Round 3: Your Team vs FURIA — Win 3-1
```

## Playoffs

Preferred long-term format:

```txt
Double elimination
Best of 7 series
```

MVP can use a simplified single-elimination playoff if needed.

Recommended MVP path:

```txt
MVP: Swiss + simplified playoffs
Later: Swiss + double elimination playoffs
```

---

# 25. Match Simulation Logic

The simulation should be internally rich but externally understandable.

Visible factors:

```txt
Team Overall
Chemistry
Org Bonus
Special Effects
```

Internal factors:

```txt
Player overalls
Offense
Defense
Mechanics
Consistency
Experience
Clutch
Coach modifier
Sub modifier
Org modifier
Chemistry modifier
Special card effects
Randomness
```

## Conceptual Match Rating

```txt
Match Rating =
Team Rating
+ Chemistry Modifier
+ Coach Modifier
+ Org Modifier
+ Special Card Modifier
+ Random Roll
```

## Randomness

Randomness should create upsets and close series, but not turn the game into pure luck.

Overall must remain the strongest factor.

Examples:

```txt
90 vs 78: the 90-rated team should win most of the time
86 vs 84: either team can win
82 vs 88: upset is possible, but difficult
```

Possible random ranges:

```txt
Easy: -3 to +5 for player team
Normal: -4 to +4
Hard: -5 to +4
Legacy: -5 to +5
```

These values are only initial design ideas and should be playtested.

*[As built: the live values live in `balance.ts` `DIFFICULTY.*.userRollRange`
(Normal -3..+4, Hard -3.5..+4); the spec numbers above are superseded initial
ideas.]*

---

# 26. Tournament Opponent Generation

Tournament opponents are generated from the database of historical teams.

Difficulty affects the opponent pool/weight, not the draft pool.

## Easy

Opponents are slightly more accessible.

Very strong teams can still appear, but less frequently.

Opponent special cards are **very rare**.

## Normal

Opponents are balanced.

Opponent special cards are **rare**.

## Hard

Opponents are stronger on average.

Opponent special cards are **moderate**.

## Legacy

Opponents are mostly strong, historically recognized teams.

Opponent special cards are **moderate/high**.

Legacy should feel like facing a gauntlet of iconic teams.

---

# 27. Results Screen

The results screen should be satisfying and informative.

Recommended information:

```txt
Final placement
Swiss record
Playoff result
Team Overall
Chemistry
Best player
Biggest win
Closest series
Worst loss
Unlocked cards
Achievements unlocked
XP gained
Rank progress
```

If the run used hidden overall, this is where overalls should be revealed.

Possible result messages:

```txt
Your team survived a five-game Swiss series.
Chemistry made the difference in a close matchup.
The coach bonus helped stabilize the run.
Your team fell short in the semifinals.
A special card effect activated in Game 7.
```

Tone should feel like broadcast/analysis, not forced memes.

---

# 28. Achievements

Achievements are important for replayability.

Possible achievements:

```txt
First Draft
Complete your first draft.

Swiss Merchant
Go 3-0 in Swiss.

Game 7 Ice
Win a playoff series 4-3.

Dynasty Builder
Draft three players from the same historical roster.

No Numbers Needed
Win a tournament with overall hidden.

Hard Mode Hero
Win a tournament on Hard.

Legacy Unlocked
Win a tournament on Hard and unlock Legacy.

Coach Diff
Win a tournament with a coach bonus activating in playoffs.

One Country Army
Win with all three players from the same country.

Against the Odds
Beat a team with 8+ higher rating.

Collector
Unlock your first special card.

Archive Hunter
Unlock 25 special cards.

Perfect Chemistry
Finish a run with Perfect chemistry.
```

Achievements should grant XP and support long-term progression.

---

# 29. Collection System

The collection works like an album.

Main categories:

```txt
Special Cards
Players
Coaches
Organizations
Moments
```

For MVP 2, focus first on Special Cards.

Collection screen should show:

```txt
Unlocked cards
Locked silhouettes
Progress count
Filters by rarity, region, player, season and card type
```

Example:

```txt
Special Cards: 12/120 unlocked
Legendary Cards: 2/20 unlocked
Mythic Cards: 0/5 unlocked
```

The collection should motivate replay without becoming a grind-heavy system.

---

# 30. Rank and Progression

The game should have a simple rank system based on XP and long-term progress.

Ranks can use Rocket League-inspired names:

```txt
Bronze
Silver
Gold
Platinum
Diamond
Champion
Grand Champion
Supersonic Legend
```

XP should come from several sources, not only tournament wins.

Possible XP sources:

```txt
Complete a run
Win Swiss matches
Qualify for playoffs
Reach semifinals
Reach final
Win tournament
Play on Hard
Play on Legacy
Play with hidden overall
Complete daily challenge
Unlock special card
Unlock achievement
```

Example XP model:

```txt
Complete run: +50 XP
Swiss win: +20 XP
Qualify for playoffs: +75 XP
Win tournament: +200 XP
Hard mode multiplier: 1.5x
Legacy multiplier: 2x
Hidden overall bonus: +25%
```

This allows players to progress even when they do not win the whole tournament.

---

# 31. Login and Save System

Long-term, the game should support login so users can save progress.

*[As built (v1.4): login shipped as **email + 6-digit code** (Supabase email OTP via
`sendEmailCode`/`verifyEmailCode`), NOT Discord — no passwords, one fewer third-party
dependency. The guest-first, LocalStorage-then-sync approach below is exactly as shipped
(`lib/profileSync.ts` merges guest progress into the cloud on first sign-in, never losing
it). Discord OAuth remains a possible LATER second option if the community wants one-click.
The "preferred/recommended" Discord text below is the original spec intent.]*

Preferred login method:

```txt
Discord OAuth
```

Recommended implementation:

```txt
Supabase Auth + Discord OAuth
```

This avoids storing user passwords directly.

The user can log in with an existing Discord account.

## MVP Approach

MVP should not require login.

Recommended setup:

```txt
Play as guest
Save progress locally with LocalStorage
Later: Login with Discord to sync progress
```

## Data to Save

```txt
User profile
XP/rank
Unlocked cards
Achievements
Run history
Daily challenge results
Settings
```

---

# 32. Daily Challenges

Daily challenges are a strong future feature.

They should use the same seed for all players on the same day.

Possible daily challenge rules:

```txt
Hidden Overall Day
SAM Only Draft
No Reroll Challenge
Old School Teams
No Special Cards
All Random Chaos
Win Without EU Players
Win With One Country
```

Daily challenges can reward:

```txt
XP
Collection progress
Achievement progress
Higher special card chance
Profile badge
```

Daily challenges should come before a permanent Challenge Mode.

Challenge Mode can be unlocked or added later to avoid competing too much with Daily Challenge.

---

# 33. Game Modes Roadmap

*[As built: Quick Draft, Daily Challenge, Regional Draft and Legacy Mode are
SHIPPED (not roadmap). The canonical Region list (NA · EU · SAM · MENA · OCE ·
APAC · SSA — note SSA) lives in `types.ts`.]*

## Classic Draft

Main mode.

```txt
3 players + coach + sub + org
Swiss + playoffs
```

## Quick Draft

Fast mode for mobile and short sessions.

```txt
3 players only
No coach, sub or org
Short bracket
```

## Daily Challenge

Daily seeded mode with special rules.

## Regional Draft

Mode based on regions.

Examples:

```txt
SAM Draft
NA Draft
EU Draft
MENA Draft
OCE Draft
APAC Draft
```

Regional Draft is preferred over Era Draft for now.

## Legacy Mode

Unlocked after winning Hard.

All-time gauntlet against historically strong teams.

---

# 34. Main App Screens

## Home

```txt
Play Classic Draft
Quick Draft
Daily Challenge
Collection
Achievements
Profile / Rank
Settings
```

## Game Setup

```txt
Difficulty selection
Overall visibility selection
Start button
```

## Draft Screen

Shows:

```txt
Random historical lineup
Available cards
Current drafted team
Rerolls remaining
Confirm selection
```

## Team Review

Shows:

```txt
Final drafted roster
Team Overall
Chemistry
Org Bonus
Special Effects
Strengths/weaknesses
Start Tournament
```

If overall is hidden, avoid revealing overalls until the results screen.

## Tournament Screen

Shows:

```txt
Swiss round results
Current record
Opponent
Series score
Playoff bracket
Simulation messages
```

## Results Screen

Shows:

```txt
Final placement
Tournament summary
Full team reveal
XP gained
Achievements
Unlocked cards
Rank progress
```

## Collection

Shows:

```txt
Unlocked cards
Locked cards
Collection progress
Filters
Card detail pages
```

## Profile

Shows:

```txt
Rank
XP
Runs completed
Championships won
Best difficulty cleared
Cards collected
Achievements
Run history
```

---

# 35. Data Structure for MVP

Before API access, use local JSON files.

Recommended files:

```txt
/data/players.json
/data/playerCards.json
/data/lineups.json
/data/orgs.json
/data/coaches.json
/data/subs.json
/data/specialCards.json
/data/achievements.json
```

## players.json

Represents real player identity.

```json
{
  "id": "zen",
  "nickname": "zen",
  "realName": "",
  "country": "France",
  "region": "EU"
}
```

## playerCards.json

Represents a specific version of a player.

```json
{
  "id": "zen-vitality-2023-base",
  "playerId": "zen",
  "nickname": "zen",
  "country": "France",
  "region": "EU",
  "orgId": "team-vitality",
  "lineupId": "vitality-rlcs-2022-23",
  "seasonId": "rlcs-2022-23",
  "overall": 96,
  "manualAdjustment": 0,
  "stats": {
    "offense": 96,
    "defense": 91,
    "mechanics": 99,
    "consistency": 93,
    "experience": 82,
    "clutch": 95
  },
  "cardType": "base",
  "rarity": "common",
  "imageUrl": ""
}
```

## lineups.json

Represents a historical team lineup.

```json
{
  "id": "vitality-rlcs-2022-23",
  "seasonId": "rlcs-2022-23",
  "orgId": "team-vitality",
  "region": "EU",
  "playerCardIds": [
    "zen-vitality-2023-base",
    "alpha54-vitality-2023-base",
    "radosin-vitality-2023-base"
  ],
  "coachId": "ferra-vitality-2023",
  "subId": "",
  "historicalStrength": "elite"
}
```

## orgs.json

```json
{
  "id": "team-vitality",
  "name": "Team Vitality",
  "region": "EU",
  "buffType": "mechanics",
  "buffLevel": "++",
  "logoUrl": ""
}
```

## coaches.json

```json
{
  "id": "ferra-vitality-2023",
  "name": "Ferra",
  "country": "France",
  "region": "EU",
  "overall": 90,
  "bonusType": "consistency",
  "bonusLevel": "++"
}
```

## specialCards.json

```json
{
  "id": "jstn-this-is-rocket-league",
  "playerId": "jstn",
  "baseCardId": "jstn-nrg-2018-base",
  "title": "This Is Rocket League",
  "cardType": "moment",
  "rarity": "mythic",
  "overall": 98,
  "stats": {
    "offense": 96,
    "defense": 88,
    "mechanics": 98,
    "consistency": 90,
    "experience": 94,
    "clutch": 99
  },
  "specialEffect": {
    "type": "clutch_boost",
    "condition": "game_5_or_game_7",
    "value": 3
  },
  "unlockCondition": "draft_and_complete_run"
}
```

*[As built: the shipped effect model is v3 `attribute_boost` /
`team_attribute_boost`; the situational `specialEffect` shape above is
legacy/back-compat. See DATA-GUIDE.]*

---

# 36. Recommended Manual MVP Dataset

Before API access, build a small hand-made dataset.

Recommended minimum:

```txt
15 historical lineups
45 player cards
10 organizations
8 coaches
5 substitutes
5 special cards
```

Better early test dataset:

```txt
30 historical lineups
90 player cards
20 organizations
15 coaches
10 substitutes
10 special cards
```

The goal is not historical completeness at first.

The goal is to test whether the game loop is fun.

---

# 37. MVP Scope

## MVP 1: Classic Draft Core

Includes:

```txt
Responsive web app
Classic Draft mode
Easy / Normal / Hard
Overall visible/hidden setting
Hard with overall locked hidden
6 roster slots
Free choice draft
Rerolls by difficulty
Pure random draft lineup pool
Overall per player-card
Simple org bonus
Simple chemistry
Swiss + simplified playoff simulation
Results screen
Manual local JSON dataset
Basic local progress
```

Does not include yet:

```txt
Discord login
Liquipedia API integration
Online rank sync
Leaderboards
Daily challenges
Regional Draft
Legacy mode
Full collection
Full achievements
```

## MVP 2: Progression and Collection

Includes:

```txt
Special cards
Collection album
Achievements
XP/rank system
Run history
More detailed results
```

## MVP 3: Account and Daily Systems

Includes:

```txt
Discord login
Supabase database
Synced progress
Daily challenge
Profile screen
```

## MVP 4: Data Expansion and Advanced Modes

Includes:

```txt
Liquipedia API integration
Larger historical database
Legacy mode
Regional Draft
More complete tournament simulation
More special cards
```

---

# 38. Personality and Messaging Tone

The game can have personality, but should avoid cringe or forced meme language.

Tone should feel closer to:

```txt
Broadcast commentary
Post-match analysis
Esports desk language
Clean game UI copy
```

Good examples:

```txt
Your team survives a five-game series.
Chemistry made the difference in a close matchup.
The lower-rated roster finds an upset.
Your team struggled to close out the series.
The coach bonus helped stabilize the run.
A special card effect activated in Game 7.
```

Avoid overusing lines like:

```txt
OMG INSANE CLUTCH BRO
WHAT A BANGER!!!
THIS IS ROCKET LEAGUEEEE
```

Specific iconic references can exist, but should be used carefully and sparingly.

---

# 39. Key Design Principles

## Keep the user-facing game simple

The player should mostly think about:

```txt
Who do I pick?
Is this card strong?
Does this fit my team?
Can this team win the tournament?
```

## Keep complexity under the hood

Internal stats, modifiers, chemistry and simulation logic can be rich, but the interface should not overwhelm the player.

## Overall remains the main signal

The player sees overall, when enabled, and should feel that it matters.

Chemistry, orgs, coaches and special effects add depth, but should not override the main strength of the cards too aggressively.

## Draft randomness must feel fair

Difficulty should not manipulate the player’s draft pool.

All difficulty manipulation happens after the draft, mainly through opponent generation and simulation weighting.

## Replayability comes from variety

Replayability should come from:

```txt
Random lineups
Different difficulties
Hidden overall
Special card drops
Achievements
Collection progress
Daily challenges
Rank progression
```

---

# 40. Decisions Locked So Far

```txt
The app is a responsive web app.
The main mode is Classic Draft.
The draft has 6 slots: 3 players, coach, sub and org.
Draft choice is free, not slot-locked by round.
Draft lineups are always randomly selected from the full available draft pool.
Difficulty does not manipulate draft lineup randomness.
Difficulty affects rerolls, overall visibility, opponents and opponent special card chance.
Hard and Legacy lock overall as hidden.
Legacy unlocks after winning on Hard.
Legacy opponents are mostly strong historical teams.
Opponent special cards: very rare on Easy, rare on Normal, moderate on Hard, moderate/high on Legacy.
Overall is per player-card, not per player.
Player and player-card are separate entities.
Stats are mostly hidden during draft.
Stats can be shown in collection/card detail.
Org buffs use simple symbols: +, ++, +++, ~.
No negative org buffs in MVP.
Chemistry uses simple relationship rules.
No era-based chemistry for now.
No 1st/2nd/3rd player roles in MVP.
No offensive/defensive/balanced team style in MVP.
Special cards are collectible.
Special cards unlock when drafted and the run is completed.
No monetization, betting or gambling mechanics.
Initial MVP can be built with local JSON before API access.
Discord login and Supabase come later.
```

---

# 41. Immediate Next Steps

Recommended next steps before coding:

```txt
1. Define the first 15-30 historical lineups for the manual dataset.
2. Define the first version of the JSON schema.
3. Create sample player cards and org/coach/sub data.
4. Define the initial Team Rating formula.
5. Define the initial simulation formula.
6. Build a no-frills functional prototype.
7. Test if the draft loop is fun before expanding the database.
8. Add visual card design after the core loop works.
9. Add collection/progression after the simulation feels good.
10. Add API/database/login only after the MVP is validated.
```

---

# 42. Project North Star

The game should feel like:

```txt
A quick, replayable Rocket League esports history draft where your knowledge of players, teams and iconic moments helps you build a roster and survive a simulated RLCS-style tournament.
```

The most important question during development:

```txt
Is this making the draft more fun, more readable or more replayable?
```

If the answer is no, the feature should wait.
