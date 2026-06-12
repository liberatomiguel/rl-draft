# RLCS Special Cards Suggestions · v3

Documento revisado para cartas especiais de jogadores e coaches do competitivo de Rocket League.

Esta versão ajusta a lógica de raridade e simplifica os efeitos para facilitar implementação no jogo.

## Regras desta versão

- `major_mvp` deve ser usado apenas para jogadores que receberam oficialmente o prêmio de MVP de Major.
- `worlds_mvp` deve ser usado apenas para jogadores que receberam oficialmente o prêmio de World Championship MVP.
- Performances históricas, gols icônicos e clips de comunidade entram como `moment`, `mythic` ou `legendary`, sem forçar título de MVP.
- Cartas de longevidade e região menor podem ficar abaixo de 90, desde que acima da carta base do jogador.
- Efeitos devem ser simples: boost direto em um ou mais atributos.
- Evitar títulos exagerados demais. Os nomes abaixo tentam ser mais diretos e reutilizáveis na interface.

## Modelo de efeito simples

```js
// Player
{ type: "attribute_boost", attributes: ["mechanics"], value: 3, description: "+3 mechanics." }

// Coach
{ type: "team_attribute_boost", attributes: ["consistency"], value: 3, description: "+3 team consistency." }
```

## Guia de overall sugerido

```txt
moment: 84-95
major_mvp: 95-98
worlds_mvp: 95-99
mythic: 92-98
legendary: 99
```

---

# Player special cards

