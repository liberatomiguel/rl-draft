/**
 * Road to Worlds — scripted historical beats (hand-maintained, like
 * specialCards.json). EN/PT co-located by design (DESIGN-DECISIONS pending
 * entry: beat CONTENT lives with its trigger data; UI chrome stays in copy.*).
 *
 * Beats are the "history gravity" narrative layer: real RLCS moments fire at
 * their real timing, adapted to the sim. Rules (design §10):
 *  - A beat fires at most once per career (store tracks firedBeatIds).
 *  - `forceTransfer` executes BEFORE the window's anchor pass; it never
 *    touches the user squad — if the user owns the target, the beat degrades
 *    to a Blockbuster incoming offer (degradeToOffer) or a preempted headline.
 *  - Champions are NEVER asserted — the sim decides results; beats cover
 *    entries, signings and narratives only.
 */

export interface CareerBeat {
  id: string;
  trigger: { seasonIndex: number; week: number };
  /** Only fires if the player is NOT on the user squad (else degrade/preempt). */
  requiresPlayerFree?: string;
  effect?: { forceTransfer: { playerId: string; toOrgRef: string } };
  /** When the user owns the target: turn into a Blockbuster bid instead. */
  degradeToOffer?: boolean;
  en: { title: string; body: string };
  pt: { title: string; body: string };
  /** Shown when the beat was preempted by the user owning the target. */
  preemptedEn?: string;
  preemptedPt?: string;
}

