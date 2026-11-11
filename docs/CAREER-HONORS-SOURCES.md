# Career title ledger — historical cutoff

Verified 10 November 2026 for rc.40. The career starts at **RLCS X**:
only completed RLCS World Championships before that season seed the table.
RLCS Majors were introduced with X, so the opening Major count is zero.
DreamHack, ELEAGUE, regional championships and other LANs are not RLCS Majors.
Season 9's Worlds was cancelled and contributes no title.

| Worlds | Organization at the event | Players who played the championship |
|---|---|---|
| S1 | iBUYPOWER Cosmic | Kronovi, Lachinio, 0ver Zer0 |
| S2 | FlipSid3 Tactics | kuxir97, Markydooda, gReazymeister |
| S3 | Northern Gaming | Remkoe, Deevo, Turbopolsa |
| S4 | Gale Force eSports | Kaydop, ViolentPanda, Turbopolsa |
| S5 | Dignitas | Kaydop, ViolentPanda, Turbopolsa |
| S6 | Cloud9 | SquishyMuffinz, Gimmick, Torment |
| S7 | Renault Vitality | Kaydop, Fairy Peak!, Scrub Killa |
| S8 | NRG | GarrettG, jstn., Turbopolsa |

Primary references:

- [S1 champions and roster, Guinness](https://www.guinnessworldrecords.com/world-records/457523-first-rocket-league-world-champions)
- [S2 roster, Psyonix](https://www.rocketleague.com/news/rlcs-s2-regional-championships-recap?lang=it) and [S2 championship outcome, Guinness](https://www.guinnessworldrecords.com/world-records/457383-longest-single-pro-game-of-rocket-league)
- [S3 championship, Psyonix](https://www.rocketleague.com/news/northern-gaming-rlcs-season-3-champions?lang=en)
- [S4 championship, Psyonix](https://www.rocketleague.com/news/gale-force-esports-crowned-rlcs-season-4-world-champions-/) and [Gale Force roster, Psyonix](https://www.rocketleague.com/news/flipsid3-tactics-wins-dreamhack-summer-championship?lang=en)
- [S5 championship, Psyonix](https://www.rocketleague.com/news/team-dignitas-wins--landon-world-championship?lang=es-mx)
- [S6 championship, Psyonix](https://www.rocketleague.com/news/cloud9-brings--lanvegas-world-championship-home-)
- [S7 championship, Psyonix](https://www.rocketleague.com/news/presenting-your-rlcs-season-7-world-champions-)
- [NRG confirms its S8-winning trio](https://www.nrg.gg/blogs/news/world-championship-edition)
- [Season 9 cancellation, Psyonix](https://www.rocketleague.com/news/introducing-the-rocket-league-spring-series?lang=de)
- [Introduction of RLCS X and Majors, Psyonix](https://www.rocketleague.com/news/announcing-rlcs-x)

The roster list was cross-checked against [RLCS performance records](https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Performances).
The baseline has eight organization titles and 24 player title credits.
Turbopolsa has four; Kaydop three; ViolentPanda two. Gale Force's title is
credited to Gale Force, not retroactively moved to Dignitas.

`historicalHonors.ts` is a curated separate catalog; generated dataset JSON
is untouched. New careers append an event-keyed winning roster at settlement,
before transfers or season rollover. Repeated settlement is idempotent.
Existing saves keep known organization results and the user's lifetime counts;
missing past individual rosters are never reconstructed from today's squads.
Their table explicitly states that individual recording starts at this update.

## Regional champions before RLCS X (research, not wired)

Researched 11 November 2026 (session G2) for the title race. Data file:
`docs/handoff-2.0/G2-regionais.json`. Nothing in the game reads it yet.

Confirmed on the Liquipedia page itself (wikitext read through the MediaWiki
API; grand-final block, not cross-checked against the prize table):

| Season | Region | Champion | Runner-up | Source |
|---|---|---|---|---|
| S2 | EU | FlipSid3 Tactics | Northern Gaming | [Liquipedia](https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_2/Europe) |
| S3 | EU | Mock-It eSports EU | FlipSid3 Tactics | [Liquipedia](https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_3/Europe) |
| S4 | EU | Gale Force eSports | Method | [Liquipedia](https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_4/Europe) |
| S5 | EU | Gale Force eSports | Renault Vitality | [Liquipedia](https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_5/Europe) |
| S6 | EU | Team Dignitas | We Dem Girlz | [Liquipedia](https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_6/Europe) |
| S7 | EU | Renault Vitality | FC Barcelona | [Liquipedia](https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_7/Europe) |
| S8 | EU | Team Reciprocity | Renault Vitality | [Liquipedia](https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_8/Europe) |
| S9 | EU | Dignitas | Renault Vitality | [Liquipedia](https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_9/Europe) |

Not confirmed, and therefore left out of the usable list: EU Season 1 (two
qualifiers), every North American season (S1–S9), Oceania (S3–S9) and South
America (S7–S9). Liquipedia rate-limited the research machine before those
pages could be opened; the names seen in search snippets are kept in the
file's `unconfirmed` block with the page to open for each. No official
rocketleague.com article was read (403). Liquipedia's API terms ask for one
`action=parse` request about every 30 seconds.