```js
export const specialPlayerCards = [
  // Legendary legacy cards
  {
    id: "sp-kronovi-first-world-champion",
    playerId: "kronovi",
    title: "First World Champion",
    cardType: "legacy",
    rarity: "legendary",
    overall: 99,
    stats: { offense: 96, defense: 91, mechanics: 94, consistency: 97, experience: 99, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["experience", "clutch"], value: 5, description: "+5 experience and clutch." },
    flavor: "Season 1 champion with iBUYPOWER Cosmic and one of the first defining names of competitive Rocket League."
  },
  {
    id: "sp-kuxir97-pinch-god",
    playerId: "kuxir97",
    title: "Pinch God",
    cardType: "legacy",
    rarity: "legendary",
    overall: 99,
    stats: { offense: 96, defense: 94, mechanics: 99, consistency: 97, experience: 99, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "experience"], value: 5, description: "+5 mechanics and experience." },
    flavor: "A Season 2 World Champion and Worlds MVP who helped define early Rocket League mechanics before the modern meta existed."
  },
  {
    id: "sp-turbopolsa-four-time-world-champion",
    playerId: "turbopolsa",
    title: "Four-Time World Champion",
    cardType: "legacy",
    rarity: "legendary",
    overall: 99,
    stats: { offense: 95, defense: 97, mechanics: 94, consistency: 99, experience: 99, clutch: 99 },
    effect: { type: "attribute_boost", attributes: ["consistency", "clutch"], value: 5, description: "+5 consistency and clutch." },
    flavor: "Four RLCS World Championships across different teams and regions. The strongest winning résumé in the esport."
  },
  {
    id: "sp-kaydop-three-time-world-champion",
    playerId: "kaydop",
    title: "Three-Time World Champion",
    cardType: "legacy",
    rarity: "legendary",
    overall: 99,
    stats: { offense: 99, defense: 91, mechanics: 95, consistency: 98, experience: 99, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["offense", "clutch"], value: 5, description: "+5 offense and clutch." },
    flavor: "The finishing edge of the Gale Force, Dignitas and Vitality championship eras."
  },
  {
    id: "sp-zen-perfect-spring",
    playerId: "zen",
    title: "Perfect Spring",
    cardType: "legacy",
    rarity: "legendary",
    overall: 99,
    stats: { offense: 99, defense: 96, mechanics: 99, consistency: 98, experience: 94, clutch: 99 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "clutch"], value: 5, description: "+5 mechanics and clutch." },
    flavor: "Three regionals, the Spring Major and the World Championship in the same debut run. One of the cleanest peaks in RLCS history."
  },
  {
    id: "sp-monkeymoon-bds-anchor",
    playerId: "m0nkey_m00n",
    title: "BDS Anchor",
    cardType: "legacy",
    rarity: "legendary",
    overall: 99,
    stats: { offense: 96, defense: 99, mechanics: 96, consistency: 99, experience: 98, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["defense", "consistency"], value: 5, description: "+5 defense and consistency." },
    flavor: "A defining player of the open era, built on pressure, efficiency and championship-level structure."
  },
  {
    id: "sp-vatira-major-champion",
    playerId: "vatira",
    title: "Major Champion",
    cardType: "legacy",
    rarity: "legendary",
    overall: 99,
    stats: { offense: 96, defense: 99, mechanics: 97, consistency: 98, experience: 97, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["defense", "clutch"], value: 5, description: "+5 defense and clutch." },
    flavor: "One of the most complete LAN players of the open era, with elite defensive reads and multiple Major peaks."
  },

  // Official Worlds MVP cards
  {
    id: "sp-0verzero-s1-worlds-mvp",
    playerId: "0ver_zer0",
    title: "Season 1 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 95,
    stats: { offense: 93, defense: 92, mechanics: 89, consistency: 93, experience: 94, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["clutch"], value: 5, description: "+5 clutch." },
    flavor: "Season 1 World Championship MVP. A substitute story that became part of the early RLCS mythology."
  },
  {
    id: "sp-kuxir97-s2-worlds-mvp",
    playerId: "kuxir97",
    title: "Season 2 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 97,
    stats: { offense: 96, defense: 94, mechanics: 98, consistency: 96, experience: 96, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "Season 2 World Championship MVP with FlipSid3 Tactics."
  },
  {
    id: "sp-deevo-s3-worlds-mvp",
    playerId: "deevo",
    title: "Season 3 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 97,
    stats: { offense: 96, defense: 93, mechanics: 97, consistency: 94, experience: 94, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["mechanics"], value: 5, description: "+5 mechanics." },
    flavor: "Season 3 World Championship MVP. A card focused on early aerial creativity and backboard pressure."
  },
  {
    id: "sp-turbopolsa-s4-worlds-mvp",
    playerId: "turbopolsa",
    title: "Season 4 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 98,
    stats: { offense: 95, defense: 97, mechanics: 94, consistency: 98, experience: 97, clutch: 99 },
    effect: { type: "attribute_boost", attributes: ["consistency", "clutch"], value: 4, description: "+4 consistency and clutch." },
    flavor: "Season 4 World Championship MVP with Gale Force Esports."
  },
  {
    id: "sp-kaydop-s5-worlds-mvp",
    playerId: "kaydop",
    title: "Season 5 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 98,
    stats: { offense: 99, defense: 90, mechanics: 95, consistency: 98, experience: 97, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["offense", "clutch"], value: 4, description: "+4 offense and clutch." },
    flavor: "Season 5 World Championship MVP in one of the most famous Grand Finals in RLCS history."
  },
  {
    id: "sp-torment-s6-worlds-mvp",
    playerId: "torment",
    title: "Season 6 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 96,
    stats: { offense: 90, defense: 99, mechanics: 92, consistency: 97, experience: 95, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["defense", "consistency"], value: 4, description: "+4 defense and consistency." },
    flavor: "Season 6 World Championship MVP. Cloud9 had the mechanics, but Torment gave the run its defensive base."
  },
  {
    id: "sp-scrubkilla-s7-worlds-mvp",
    playerId: "scrub_killa",
    title: "Season 7 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 96,
    stats: { offense: 96, defense: 93, mechanics: 96, consistency: 94, experience: 91, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "Season 7 World Championship MVP with Renault Vitality."
  },
  {
    id: "sp-turbopolsa-s8-worlds-mvp",
    playerId: "turbopolsa",
    title: "Season 8 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 98,
    stats: { offense: 94, defense: 98, mechanics: 94, consistency: 99, experience: 99, clutch: 99 },
    effect: { type: "attribute_boost", attributes: ["experience", "clutch"], value: 4, description: "+4 experience and clutch." },
    flavor: "Season 8 World Championship MVP. The NRG title completed the four-time story."
  },
  {
    id: "sp-seikoo-2022-worlds-mvp",
    playerId: "seikoo",
    title: "2021-22 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 96,
    stats: { offense: 96, defense: 91, mechanics: 96, consistency: 94, experience: 90, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "World Championship MVP after joining Team BDS and turning a great roster into a champion."
  },
  {
    id: "sp-zen-2023-worlds-mvp",
    playerId: "zen",
    title: "2022-23 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 99,
    stats: { offense: 99, defense: 96, mechanics: 99, consistency: 98, experience: 94, clutch: 99 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "clutch"], value: 5, description: "+5 mechanics and clutch." },
    flavor: "The World Championship MVP card for the season where zen completed the perfect debut run."
  },
  {
    id: "sp-dralii-2024-worlds-mvp",
    playerId: "dralii",
    title: "2024 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 97,
    stats: { offense: 97, defense: 94, mechanics: 98, consistency: 95, experience: 91, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "offense"], value: 4, description: "+4 mechanics and offense." },
    flavor: "A World Championship MVP card for BDS's 2024 title run."
  },
  {
    id: "sp-atomic-2025-worlds-mvp",
    playerId: "atomic",
    title: "2025 World MVP",
    cardType: "mvp",
    rarity: "worlds_mvp",
    overall: 98,
    stats: { offense: 98, defense: 93, mechanics: 97, consistency: 97, experience: 96, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["offense", "consistency"], value: 4, description: "+4 offense and consistency." },
    flavor: "World Championship MVP card for NRG's 2025 title run."
  },

  // Official Major MVP cards
  {
    id: "sp-marcby8-fall-major-mvp",
    playerId: "marc_by_8",
    title: "Stockholm Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 95,
    stats: { offense: 92, defense: 95, mechanics: 93, consistency: 96, experience: 91, clutch: 94 },
    effect: { type: "attribute_boost", attributes: ["defense", "consistency"], value: 4, description: "+4 defense and consistency." },
    flavor: "RLCS 2021-22 Fall Major MVP with Team BDS."
  },
  {
    id: "sp-atomic-winter-major-mvp",
    playerId: "atomic",
    title: "LA Winter Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 96,
    stats: { offense: 96, defense: 92, mechanics: 96, consistency: 95, experience: 92, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["offense", "clutch"], value: 4, description: "+4 offense and clutch." },
    flavor: "RLCS 2021-22 Winter Major MVP with G2 Esports."
  },
  {
    id: "sp-joyo-spring-major-mvp",
    playerId: "joyo",
    title: "London Spring Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 96,
    stats: { offense: 96, defense: 89, mechanics: 98, consistency: 92, experience: 90, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "RLCS 2021-22 Spring Major MVP. This also covers the Moist/Joyo masterclass from that LAN."
  },
  {
    id: "sp-apparentlyjack-fall-major-mvp",
    playerId: "apparentlyjack",
    title: "Rotterdam Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 96,
    stats: { offense: 94, defense: 95, mechanics: 94, consistency: 97, experience: 92, clutch: 96 },
    effect: { type: "attribute_boost", attributes: ["consistency", "clutch"], value: 4, description: "+4 consistency and clutch." },
    flavor: "RLCS 2022-23 Fall Major MVP with Gen.G Mobil1 Racing."
  },
  {
    id: "sp-zen-spring-major-mvp",
    playerId: "zen",
    title: "Boston Spring Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 98,
    stats: { offense: 98, defense: 95, mechanics: 99, consistency: 97, experience: 92, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "consistency"], value: 4, description: "+4 mechanics and consistency." },
    flavor: "RLCS 2022-23 Spring Major MVP. The Major that confirmed Vitality's perfect split was real."
  },
  {
    id: "sp-itachi-copenhagen-major-mvp",
    playerId: "itachi",
    title: "Copenhagen Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 96,
    stats: { offense: 92, defense: 97, mechanics: 94, consistency: 97, experience: 94, clutch: 96 },
    effect: { type: "attribute_boost", attributes: ["defense", "consistency"], value: 4, description: "+4 defense and consistency." },
    flavor: "RLCS 2024 Major 1 MVP with Gentle Mates Alpine."
  },
  {
    id: "sp-beastmode-london-major-mvp",
    playerId: "beastmode",
    title: "London Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 97,
    stats: { offense: 98, defense: 92, mechanics: 98, consistency: 95, experience: 94, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "RLCS 2024 Major 2 MVP with G2 Stride."
  },
  {
    id: "sp-dralii-birmingham-major-mvp",
    playerId: "dralii",
    title: "Birmingham Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 97,
    stats: { offense: 97, defense: 94, mechanics: 98, consistency: 96, experience: 91, clutch: 97 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "offense"], value: 4, description: "+4 mechanics and offense." },
    flavor: "RLCS 2025 Birmingham Major MVP."
  },
  {
    id: "sp-kiileerrz-raleigh-major-mvp",
    playerId: "kiileerrz",
    title: "Raleigh Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 97,
    stats: { offense: 97, defense: 93, mechanics: 98, consistency: 95, experience: 94, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "RLCS 2025 Raleigh Major MVP. Falcons' win gave MENA its first RLCS LAN title."
  },
  {
    id: "sp-nass-boston-major-mvp",
    playerId: "nass",
    title: "Boston Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 97,
    stats: { offense: 97, defense: 93, mechanics: 98, consistency: 96, experience: 91, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "RLCS 2026 Boston Major MVP with Gentle Mates Alpine."
  },
  {
    id: "sp-vatira-paris-major-mvp",
    playerId: "vatira",
    title: "Paris Major MVP",
    cardType: "mvp",
    rarity: "major_mvp",
    overall: 98,
    stats: { offense: 96, defense: 99, mechanics: 97, consistency: 98, experience: 98, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["defense", "clutch"], value: 4, description: "+4 defense and clutch." },
    flavor: "RLCS 2026 Paris Major MVP with Karmine Corp."
  },

  // Iconic moments and historical performances
  {
    id: "sp-jstn-this-is-rocket-league",
    playerId: "jstn",
    title: "This Is Rocket League",
    cardType: "moment",
    rarity: "mythic",
    overall: 96,
    stats: { offense: 96, defense: 88, mechanics: 96, consistency: 90, experience: 94, clutch: 99 },
    effect: { type: "attribute_boost", attributes: ["clutch"], value: 5, description: "+5 clutch." },
    flavor: "Season 5 Grand Final. Zero seconds on the clock, the ball still live, and one of the most famous calls in esports history."
  },
  {
    id: "sp-squishy-ceiling-shot",
    playerId: "squishymuffinz",
    title: "Ceiling Shot",
    cardType: "moment",
    rarity: "mythic",
    overall: 95,
    stats: { offense: 94, defense: 88, mechanics: 99, consistency: 91, experience: 93, clutch: 95 },
    effect: { type: "attribute_boost", attributes: ["mechanics"], value: 5, description: "+5 mechanics." },
    flavor: "A famous early ceiling shot that became a marker for where Rocket League mechanics were heading."
  },
  {
    id: "sp-0verzero-air-dribble",
    playerId: "0ver_zer0",
    title: "Air Dribble",
    cardType: "moment",
    rarity: "moment",
    overall: 93,
    stats: { offense: 92, defense: 88, mechanics: 94, consistency: 88, experience: 92, clutch: 96 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "clutch"], value: 3, description: "+3 mechanics and clutch." },
    flavor: "A Season 1-era aerial dribble highlight from iBUYPOWER Cosmic, kept as a moment card rather than another MVP card."
  },
  {
    id: "sp-al0t-redirect",
    playerId: "al0t",
    title: "Redirect",
    cardType: "moment",
    rarity: "moment",
    overall: 91,
    stats: { offense: 93, defense: 84, mechanics: 94, consistency: 86, experience: 88, clutch: 91 },
    effect: { type: "attribute_boost", attributes: ["offense", "mechanics"], value: 3, description: "+3 offense and mechanics." },
    flavor: "A community-favorite redirect highlight. Useful as a mechanics/offense moment without inflating him into the top tier."
  },
  {
    id: "sp-zen-mr-physics",
    playerId: "zen",
    title: "Mr. Physics",
    cardType: "moment",
    rarity: "mythic",
    overall: 98,
    stats: { offense: 98, defense: 95, mechanics: 99, consistency: 97, experience: 92, clutch: 98 },
    effect: { type: "attribute_boost", attributes: ["mechanics"], value: 5, description: "+5 mechanics." },
    flavor: "A mechanics-first zen moment card, based on the community perception of his physics-defying touches and reads."
  },
  {
    id: "sp-joyo-moist-masterclass",
    playerId: "joyo",
    title: "Moist Masterclass",
    cardType: "moment",
    rarity: "mythic",
    overall: 95,
    stats: { offense: 95, defense: 88, mechanics: 98, consistency: 91, experience: 90, clutch: 96 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "offense"], value: 4, description: "+4 mechanics and offense." },
    flavor: "A separate Joyo moment card for the 2022 Spring Major run. The official MVP version is already listed above."
  },
  {
    id: "sp-yanxnz-moist-game-seven-hat-trick",
    playerId: "yanxnz",
    title: "Moist Game 7 Hat Trick",
    cardType: "moment",
    rarity: "mythic",
    overall: 97,
    stats: { offense: 97, defense: 87, mechanics: 97, consistency: 90, experience: 89, clutch: 99 },
    effect: { type: "attribute_boost", attributes: ["clutch"], value: 5, description: "+5 clutch." },
    flavor: "FURIA vs Moist at the 2021-22 World Championship. A defining SAM moment on the world stage."
  },
  {
    id: "sp-yanxnz-gamers8-champion",
    playerId: "yanxnz",
    title: "Gamers8 Champion",
    cardType: "moment",
    rarity: "mythic",
    overall: 95,
    stats: { offense: 96, defense: 85, mechanics: 97, consistency: 90, experience: 89, clutch: 96 },
    effect: { type: "attribute_boost", attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "FURIA's Gamers8 2022 win was one of the biggest international statements by a Brazilian Rocket League roster."
  },
  {
    id: "sp-fairy-peak-vitality-control",
    playerId: "fairy_peak",
    title: "Vitality Control",
    cardType: "legacy",
    rarity: "mythic",
    overall: 94,
    stats: { offense: 91, defense: 96, mechanics: 93, consistency: 97, experience: 98, clutch: 94 },
    effect: { type: "attribute_boost", attributes: ["defense", "consistency"], value: 4, description: "+4 defense and consistency." },
    flavor: "A legacy card for Fairy Peak!'s control, longevity and importance to the Vitality identity."
  },
  {
    id: "sp-firstkiller-rogue-era",
    playerId: "firstkiller",
    title: "Rogue Era",
    cardType: "moment",
    rarity: "mythic",
    overall: 94,
    stats: { offense: 96, defense: 88, mechanics: 98, consistency: 88, experience: 89, clutch: 94 },
    effect: { type: "attribute_boost", attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "A card for the early Firstkiller period, when his individual pressure could reshape entire series."
  },
  {
    id: "sp-seikoo-endpoint-breakout",
    playerId: "seikoo",
    title: "Endpoint Breakout",
    cardType: "moment",
    rarity: "mythic",
    overall: 94,
    stats: { offense: 95, defense: 88, mechanics: 96, consistency: 92, experience: 86, clutch: 94 },
    effect: { type: "attribute_boost", attributes: ["offense", "mechanics"], value: 4, description: "+4 offense and mechanics." },
    flavor: "Before the Worlds MVP card, there was the Endpoint breakout."
  },
  {
    id: "sp-trk511-mena-arrival",
    playerId: "trk511",
    title: "MENA Arrival",
    cardType: "moment",
    rarity: "mythic",
    overall: 94,
    stats: { offense: 94, defense: 91, mechanics: 96, consistency: 93, experience: 92, clutch: 95 },
    effect: { type: "attribute_boost", attributes: ["mechanics", "clutch"], value: 4, description: "+4 mechanics and clutch." },
    flavor: "A Falcons/Sandrock-era card for MENA becoming a real international contender."
  },
  {
    id: "sp-drippay-oce-breakthrough",
    playerId: "drippay",
    title: "OCE Breakthrough",
    cardType: "moment",
    rarity: "moment",
    overall: 91,
    stats: { offense: 93, defense: 85, mechanics: 91, consistency: 89, experience: 90, clutch: 94 },
    effect: { type: "attribute_boost", attributes: ["offense", "clutch"], value: 3, description: "+3 offense and clutch." },
    flavor: "A card for the first OCE era that showed the region could create LAN threats and individual stars."
  },
  {
    id: "sp-torsos-longevity",
    playerId: "torsos",
    title: "Longevity",
    cardType: "legacy",
    rarity: "moment",
    overall: 88,
    stats: { offense: 84, defense: 88, mechanics: 84, consistency: 91, experience: 96, clutch: 88 },
    effect: { type: "attribute_boost", attributes: ["experience", "consistency"], value: 3, description: "+3 experience and consistency." },
    flavor: "A long-career OCE card. Stronger than his base card, but intentionally below the global superstar tier."
  },
  {
    id: "sp-cjcj-oce-captain",
    playerId: "cjcj",
    title: "OCE Captain",
    cardType: "legacy",
    rarity: "moment",
    overall: 86,
    stats: { offense: 81, defense: 85, mechanics: 80, consistency: 89, experience: 95, clutch: 86 },
    effect: { type: "attribute_boost", attributes: ["experience", "consistency"], value: 3, description: "+3 experience and consistency." },
    flavor: "A lower-overall special card for leadership, region identity and career presence."
  },
  {
    id: "sp-chausettes-dreamhack-valencia",
    playerId: "chausette45",
    title: "Valencia Peak",
    cardType: "moment",
    rarity: "moment",
    overall: 92,
    stats: { offense: 94, defense: 89, mechanics: 94, consistency: 90, experience: 91, clutch: 94 },
    effect: { type: "attribute_boost", attributes: ["offense", "mechanics"], value: 3, description: "+3 offense and mechanics." },
    flavor: "Not an RLCS MVP card, but a strong non-RLCS LAN peak worth keeping as optional flavor."
  },
  {
    id: "sp-garrettg-longevity",
    playerId: "garrettg",
    title: "Longevity",
    cardType: "legacy",
    rarity: "mythic",
    overall: 95,
    stats: { offense: 93, defense: 93, mechanics: 92, consistency: 99, experience: 99, clutch: 94 },
    effect: { type: "attribute_boost", attributes: ["experience", "consistency"], value: 4, description: "+4 experience and consistency." },
    flavor: "A career legacy card for one of the defining names of North American Rocket League."
  }
];
```