export const CAREER_BEATS: CareerBeat[] = [
  // ----- Season X (2020-21) — seasonIndex 0 -----
  {
    id: "sx-format",
    trigger: { seasonIndex: 0, week: 1 },
    en: {
      title: "A new era: splits, regionals, Majors",
      body: "The circuit reshapes around three splits of regional play, each crowned by an international Major — and in this timeline, nothing grounds the planes. The road to the World Championship starts now.",
    },
    pt: {
      title: "Uma nova era: splits, regionais, Majors",
      body: "O circuito se reorganiza em três splits de disputa regional, cada um coroado por um Major internacional — e nesta linha do tempo, nada segura os aviões. A estrada para o Mundial começa agora.",
    },
  },
  {
    id: "sx-bds-rise",
    trigger: { seasonIndex: 0, week: 5 },
    en: {
      title: "That BDS roster is turning heads",
      body: "Scrim results leak, and the numbers coming out of Team BDS's block are absurd. Europe may have a new benchmark.",
    },
    pt: {
      title: "Aquele elenco da BDS está chamando atenção",
      body: "Resultados de scrim vazam, e os números do bloco da Team BDS são absurdos. A Europa pode ter uma nova régua.",
    },
  },
  {
    id: "sx-na-guard",
    trigger: { seasonIndex: 0, week: 13 },
    en: {
      title: "NA's old guard isn't done",
      body: "NRG and Spacestation keep trading blows at the top of North America. Every regional final feels like a grudge match.",
    },
    pt: {
      title: "A velha guarda da NA não acabou",
      body: "NRG e Spacestation seguem trocando golpes no topo da América do Norte. Toda final de regional parece revanche.",
    },
  },
  {
    id: "sx-sam-hungry",
    trigger: { seasonIndex: 0, week: 23 },
    en: {
      title: "South America wants a seat at the table",
      body: "The SAM region keeps punching up in every international appearance. The talent is there — the world is starting to notice.",
    },
    pt: {
      title: "A América do Sul quer um lugar à mesa",
      body: "A região SAM segue surpreendendo em toda aparição internacional. O talento existe — o mundo está começando a notar.",
    },
  },

  // ----- RLCS 2021-22 — seasonIndex 1 -----
  {
    id: "s1-faze-enters",
    trigger: { seasonIndex: 1, week: 1 },
    requiresPlayerFree: "firstkiller",
    effect: { forceTransfer: { playerId: "firstkiller", toOrgRef: "faze-clan" } },
    degradeToOffer: true,
    en: {
      title: "FaZe Clan enters Rocket League",
      body: "One of the biggest brands in esports steps into the scene, building around Firstkiller's ceiling. NA's power map just got redrawn.",
    },
    pt: {
      title: "FaZe Clan entra no Rocket League",
      body: "Uma das maiores marcas do esport entra na cena, construindo em torno do teto de Firstkiller. O mapa de poder da NA acaba de ser redesenhado.",
    },
    preemptedEn: "FaZe Clan enters Rocket League — their first-choice star was already under contract elsewhere.",
    preemptedPt: "FaZe Clan entra no Rocket League — a primeira opção de estrela já tinha contrato em outro lugar.",
  },
  {
    id: "s1-kc-enters",
    trigger: { seasonIndex: 1, week: 2 },
    en: {
      title: "Karmine Corp arrives with the blue wall",
      body: "The French organization brings its famously loud fanbase into Rocket League. Europe's crowds will never sound the same.",
    },
    pt: {
      title: "Karmine Corp chega com a muralha azul",
      body: "A organização francesa traz sua torcida famosamente barulhenta para o Rocket League. As arquibancadas da Europa nunca mais soarão iguais.",
    },
  },
  {
    id: "s1-lan-back",
    trigger: { seasonIndex: 1, week: 10 },
    en: {
      title: "The roar is back",
      body: "International LANs in full arenas again. Players who grinded through online seasons finally hear the crowd.",
    },
    pt: {
      title: "O rugido voltou",
      body: "LANs internacionais com arenas cheias de novo. Jogadores que passaram temporadas no online finalmente ouvem a torcida.",
    },
  },
  {
    id: "s1-mena-rising",
    trigger: { seasonIndex: 1, week: 15 },
    en: {
      title: "Don't sleep on MENA",
      body: "The Middle East servers are producing mechanical monsters at an alarming rate. Scouts are booking flights.",
    },
    pt: {
      title: "Não durmam no MENA",
      body: "Os servidores do Oriente Médio estão produzindo monstros mecânicos em ritmo alarmante. Os olheiros já compram passagens.",
    },
  },

  // ----- RLCS 2022-23 — seasonIndex 2 -----
  {
    id: "s2-moist-enters",
    trigger: { seasonIndex: 2, week: 1 },
    requiresPlayerFree: "vatira",
    effect: { forceTransfer: { playerId: "vatira", toOrgRef: "moist-esports" } },
    degradeToOffer: true,
    en: {
      title: "Moist Esports backs the UK core",
      body: "The creator-owned org bets on a young British-French core with Vatira as the headline. Nobody laughs at the name after the first bracket run.",
    },
    pt: {
      title: "Moist Esports banca o núcleo do Reino Unido",
      body: "A org de creators aposta num núcleo jovem anglo-francês com Vatira como manchete. Ninguém ri do nome depois da primeira campanha no chaveamento.",
    },
    preemptedEn: "Moist Esports enters Rocket League — their headline target was already off the market.",
    preemptedPt: "Moist Esports entra no Rocket League — o alvo principal já estava fora do mercado.",
  },
  {
    id: "s2-geng-enters",
    trigger: { seasonIndex: 2, week: 2 },
    en: {
      title: "Gen.G Mobil1 Racing joins the grid",
      body: "A global brand with racing money enters NA. The offseason market just got more expensive for everyone.",
    },
    pt: {
      title: "Gen.G Mobil1 Racing entra no grid",
      body: "Uma marca global com dinheiro de automobilismo chega à NA. O mercado da offseason acaba de ficar mais caro para todo mundo.",
    },
  },
  {
    id: "s2-zen-whispers",
    trigger: { seasonIndex: 2, week: 13 },
    en: {
      title: "Who is this kid in EU ranked?",
      body: "A teenager keeps deleting pros in high-elo lobbies. He's too young for the league — for now. Every big org already has the name written down: zen.",
    },
    pt: {
      title: "Quem é esse garoto no ranked da EU?",
      body: "Um adolescente segue destruindo profissionais nas lobbies de elo alto. Ele é jovem demais para a liga — por enquanto. Toda org grande já anotou o nome: zen.",
    },
  },
  {
    id: "s2-falcons-project",
    trigger: { seasonIndex: 2, week: 21 },
    en: {
      title: "Team Falcons are building something",
      body: "The Saudi organization is assembling MENA's best pieces with clear intent. The region's first superteam is taking shape.",
    },
    pt: {
      title: "O Team Falcons está construindo algo",
      body: "A organização saudita está juntando as melhores peças do MENA com intenção clara. O primeiro superteam da região está tomando forma.",
    },
  },

  // ----- RLCS 2024 — seasonIndex 3 -----
  {
    id: "s3-vitality-zen",
    trigger: { seasonIndex: 3, week: 1 },
    requiresPlayerFree: "zen",
    effect: { forceTransfer: { playerId: "zen", toOrgRef: "team-vitality" } },
    degradeToOffer: true,
    en: {
      title: "Vitality sign zen — the wait is over",
      body: "The prodigy everyone tracked through ranked lobbies is finally of age, and Vitality didn't hesitate. The most hyped debut in RLCS history is set.",
    },
    pt: {
      title: "Vitality contrata zen — a espera acabou",
      body: "O prodígio que todos acompanhavam nas lobbies de ranked finalmente tem idade, e a Vitality não hesitou. A estreia mais aguardada da história da RLCS está marcada.",
    },
    preemptedEn: "Vitality's long pursuit of zen ends at your door — the prodigy already wears your colors.",
    preemptedPt: "A longa perseguição da Vitality por zen termina na sua porta — o prodígio já veste as suas cores.",
  },
  {
    id: "s3-vatira-kc",
    trigger: { seasonIndex: 3, week: 2 },
    requiresPlayerFree: "vatira",
    effect: { forceTransfer: { playerId: "vatira", toOrgRef: "karmine-corp" } },
    degradeToOffer: true,
    en: {
      title: "Karmine Corp land Vatira",
      body: "The blue wall gets its superstar. France's loudest crowd now has France's most electric player to scream for.",
    },
    pt: {
      title: "Karmine Corp fecha com Vatira",
      body: "A muralha azul ganha sua superestrela. A torcida mais barulhenta da França agora tem o jogador mais elétrico da França para gritar.",
    },
    preemptedEn: "Karmine Corp's superstar hunt comes up empty — the player they wanted answers to you.",
    preemptedPt: "A caçada da Karmine Corp por uma superestrela volta vazia — o jogador que eles queriam responde a você.",
  },
  {
    id: "s3-prodigy-era",
    trigger: { seasonIndex: 3, week: 13 },
    en: {
      title: "The teenagers are taking over",
      body: "Half the scene's hottest names can't legally rent a car. The average age of a title contender keeps dropping — this game belongs to the kids.",
    },
    pt: {
      title: "Os adolescentes estão dominando",
      body: "Metade dos nomes mais quentes da cena não pode nem alugar um carro. A idade média de um candidato a título só cai — este jogo é das crianças.",
    },
  },
  {
    id: "s3-ssa-apac",
    trigger: { seasonIndex: 3, week: 21 },
    en: {
      title: "The world keeps getting wider",
      body: "Sub-Saharan Africa and APAC keep closing the gap on the traditional regions. Wildcard runs aren't miracles anymore — they're warnings.",
    },
    pt: {
      title: "O mundo continua ficando maior",
      body: "A África Subsaariana e a APAC seguem fechando a distância para as regiões tradicionais. Campanhas de zebra já não são milagre — são aviso.",
    },
  },

  // ----- RLCS 2025 — seasonIndex 4 -----
  {
    id: "s4-money-era",
    trigger: { seasonIndex: 4, week: 1 },
    en: {
      title: "Salaries are exploding",
      body: "Agents confirm what everyone suspected: top-line contracts have doubled in two seasons. Keeping a championship core together has never cost more.",
    },
    pt: {
      title: "Os salários estão explodindo",
      body: "Agentes confirmam o que todos suspeitavam: os contratos de elite dobraram em duas temporadas. Manter um núcleo campeão junto nunca custou tanto.",
    },
  },
  {
    id: "s4-old-guard",
    trigger: { seasonIndex: 4, week: 13 },
    en: {
      title: "The last of the old guard",
      body: "A handful of Season-X-era names are still competing at the top against players seven years younger. Every series they win feels like history refusing to end.",
    },
    pt: {
      title: "Os últimos da velha guarda",
      body: "Um punhado de nomes da era Season X ainda compete no topo contra jogadores sete anos mais novos. Cada série que vencem parece a história se recusando a acabar.",
    },
  },
  {
    id: "s4-sam-worlds",
    trigger: { seasonIndex: 4, week: 23 },
    en: {
      title: "SAM's golden generation peaks",
      body: "Furia and the Brazilian scene have turned 'dark horse' into an insult. Nobody wants them in their bracket anymore.",
    },
    pt: {
      title: "A geração de ouro da SAM no auge",
      body: "A Furia e a cena brasileira transformaram 'zebra' em ofensa. Ninguém mais quer encontrá-los no chaveamento.",
    },
  },

  // ----- RLCS 2026 — seasonIndex 5 -----
  {
    id: "s5-final-season",
    trigger: { seasonIndex: 5, week: 1 },
    en: {
      title: "2026: everything on the line",
      body: "Contracts, legacies, eras — this season settles all of it. The desk agrees on exactly one thing: nobody is safe.",
    },
    pt: {
      title: "2026: tudo em jogo",
      body: "Contratos, legados, eras — esta temporada resolve tudo. A bancada concorda em exatamente uma coisa: ninguém está seguro.",
    },
  },
  {
    id: "s5-next-gen",
    trigger: { seasonIndex: 5, week: 13 },
    en: {
      title: "The next generation is already here",
      body: "Rookies who grew up watching Worlds finals are now playing in them. The cycle spins faster every year.",
    },
    pt: {
      title: "A próxima geração já chegou",
      body: "Novatos que cresceram assistindo às finais do Worlds agora as disputam. O ciclo gira mais rápido a cada ano.",
    },
  },
  {
    id: "s5-legacy-talk",
    trigger: { seasonIndex: 5, week: 27 },
    en: {
      title: "Legacy talk season",
      body: "With Worlds approaching, the debates begin: greatest roster, greatest region, greatest era. One trophy ends every argument.",
    },
    pt: {
      title: "Temporada de papo de legado",
      body: "Com o Worlds se aproximando, começam os debates: maior elenco, maior região, maior era. Um troféu encerra qualquer discussão.",
    },
  },
];