---

# Coach special cards

```js
export const specialCoachCards = [
  {
    id: "sp-coach-ferra-perfect-vitality",
    coachId: "ferra",
    title: "Perfect Vitality",
    cardType: "coach",
    rarity: "legendary",
    overall: 99,
    stats: { tactics: 98, adaptation: 97, mentality: 99, development: 96, experience: 98, clutch: 98 },
    effect: { type: "team_attribute_boost", attributes: ["consistency", "clutch"], value: 5, description: "+5 team consistency and clutch." },
    flavor: "Vitality's 2023 run gives Ferra the premium coach card."
  },
  {
    id: "sp-coach-stl-gamers8-furia",
    coachId: "stl",
    title: "Gamers8 FURIA",
    cardType: "coach",
    rarity: "mythic",
    overall: 94,
    stats: { tactics: 92, adaptation: 94, mentality: 96, development: 91, experience: 90, clutch: 96 },
    effect: { type: "team_attribute_boost", attributes: ["offense", "clutch"], value: 4, description: "+4 team offense and clutch." },
    flavor: "FURIA's Gamers8 2022 title was a landmark for Brazilian Rocket League. STL gets a coach card for that run."
  },
  {
    id: "sp-coach-satthew-na-superteam",
    coachId: "satthew",
    title: "NA Superteam",
    cardType: "coach",
    rarity: "mythic",
    overall: 95,
    stats: { tactics: 94, adaptation: 93, mentality: 96, development: 92, experience: 96, clutch: 95 },
    effect: { type: "team_attribute_boost", attributes: ["consistency"], value: 4, description: "+4 team consistency." },
    flavor: "A coach card for managing elite NA rosters and keeping high-talent lineups stable."
  },
  {
    id: "sp-coach-mew-bds-worlds",
    coachId: "mew",
    title: "BDS Reset",
    cardType: "coach",
    rarity: "mythic",
    overall: 94,
    stats: { tactics: 95, adaptation: 95, mentality: 94, development: 91, experience: 93, clutch: 94 },
    effect: { type: "team_attribute_boost", attributes: ["defense", "consistency"], value: 4, description: "+4 team defense and consistency." },
    flavor: "A BDS Worlds preparation card focused on structure and bracket adaptation."
  },
  {
    id: "sp-coach-sizz-nrg-madrid",
    coachId: "sizz",
    title: "Madrid NRG",
    cardType: "coach",
    rarity: "moment",
    overall: 91,
    stats: { tactics: 89, adaptation: 90, mentality: 95, development: 88, experience: 93, clutch: 94 },
    effect: { type: "team_attribute_boost", attributes: ["clutch"], value: 3, description: "+3 team clutch." },
    flavor: "NRG's Season 8 title run earns Sizz a mentality-focused coach card."
  },
  {
    id: "sp-coach-eversax-kc-structure",
    coachId: "eversax",
    title: "Karmine Structure",
    cardType: "coach",
    rarity: "mythic",
    overall: 94,
    stats: { tactics: 96, adaptation: 94, mentality: 94, development: 93, experience: 92, clutch: 93 },
    effect: { type: "team_attribute_boost", attributes: ["defense", "consistency"], value: 4, description: "+4 team defense and consistency." },
    flavor: "A Karmine Corp structure card built around controlling elite attacking talent."
  },
  {
    id: "sp-coach-snaski-gentle-mates",
    coachId: "snaski",
    title: "Gentle Mates",
    cardType: "coach",
    rarity: "moment",
    overall: 91,
    stats: { tactics: 92, adaptation: 91, mentality: 93, development: 90, experience: 94, clutch: 92 },
    effect: { type: "team_attribute_boost", attributes: ["consistency"], value: 3, description: "+3 team consistency." },
    flavor: "A fundamentals-focused coach card for Gentle Mates' LAN structure."
  }
];
```

---

# Cards adjusted, downgraded or removed from v2

```txt
Adjusted:
- Joyo Spring Major: kept as official Major MVP and added a separate Moist Masterclass moment.
- zen: kept Legendary/Worlds/Major MVP cards, added Mr. Physics as a mechanics-focused mythic moment.
- yanxnz: kept as mythic/moment, not MVP.
- Torsos: added as 88 overall longevity card, below 90 by design.
- CJCJ: added as 86 overall OCE leadership card.
- 0ver Zer0: kept official Worlds MVP card and added separate Air Dribble moment.
- al0t: added as lower-overall redirect moment.

Simplified:
- All effects are now direct attribute boosts.
- Removed conditional effects like boosts after Game 7, Grand Finals, lower seed, single elimination, etc.

Removed/de-emphasized:
- Titles like "Open Era GOAT", "Major King", "Proto-Meta Maestro", "Dynasty Finisher" were replaced by more direct names.
- Season-award cards like ExoTiiK 2024 Season MVP and BeastMode 2025 Season MVP should only return if you create a separate `season_award` rarity/type.
```

---

# Suggested implementation notes

```txt
Recommended pack/draft behavior:
- Legendary: very rare, but not impossible to find.
- Worlds MVP: rare
- Major MVP: rare, slightly more common than Worlds MVP
- Mythic: uncommon-rare
- Moment: uncommon, can appear earlier for variety
- Coach specials: separate low-frequency pool
```

