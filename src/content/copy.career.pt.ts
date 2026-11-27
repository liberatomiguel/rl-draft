/**
 * Road to Worlds — copy PT-BR (modo carreira).
 *
 * Espelho exato de copy.career.en.ts (paridade de chaves garantida pelo tipo).
 * Lido SÓ pelo código da carreira via `careerCopy.ts` (fora do dicionário
 * principal, para não pesar nas páginas do draft).
 * Tom: bancada de transmissão / análise pós-jogo. Termos canônicos da cena
 * (Split, Major, Worlds, OVR, Swiss) ficam em inglês.
 */

import { noticeRows, type CareerCopy, type MoneyNoticeText } from "./copy.career.en";
import { CAREER_FEED_PT } from "./copy.career.feed.pt"; // v2.3 FEED

import { CAREER_LOCKER_PT } from "./copy.career.locker.pt"; // v2.3 LOCKER

/** v2.2 ENDLESS: as cidades-sede que uma temporada sorteia para os Majors e o Worlds (o save guarda os índices). */
/** v2.2 board front: a board objective's chance, in words (CAREER_BOARD.bands sets the cut points). */
const BOARD_BANDS_PT: Record<string, string> = { expected: "Provável", reach: "Ao alcance", stretch: "Um desafio", longShot: "Muito difícil" };

const ENDLESS_HOSTS_PT = [
  "Londres", "Paris", "Copenhague", "Estocolmo", "Boston", "Dallas",
  "Los Angeles", "São Paulo", "Riad", "Sydney", "Tóquio", "Madri",
] as const;
const hostPt = (i: string | number | undefined): string => ENDLESS_HOSTS_PT[Number(i)] ?? "";
/** v2.2 ENDLESS: "A", "A e B", "A, B e C". */
/** v2.2 ENDLESS: o kit de um projeto rival, o mesmo do clube do manager (chaves: engine/career/endless KIT_ORDER). */
const ENDLESS_KIT_PT: Record<string, string> = {
  facilities: "um centro de performance",
  coach: "o melhor coach da região",
  bench: "um reserva no banco",
  bootcamp: "um bootcamp",
  psychologist: "um psicólogo",
};
const joinPt = (xs: string[]): string => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);
const kitPt = (kit: string | number | undefined): string => joinPt(String(kit ?? "").split(",").filter(Boolean).map((k) => ENDLESS_KIT_PT[k] ?? k));
const listPt = (p: Record<string, string | number>): string => {
  const xs = [p.p1, p.p2, p.p3].filter((x) => x !== undefined && x !== "").map(String);
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
};

/** rc.33 review: quanto tempo o parceiro de resgate paga (rc.34: o investidor, CAREER_LOAN.investor.weeks, recebido) — nada quando não se sabe. */
const partnerRunPt = (weeks?: string | number): string => (Number(weeks) > 0 ? ` por ${weeks} semanas` : "");

/**
 * HISTÓRICO (rc.32–rc.33): o que a próxima quebra fazia com o Investidor de
 * emergência — só os e-mails `backerIn` (rc.33) e `restructured` (rc.32)
 * que um save antigo ainda guarda leem isto, com o texto de quando saíram.
 */
const legacyNextBreachPt = (
  next: string | number | undefined,
  partner?: string | number,
  partnerWeeks?: string | number,
): string =>
  next === "insolvent"
    ? "A próxima quebra do piso encerra a carreira."
    : next === "restructure"
      ? ""
      : Number(partner)
        ? `Abaixo do piso numa segunda-feira, o Investidor de emergência entra, e um parceiro de resgate reforça a receita${partnerRunPt(partnerWeeks)}.`
        : "Abaixo do piso numa segunda-feira, o Investidor de emergência entra.";

/**
 * rc.34 (Miguel, 31/10): o que a próxima segunda abaixo do piso faz, a
 * partir do `nextBreachParamsOf` do fluxo — `next` ("rescue" ou
 * "insolvent"), `owing` (há empréstimo aberto: o banco soma a ele, o prazo
 * fica), `nextPartner` / `partnerRun` (o investidor entra no primeiro),
 * `term` (semanas para quitar um empréstimo novo; 0 = sem prazo),
 * `topUpsLeft` (-1 = sem limite) e, rc.34 review, `loansLeft` (empréstimos
 * novos que a carreira ainda tem, CAREER_LOAN.emergency.maxLoans; -1 = sem
 * limite). E-mails antigos só passam `next`.
 */
const nextBreachPt = (p: Record<string, string | number | undefined>): string => {
  if (p.next === "insolvent") {
    if (Number(p.owing) && Number(p.topUpsLeft) === 0)
      return "O banco não vai somar mais nada ao empréstimo: a próxima quebra do piso encerra a carreira.";
    if (!Number(p.owing) && Number(p.loansLeft) === 0)
      return "O banco não abre outro empréstimo emergencial: a próxima quebra do piso encerra a carreira.";
    return "A próxima quebra do piso encerra a carreira.";
  }
  if (p.next === "restructure") return "";
  if (Number(p.owing)) {
    const left = Number(p.topUpsLeft);
    return `Abaixo do piso de novo antes de quitar, o banco soma ao empréstimo: o prazo continua o mesmo${left > 0 ? ` (ele faz isso mais ${left === 1 ? "uma vez" : `${left} vezes`})` : ""}.`;
  }
  const term = Number(p.term) > 0 ? `, para quitar em até ${p.term} semanas` : "";
  const last = Number(p.loansLeft) === 1 ? ": o último que ele abre nesta carreira" : "";
  return Number(p.nextPartner)
    ? `Abaixo do piso numa segunda-feira, o banco abre um empréstimo emergencial${term}${last}, e um investidor reforça um pouco a receita${partnerRunPt(p.partnerRun)}.`
    : `Abaixo do piso numa segunda-feira, o banco abre um empréstimo emergencial${term}${last}.`;
};

/**
 * rc.34 review: os empréstimos emergenciais que a carreira ainda tem depois
 * que este for quitado (`loansLeft` do nextBreachParamsOf, lido com um em
 * aberto) — a linha do aviso e o e-mail do banco. Vazio sem limite (-1).
 */
const loansLeftPt = (p: Record<string, string | number | undefined>): string => {
  const left = Number(p.loansLeft);
  if (p.loansLeft === undefined || left < 0) return "";
  return left === 0
    ? "É o último empréstimo emergencial que o banco abre nesta carreira: depois de quitado, a próxima quebra do piso encerra a carreira."
    : `Depois de quitado, o banco abre no máximo mais ${left === 1 ? "um" : left} nesta carreira.`;
};

/** rc.34: uma segunda-feira do empréstimo emergencial como os e-mails do banco a citam (desta temporada, da próxima ou de N à frente). */
const mondayWhenPt = (week: string | number | undefined, ahead: string | number | undefined): string => {
  const a = Number(ahead) || 0;
  return a <= 0
    ? `a segunda-feira da semana ${week}`
    : a === 1
      ? `a segunda-feira da semana ${week} da próxima temporada`
      : `a segunda-feira da semana ${week}, daqui a ${a} temporadas`;
};

/**
 * rc.34: o que acontece na segunda do prazo — uma frase que todo e-mail e
 * aviso do empréstimo repete. rc.34 review: a regra do banco é a do "Quitar
 * tudo" (economy.canSettleLoan): cobra desde que as contas fiquem no piso ou
 * acima dele depois do pagamento — o cheque especial conta.
 */
const deadlineRulePt =
  "Nessa segunda o banco cobra o que é devido, desde que as contas fiquem no piso ou acima dele depois do pagamento; se não ficarem, a carreira acaba.";

/**
 * rc.34 review: o que fecha a diferença até o prazo — dinheiro novo (uma
 * venda, um prêmio: cada um paga a sua parte e o resto fica no caixa) ou um
 * gasto menor. Um pagamento parcial em Finanças só move dinheiro do saldo
 * para a dívida; "Quitar tudo" encerra o empréstimo no dia em que as contas
 * aguentarem.
 */
const gapWaysPt = (p: Record<string, string | number | undefined>): string =>
  `O que fecha a diferença é dinheiro novo ou um gasto menor: uma boa proposta por um jogador (${p.salePct}% da taxa paga o empréstimo, o resto fica no caixa), premiação (${p.garnishPct}% de cada prêmio paga a dívida), uma folha mais leve. Um pagamento parcial em Finanças só move dinheiro do saldo para a dívida; "Quitar tudo" encerra o empréstimo no dia em que as contas aguentarem.`;

/** rc.34 review: a projeção que os e-mails e avisos do prazo citam ("neste ritmo"). */
const onPacePt = (p: Record<string, string | number | undefined>): string =>
  Number(p.covered)
    ? `Neste ritmo (${p.net} por semana) as contas cobrem a dívida no dia: o saldo estaria em ${p.projected} na segunda do prazo. Mantenha assim, ou encerre agora com "Quitar tudo" em Finanças.`
    : `Neste ritmo (${p.net} por semana) as contas não cobrem a dívida: o saldo estaria em ${p.projected} na segunda do prazo, ${p.gap} abaixo do que o banco precisa.`;

/** rc.34 review: uma contagem pequena por extenso para o tópico de dinheiro do assistente (dígitos depois de cinco). */
const countWordPt = (n: number): string => ["zero", "um", "dois", "três", "quatro", "cinco"][n] ?? String(n);

/**
 * rc.33 review: um parâmetro de dinheiro chega formatado ("$1,540",
 * MONEY_PARAM_KEYS de news/newsText) — `Number()` dele é NaN. Verdadeiro
 * para um valor positivo, formatado ou não.
 */
const positive = (v: string | number | undefined): boolean =>
  typeof v === "number" ? v > 0 : typeof v === "string" && /[1-9]/.test(v) && !v.trim().startsWith("-");

/** rc.32 (M4): a quebra projetada, como os alertas a citam (semana desta temporada ou da próxima). */
const breachWhenPt = (p: Record<string, string | number>): string =>
  `a segunda-feira da semana ${p.breachWeek}${Number(p.nextSeason) ? " da próxima temporada" : ""}`;

/** rc.33 (ECO-07): o último pagamento do parceiro de resgate, como o e-mail do resgate o cita. */
const partnerUntilPt = (p: Record<string, string | number>): string =>
  `a segunda-feira da semana ${p.partnerUntilWeek}${Number(p.partnerNextSeason) ? " da próxima temporada" : ""}`;

/** rc.33 (UX-07, ECO-08): "primeira", "segunda"… para a linha de dinheiro do assistente e o e-mail do resgate (qualquer número). */
const ordinalPt = (n: number): string => ["primeira", "segunda", "terceira", "quarta", "quinta"][n - 1] ?? `${n}ª`;

/**
 * rc.34 (ECO-04): uma meta de patrocínio em palavras — tipo, quantidade,
 * colocação e split (sponsorDeals.SponsorGoal).
 */
const sponsorGoalPt = (kind: string, count: number, place: number, split: number): string => {
  // v2.0 (C1): split 0 = meta de contrato, contada da assinatura ao fim do contrato.
  if (!split) return sponsorContractGoalPt(kind, count, place);
  const regionals = `${count} dos 3 regionais do Split ${split}`;
  switch (kind) {
    case "enterEvents":
      return `Disputar ${count} eventos no Split ${split}`;
    case "regionalReach":
      return count === 1 ? `Chegar a um regional do Split ${split}` : `Chegar a ${regionals}`;
    case "regionalFinish":
      if (place <= 1) return count === 1 ? `Vencer um regional do Split ${split}` : `Vencer ${regionals}`;
      return count === 1 ? `Um top ${place} em regional no Split ${split}` : `Top ${place} em ${regionals}`;
    case "majorQualify":
      return `Classificar para o Major do Split ${split}`;
    case "majorFinish":
      return place <= 1 ? `Vencer o Major do Split ${split}` : `Top ${place} no Major do Split ${split}`;
    default:
      return "";
  }
};

/** v2.0 (C1): a meta de contrato em palavras: vale pelo contrato inteiro, a partir da assinatura. */
const sponsorContractGoalPt = (kind: string, count: number, place: number): string => {
  const n = (one: string, many: string) => (count === 1 ? one : many);
  switch (kind) {
    case "enterEvents":
      return `Disputar ${count} ${n("evento", "eventos")} durante o contrato`;
    case "regionalReach":
      return `Chegar a ${n("um regional", `${count} regionais`)} durante o contrato`;
    case "regionalFinish":
      if (place <= 1) return `Vencer ${n("um regional", `${count} regionais`)} durante o contrato`;
      return `Top ${place} em ${n("um regional", `${count} regionais`)} durante o contrato`;
    case "majorQualify":
      return `Classificar para ${n("um Major", `${count} Majors`)} durante o contrato`;
    case "majorFinish":
      return place <= 1 ? `Vencer um Major durante o contrato` : `Top ${place} em um Major durante o contrato`;
    default:
      return "";
  }
};

/** rc.34 (ECO-04, decisão 4-A): a dificuldade da meta em uma palavra. */
const SPONSOR_WORD_PT: Record<string, string> = { likely: "Provável", even: "Meio a meio", stretch: "Desafiadora" };

/** rc.34: uma meta nos parâmetros do e-mail (goalKind, goalCount, goalPlace, goalSplit). */
const goalOfParamsPt = (p: Record<string, string | number>): string =>
  sponsorGoalPt(String(p.goalKind), Number(p.goalCount), Number(p.goalPlace), Number(p.goalSplit));

/** rc.34 (S6): a segunda-feira de um passo da transição, como o e-mail cita. */
const stepWhenPt = (week: string | number | undefined, nextSeason: string | number | undefined): string =>
  `a segunda-feira da semana ${week}${Number(nextSeason) ? " da próxima temporada" : ""}`;

export const CAREER_PT: CareerCopy = {
  ...CAREER_FEED_PT, // v2.3 FEED
  meta: {
    title: "Road to Worlds",
    nav: "Carreira",
    locked: "Disponível em breve",
  },

  nav: {
    hub: "QG",
    calendar: "Calendário",
    squad: "Elenco",
    training: "Treinos",
    market: "Mercado",
    finances: "Finanças",
    standings: "Classificação",
    news: "Caixa de entrada",
    club: "Clube",
    more: "Mais",
    exit: "Voltar ao menu",
    saves: "Carreiras",
  },

  // Relógio por dia (v0.2) — renderização de datas (semanas começam na segunda).
  dates: {
    months: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    weekdays: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
    weekdaysLong: [
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
      "Domingo",
    ],
    short: (dow: string, month: string, d: number) => `${dow}, ${d} ${month}`,
    tiny: (month: string, d: number) => `${d} ${month}`,
    today: "Hoje",
    tomorrow: "Amanhã",
    inDays: (n: number) => `em ${n} dias`,
    daysShort: (n: number) => `${n}d`,
  },

  wizard: {
    regionLevels: { hard: "Mais difícil", mid: "Intermediário", easy: "Mais fácil" },
    iconColor: "Cor do emblema",
    tertiaryColor: "Terceira cor",
    title: "Funde sua organização",
    step: (n: number, total: number) => `Etapa ${n} de ${total}`,
    quickStart: "Início rápido",
    quickStartHint: "Aleatoriza tudo: dá para re-tintar as cores depois.",
    identityTitle: "Identidade",
    identityKicker: "Toda dinastia começa com um nome na camisa.",
    orgName: "Nome da organização",
    orgNamePlaceholder: "ex.: Horizon Esports",
    orgNameTaken: "Esse nome pertence a uma org existente.",
    orgNameLength: "2-18 caracteres.",
    abbrev: "Tag",
    abbrevHint: "2-4 letras, aparece nas tabelas e no escudo.",
    managerName: "Nome do manager",
    managerNamePlaceholder: "Seu nome na bancada.",
    country: "País",
    crestTitle: "Escudo & cores",
    crestKicker: "Escolha um símbolo. A cena vai aprender a respeitá-lo.",
    crestLabel: "Formato",
    crestSymbol: "Símbolo",
    crestPattern: "Padrão",
    crestNone: "Nenhum",
    randomizeCrest: "Aleatorizar",
    kits: "Kits",
    kitsHint: "Um toque preenche as duas cores: depois mude qualquer uma delas à vontade.",
    primaryColor: "Cor primária",
    secondaryColor: "Detalhe",
    // rc.36 (UX-04, R88): layouts, a cor livre e o aviso de contraste.
    crestLayout: "Layout",
    crestLayouts: { emblem: "Emblema", monogram: "Letras", stacked: "Emblema + letras", band: "Faixa" },
    customColor: "Qualquer cor",
    colorsTitle: "Cores",
    contrastTitle: "Checagem de contraste",
    contrastPair: "Detalhe sobre a base",
    contrastCard: "Base num card escuro",
    contrastGood: "Fica legível em qualquer tamanho.",
    contrastLowPair: "O detalhe está perto da base: o símbolo some nos escudos pequenos.",
    contrastLowCard: "A base quase se mistura aos cards e tabelas escuros.",
    contrastUseAccent: (name: string) => `Usar ${name} no detalhe`,
    contrastUsePrimary: (name: string) => `Usar ${name} na base`,
    contrastSwap: "Inverter as cores",
    contrastKeep: "Suas cores ficam salvas de qualquer jeito.",
    playstyleHelp: {"offense":"Ajuda o time a criar chances e finalizar ataques.","defense":"Reforça o posicionamento e a proteção do gol.","mechanics":"Melhora a execução técnica e o controle de bola.","consistency":"Ajuda os jogadores a manter o nível durante a série.","experience":"Traz mais calma e decisões melhores nas partidas.","clutch":"Ajuda o time a render nos momentos decisivos."},
    colorNames: {
      "black": "Preto", "graphite": "Grafite", "navy-light": "Marinho claro", "royal-light": "Azul royal claro", "scarlet-light": "Escarlate claro", "burgundy-light": "Bordô claro", "forest-light": "Verde-floresta claro", "teal-light": "Verde-azulado claro", "plum-light": "Ameixa claro", "orange-light": "Laranja claro", "gold-light": "Dourado claro", "olive-light": "Oliva claro",
      navy: "Marinho", gold: "Dourado", burgundy: "Bordô", ivory: "Marfim", royal: "Azul royal", silver: "Prata",
      forest: "Verde-floresta", cream: "Creme", scarlet: "Escarlate", sky: "Celeste", charcoal: "Grafite", amber: "Âmbar",
      petrol: "Petróleo", white: "Branco", plum: "Ameixa", steel: "Aço", wine: "Vinho", olive: "Oliva",
      indigo: "Índigo", "burnt-orange": "Laranja queimado", teal: "Verde-azulado", slate: "Ardósia",
    } as Record<string, string>,
    identityBuff: "Identidade da org",
    identityBuffHint: "A especialidade da sua org: uma pequena vantagem coletiva.",
    regionTitle: "Região-sede",
    regionKicker: "Onde você joga define quem enfrenta, e quantas vagas de Worlds existem.",
    regionStrength: "Força do campo",
    regionSlots: (n: number) => `${n} vagas no Worlds`,
    regionRivals: "Rivais da RLCS X",
    regionNote: "Mudar de região é desbloqueado mais adiante na carreira.",
    strengthDeep: "Campo profundo: o caminho difícil",
    strengthStrong: "Campo forte",
    strengthDeveloping: "Campo em formação: um caminho mais suave",
    rosterTitle: "Primeiras contratações",
    rosterKicker: "Três jogadores sem org. Um deles diz sim para a sua.",
    rosterProspects: "Promessas",
    rosterProspectsDesc: "Adolescentes com teto altíssimo. Exige paciência.",
    rosterJourneymen: "Rodados",
    rosterJourneymenDesc: "Os veteranos da cena. Prontos agora, sem margem de evolução.",
    rosterBalanced: "Equilibrado",
    rosterBalancedDesc: "Um pouco de agora, um pouco de depois.",
    recommended: "Recomendado",
    /** rc.35 (front C): a tag da oferta do meio. */
    rosterBalancedTag: "Equilibrado",
    wageBill: "Folha salarial",
    avgAge: "Idade média",
    avgOverall: "OVR médio",
    // rc.34 review: o orçamento inicial na dificuldade escolhida (Normal até a próxima etapa mudar),
    // e quantas semanas de salários deste elenco ele cobre.
    rosterBudget: (difficulty: string) => `Orçamento inicial · ${difficulty}`,
    rosterRunway: (weeks: number) => `Cobre cerca de ${weeks} semanas de salários`,
    // Etapa 5 — dificuldade + resumo. rc.34 (front I, Miguel 31/10): reescrita
    // para quem joga pela primeira vez, no celular — uma promessa e três tópicos simples.
    finalTitle: "Dificuldade",
    finalKicker: "A escolha vale para a carreira inteira.",
    // rc.32 (BAL-02): os presets da carreira substituem a etapa de Estilo de gestão.
    presets: {
      easy: { label: "Fácil", promise: "Uma primeira carreira mais tranquila, com espaço para errar." },
      normal: { label: "Normal", promise: "A carreira do jeito que ela foi pensada." },
      hard: { label: "Difícil", promise: "Um desafio de verdade, para quem já conhece o caminho." },
    } as Record<"easy" | "normal" | "hard", { label: string; promise: string }>,
    // Os tópicos (wizard/PresetEffects.tsx), lidos ao vivo de balance.ts.
    presetMatches: {
      easier: "As partidas pendem a seu favor.",
      even: "Partidas equilibradas.",
      harder: "Adversários mais fortes.",
    } as Record<"easier" | "even" | "harder", string>,
    // rc.34 review: a regra de dinheiro inteira do preset (economy.moneyRuleFor) — os empréstimos
    // emergenciais da carreira (null = sem limite), as semanas para quitar cada um, ou sem prazo.
    presetMoney: (r: { loans: number | null; deadlineWeeks: number | null }): string => {
      const head = r.loans === null ? "O banco empresta" : r.loans === 1 ? "Um empréstimo do banco" : `Até ${countWordPt(r.loans)} empréstimos do banco`;
      if (r.deadlineWeeks === null) return `Sem dinheiro? ${head}, sem prazo: prêmios e vendas pagam.`;
      return `Sem dinheiro? ${head}: pague em até ${r.deadlineWeeks} ${r.deadlineWeeks === 1 ? "semana" : "semanas"} ou a carreira acaba.`;
    },
    // CAREER_LOAN.breachesToEnd 1: a primeira segunda abaixo do piso encerra a carreira — sem empréstimo.
    presetMoneyNoLoan: "Sem dinheiro, a carreira acaba.",
    // rc.34 review: a delegação do treino com que o preset começa (difficulty.presetTrainingModeOf,
    // CAREER_PLAN.modeByPreset) e se as copas são inscritas por você (as prefs do preset).
    presetHelp: (mode: "auto" | "recommend" | "manual", autoCups: boolean): string =>
      `${{ auto: "O melhor plano de treino vem marcado para você.", recommend: "O melhor plano de treino vem marcado; você escolhe.", manual: "Você planeja os treinos, sem dicas." }[mode]} ${autoCups ? "A inscrição nas copas é automática." : "Você escolhe cada copa."}`,
    summaryTitle: "A papelada",
    found: (org: string) => `Fundar ${org}`,
    founded: "EST. 2020",
    foundedSplash: "Um novo nome entra na cena.",
  },

  hub: {
    title: "QG",
    continue: "Continuar",
    continueTo: (label: string) => `Avançar: ${label}`,
    advanceDay: "Avançar um dia",
    nowNext: "A seguir",
    nowDecision: "Decisão pendente",
    week: (n: number) => `Semana ${n}`,
    matchdayIn: (n: number) => (n === 0 ? "DIA DE JOGO" : n === 1 ? "Jogo amanhã" : `Jogo em ${n} dias`),
    seasonGoal: "Meta da temporada",
    goalStretch: "Meta ousada",
    rosterForm: "Elenco",
    form: "Fase",
    chemistry: "Química",
    pointsRace: "Road to Worlds",
    pointsRank: (rank: number, pts: number) => `#${rank} · ${pts} pts`,
    pointsGap: (pts: number) => `${pts} pts abaixo da linha`,
    pointsSafe: "Acima da linha de corte",
    // RTW-01 (R49): empatado em pontos com a última vaga, abaixo dela no desempate.
    pointsLevel: "Empatado com a linha",
    // RTW-01 (R49): antes de a corrida ter pontos (a tabela é só uma ordem por nome).
    pointsNone: "Ainda sem pontos",
    budget: "Saldo",
    budgetNet: (s: string) => `${s} / semana`,
    budgetWarning: "Projeção negativa no pagamento de segunda",
    news: "O plantão",
    newsAll: "Feed completo",
    inboxTeaser: "Caixa de entrada",
    inboxAll: "Abrir caixa de entrada",
    sponsor: "Meta do patrocinador",
    trainingWeek: "Semana de treino: o elenco ganha reps extras",
    thisWeek: "Esta semana",
    comingUp: "Vem por aí",
    quickActions: "Hoje no escritório",
    scrimCta: (opp: string) => `Scrim vs ${opp}`,
    scrimsLeft: (n: number) => (n === 1 ? "1 bloco de scrim restante na semana" : `${n} blocos de scrim restantes na semana`),
    scrimUnavailable: "Sem bloco de scrim disponível hoje",
    restDay: "Dia de descanso: o elenco recarrega",
    progression: "Próximo desbloqueio",
    emptyStateTitle: "Bem-vindo à bancada",
    emptyStateBody: "Seu primeiro torneio já está no calendário. Aperte Continuar quando estiver pronto.",
    // v0.3 avanço automático estilo FIFA
    play: "Avançar",
    pause: "Pausar",
    playHint: (label: string) => `Avançando, a seguir: ${label}`,
    skipToNext: "Pular adiante",
    // v0.3 painel do plantão de transferências
    transfersTitle: "Janela de transferências",
    transfersWire: "Plantão de transferências",
    transfersAll: "Todas as regiões",
    transfersEmpty: "Nenhuma troca registrada ainda: o plantão enche conforme a janela corre.",
    transfersFa: "Agente livre",
    transfersUser: "Sua movimentação",
    transfersShowAll: (n: number) => `Ver todas as ${n} trocas`,
    // v2.0 hub rebuild (R26)
    today: "Hoje",
    dayOf: (d: number, total: number) => `Dia ${d} de ${total}`,
    nextStop: (label: string, s: string) => `Próxima parada: ${label} · ${s}`,
    needsYou: "Precisa de você",
    nothingNeeded: "Nada pede decisão hoje: avance quando quiser.",
    canDo: "O que você pode fazer hoje",
    inviteTitle: (name: string) => `Convite: ${name}`,
    inviteBody: (day: string) => `Circuito comunitário, joga ${day}. Aceite para comprometer o elenco, ou passe e siga treinando.`,
    inviteAccept: "Aceitar convite",
    invitePass: "Passar",
    // RTW-05 (rc.33): elenco com menos de três — o relógio espera o terceiro jogador.
    squadShortKicker: "Elenco incompleto",
    squadShortTitle: "Contrate um jogador",
    squadShortBody: (n: number, event: string) =>
      `Só ${n} de 3 vagas preenchidas. Assine um terceiro jogador antes de ${event}: um agente livre pode entrar hoje, com ou sem janela.`,
    // rc.39 F6 (R103): titular indisponível e sem reserva — a mesma pausa, com o texto certo.
    squadShortAbsentTitle: "Sem substituto",
    absenceReasons: { fatigue: "excesso de carga de treino", illness: "problemas de saúde", fitness: "falta de condições físicas" },
    squadShortAbsentBody: (player: string, event: string, reason?: string) =>
      `${player} não poderá jogar ${event} por ${reason ?? "falta de condições físicas"}. Não há um substituto para ocupar sua vaga. Contrate um substituto durante a janela de transferências ou fique fora deste campeonato.`,
    squadShortAbsentSkip: "Ficar fora deste evento",
    squadShortAbsentSkipHint: (event: string) =>
      `${event}: sem inscrição, sem pontos, sem prêmio. Contrate um reserva na próxima janela.`,
    squadShortMarket: "Ir ao Mercado",
    squadShortSquad: "Elenco",
    contractsExpiring: (n: number) => (n === 1 ? "1 contrato termina nesta temporada, renove ou deixe vencer." : `${n} contratos terminam nesta temporada, renove ou deixe vencer.`),
    cashWarningCard: (weeks: number) => `O caixa acaba em cerca de ${weeks} semanas nesse ritmo.`,
    // ECO-02 (R46): o card cita a dívida que Finanças mostra.
    // rc.34: o empréstimo emergencial do banco e o prazo dele.
    backerOpen: (owed: string) => `Empréstimo emergencial em aberto: ${owed} a devolver ao banco.`,
    loanDue: (date: string, weeks: number) =>
      weeks <= 0
        ? `Vence nesta segunda (${date}).`
        : weeks === 1
          ? `Vence na próxima segunda, ${date}.`
          : `Vence em ${date}: faltam ${weeks} semanas. Premiações e vendas abatem parte dele no caminho.`,
    loanDueRule: deadlineRulePt,
    // rc.32 (M4): a linha do QG abaixo dele — o que significa a próxima quebra (rc.34: nextBreachParamsOf do fluxo).
    backerNextBreach: (p: Record<string, string | number>) => nextBreachPt(p),
    cards: {
      training: "Treino",
      trainingOn: "Sessão hoje. De segunda a sexta o elenco evolui.",
      trainingOff: "Sem sessão hoje: descanso ou preparação de jogo.",
      scrim: "Scrim",
      market: "Mercado",
      marketOpen: (n: number) => (n === 1 ? "Janela aberta, fecha amanhã" : `Janela aberta, fecha em ${n} dias`),
      marketClosed: (s: string) => `Janela fechada: abre ${s}`,
      finances: "Finanças",
      bootcamp: "Bootcamp",
      bootcampReady: "Há uma vaga de bootcamp neste split.",
      squad: "Elenco",
      squadLine: (ovr: number, chem: number) => `Média ${ovr} OVR · química ${chem}%`,
    },
    edges: "Suas vantagens",
    edgesEmpty: "Ainda sem vantagens: coaches, equipamentos e patrocínios abrem com reputação.",
    edgeCoach: (name: string, pct: number) => `${name} · ${pct > 0 ? "+" : ""}${pct}% de treino`,
    edgeGear: (name: string, pct: number) => `${name} · +${pct}% de treino`,
    edgePsych: "Psicólogo · +5 Clutch, +5 Consistência",
    edgeSharp: "Bootcamp Sharp · armado para o próximo oficial",
    edgeSponsor: (tier: number) => `Vantagens do patrocínio tier ${tier}`,
    autoplayOn: "Autoplay ligado: pausa na próxima parada",
    // rc.2 hub v3
    skipTo: (label: string) => `Pular até ${label}`,
    plusDay: "+1 dia",
    squadTitle: "Elenco",
    squadManage: "Gerenciar elenco",
    squadSub: "Reserva",
    squadCoach: "Técnico",
    squadNoCoach: "Sem técnico: contrate um no Mercado",
    squadNoSub: "Sem reserva contratado",
    growthNext: (days: number) => (days === 1 ? "+1 OVR amanhã" : `+1 OVR em ${days} dias`),
    growthStalled: "Crescimento no limite",
    trainingTitle: "Treino",
    trainingOpen: "Abrir treino",
    trainingToday: "Sessão hoje",
    trainingRest: "Dia de descanso",
    trainingMatch: "Preparação de jogo",
    drillNow: "Drill da semana",
    drillNone: "Nenhum drill definido",
    drillPick: "Escolher drill",
    scrimTitle: "Scrim",
    edgesTitle: "Suas vantagens",
    // rc.34 (DEV-03, HQ-CONTRACT H3): o bloco de treino — o plano do período de relance.
    trainingScrims: (done: number, planned: number, level: string) => `Scrims ${done} de ${planned} · ${level}`,
    trainingNoScrims: "Sem scrims no plano",
    trainingLast: (avg: string, name: string, gain: string, wear: string) => `Último período ${avg} em média · ${name} ${gain} · ${wear}`,
    trainingLastNone: "Nenhum período fechado ainda",
    trainingCoachNone: "Sem coach: a base, ou o seu pacote pela metade",
    trainingRisk: (pts: string) => `+${pts} pts de risco de ausência`,
    financesTitle: "Finanças",
    financesOpen: "Abrir finanças",
    // rc.34 (UX-01a, HQ-CONTRACT H1): uma decisão por vez; o "Depois" da 1-B para propostas e patrocínios.
    decisionCount: (i: number, n: number) => `${i} de ${n}`,
    later: "Depois",
    alsoDue: "Também",
    parked: "Para depois",
    dueBy: (date: string) => `até ${date}`,
    dueToday: "último dia",
    lastDay: "Último dia: o relógio espera a sua resposta.",
    standsUntil: (date: string) => `Vale até ${date}; "Depois" guarda até lá.`,
    decisionKind: {
      event: "Dia de jogo",
      seasonReview: "Revisão da temporada",
      notice: "Aviso",
      contractReview: "Revisão de contratos",
      squadShort: "Elenco incompleto",
      insert: "Decisão da semana",
      invite: "Convite",
      training: "Plano de treino",
      bid: (player: string) => `Proposta por ${player}`,
      trade: (player: string) => `Troca: ${player}`,
      sponsor: "Propostas de patrocínio",
      sunday: "Começar o domingo",
      follow: "Sem você",
      board: "A diretoria",
    },
    noticeTitle: "Um aviso precisa de você",
    noticeBody: "Leia e confirme o aviso: o relógio anda depois disso.",
    trainingDecisionTitle: "O técnico tem um plano",
    trainingDecisionBody: "A proposta de treino do técnico espera a sua resposta.",
    // rc.36 (front S2, Miguel sobre a rc.35): a escolha do patrocínio é um pop-up; o bloco só a chama, com "Decidir depois".
    sponsorLater: "Decidir depois",
    sponsorPromptTitle: (n: number) => (n === 1 ? "Uma marca quer patrocinar a org" : `${n} marcas querem patrocinar a org`),
    sponsorSeeOffers: "Ver as ofertas",
    sponsorDueBy: (date: string) => `Escolha uma até ${date}`,
    sponsorAutoSign: (date: string) => `Em ${date} a oferta mais segura é assinada por você.`,
    // rc.34 (Miguel, 31/10): um elenco incompleto pode ficar fora de uma regional.
    squadShortSkip: "Pular esta regional",
    squadShortSkipHint: (event: string) =>
      `${event}: sem inscrição, sem pontos, sem prêmio. O treino segue, e a próxima regional pergunta de novo.`,
    // rc.34 (UX-01b, HQ-CONTRACT H2): o elenco em cartas do Draft.
    cardStarter: "Titular",
    cardReserve: "Reserva",
    cardEmptySeat: "Vaga aberta",
    cardSignHint: "Contrate um jogador",
    cardUntil: (season: string) => `Até ${season}`,
    cardEndsIn: (weeks: number) => (weeks <= 0 ? "Sai na virada" : weeks === 1 ? "Termina em 1 semana" : `Termina em ${weeks} semanas`),
    cardFinalSeason: "Última temporada",
    cardCoach: (name: string, ovr: number, pct: number) => `${name} · ${ovr} · ${pct > 0 ? "+" : ""}${pct}% de treino`,
    // rc.35 (front C): o título da fila do elenco e o chip de treino do técnico.
    cardStarters: "Titulares",
    coachTrainingPct: (pct: number) => `${pct > 0 ? "+" : ""}${pct}% de treino`,
    // rc.34 (UX-01d, decisão 6-A): a pergunta da semana sobre a vaga.
    nextRegional: (ordinal: number, week: number) => `Próxima regional (R${ordinal}, semana ${week})`,
    seatDirect: "vaga direta",
    seatQualifier: "qualificatória de sábado",
    seatPreview: "por enquanto: definida na segunda da semana",
    // rc.34 (UX-01e, HQ-CONTRACT H5): o dinheiro, só o lançado ou comprometido.
    financePerWeek: (amount: string) => `${amount} por semana`,
    financePayroll: "Próxima folha",
    financeGuaranteed: "Receita garantida",
    // rc.36 (POL-04): "Loja e streams" saiu — só patrocínio e parceiro.
    financeGuaranteedParts: (sponsor: string, partner: string) => `patrocínio ${sponsor} · parceiro ${partner}`,
    financePartnerWeeks: (n: number) => (n === 1 ? "mais 1 semana" : `mais ${n} semanas`),
    financeDebtNone: "Nenhuma",
    financeRunway: "Fôlego",
    // rc.36 (POL-02): o valor da linha de fôlego.
    financeRunwayWeeks: (weeks: number) => (weeks === 1 ? "1 semana nesse ritmo" : `${weeks} semanas nesse ritmo`),
    financeOverdraft: (floor: string) => `Usando crédito. O empréstimo de emergência é acionado se a segunda-feira fechar abaixo de ${floor}.`,
    financeRunwayOk: "No azul",
    financeWeek: "Esta semana",
    // rc.34 review: o empréstimo emergencial (o "Backer" do rc.31–rc.33 saiu do produto).
    financeDebtBacker: (owed: string) => `Empréstimo emergencial ${owed}`,
    financeDebtBank: (owed: string, next: string) => `banco ${owed} · próxima ${next}`,
    financeProjection: "Fim do split",
    financeProjectionLine: (date: string, mondays: number, balance: string) =>
      `${date} · ${mondays === 1 ? "1 segunda" : `${mondays} segundas`}, sem prêmios: ${balance}`,
    financeNoHistory: "A linha se forma com as segundas que o save registra.",
  },

  // Caixa de entrada v0.2 — correio endereçado ao manager.
  mail: {
    greeting: "Olá,",
    signoff: "Atenciosamente,",
    title: "Caixa de entrada",
    unread: (n: number) => `${n} não lidas`,
    markAllRead: "Marcar tudo como lido",
    empty: "Nenhum e-mail. A mesa está quieta, por enquanto.",
    pickOne: "Escolha uma mensagem à esquerda para ler aqui.",
    emptyHint: "Propostas de transferência, patrocínios e avisos de contrato chegam aqui.",
    open: "Abrir",
    from: {
      bank: "Banco Northline",
      accountant: "Contador da org",
      board: "A Diretoria",
      agent: "Agentes de jogadores",
      sponsor: "Relações com patrocinadores",
      // Histórico: e-mails do Investidor de emergência (rc.31–rc.33); no rc.34 quem empresta é o banco.
      backer: "Investidor de emergência",
      league: "Operações da liga",
      staff: "Operações do time",
    },
    kinds: {
      offer: "Transferência",
      sponsor: "Patrocínio",
      contract: "Contratos",
      finance: "Finanças",
      unlock: "Desbloqueado",
      club: "Clube",
    },
    tpl: {
      incomingBid: (p: Record<string, string | number>) => `Proposta por ${p.player}`,
      listingNoBuyer: (p: Record<string, string | number>) => `Ninguém quis ${p.player}`,
      listingTooDear: (p: Record<string, string | number>) => `${p.player}: o preço não atraiu proposta`,
      listingOffer: (p: Record<string, string | number>) => `${p.org} pagam o preço pedido por ${p.player}`,
      listingCounter: (p: Record<string, string | number>) => `${p.org} fazem contraproposta por ${p.player}`,
      tradeRefusedFit: (p: Record<string, string | number>) => `${p.org} recusam a troca por ${p.take}`,
      tradeRefusedValue: (p: Record<string, string | number>) => `${p.org} acham a troca por ${p.take} leve demais`,
      tradeAgreed: (p: Record<string, string | number>) => `${p.org} aceitam trocar ${p.take}`,
      tradeCountered: (p: Record<string, string | number>) => `${p.org} pedem dinheiro na troca por ${p.take}`,
      blockbusterBid: (p: Record<string, string | number>) => `BOMBA: ${p.org} querem ${p.player}`,
      sponsorOffers: () => `Propostas de patrocínio na sua mesa`,
      objectiveHit: (p: Record<string, string | number>) => `${p.name}: meta entregue`,
      objectiveMissed: (p: Record<string, string | number>) => `${p.name}: meta perdida`,
      contractExpiring: (p: Record<string, string | number>) => `${p.player}: contrato na última temporada`,
      // rc.34 (UX-06b): os lembretes antes de um jogador poder sair.
      contractReminder: (p: Record<string, string | number>) => `Contratos: ${p.weeks} semanas para ${p.players}`,
      bankLoan: (p: Record<string, string | number>) => `Empréstimo aprovado: ${p.amount}`,
      // rc.37 F2: a oferta do banco antes do piso, e a proposta da venda de emergência.
      creditOffer: (p: Record<string, string | number>) => `O banco oferece ${p.loanNet} antes do piso`,
      emergencyBid: (p: Record<string, string | number>) => `Proposta de emergência por ${p.player}`,
      bankCleared: () => `Empréstimo bancário quitado`,
      cashWarning: (p: Record<string, string | number>) => `Alerta de caixa: ${p.weeks} semanas de fôlego`,
      qualifiedRegional: (p: Record<string, string | number>) => `Passou na qualificatória: ${p.event} está marcado`,
      missedRegional: (p: Record<string, string | number>) => `Fora na qualificatória: ${p.event} acontece sem você`,
      // Histórico: o e-mail de resgate do Investidor (rc.31–rc.33; o rc.34 envia emergencyLoan).
      backerIn: () => `Aporte de emergência garantido`,
      // rc.34 (Miguel, 31/10): o empréstimo emergencial do banco, os acréscimos e o prazo.
      emergencyLoan: () => `Empréstimo emergencial do banco`,
      emergencyTopUp: () => `O banco aumenta seu empréstimo emergencial`,
      loanDeadline: (p: Record<string, string | number>) =>
        Number(p.weeksLeft) === 1
          ? `Empréstimo emergencial: vence na próxima segunda`
          : `Empréstimo emergencial: ${p.weeksLeft} semanas para o prazo`,
      loanCollected: () => `Empréstimo emergencial quitado no prazo`,
      // rc.34 review: a projeção deixou de cobrir a dívida nas últimas semanas antes do prazo.
      loanSlipped: () => `Empréstimo emergencial: deixou de estar coberto`,
      loanTakenOver: () => `O banco assume a dívida do Investidor`,
      unlock: (p: Record<string, string | number>) => `Novidade para a org: ${p.name}`,
      windowReport: (p: Record<string, string | number>) => `Relatório da janela: ${p.n} trocas`,
      unavailable: (p: Record<string, string | number>) => `${p.player} fora de ${p.event}`,
      noReserve: () => `Elenco sem reserva`,
      debtCleared: () => `Empréstimo emergencial quitado`,
      // DEV-02 (R48): o aposentado do próprio elenco — para onde ele foi.
      retiredToCoach: (p: Record<string, string | number>) => `${p.player} se aposenta, e vira treinador`,
      retiredLeaves: (p: Record<string, string | number>) => `${p.player} se aposenta das competições`,
      // v2.1 M1 (R139): o treinador do usuário envelhece e se aposenta.
      coachRetireAnnounce: (p: Record<string, string | number>) => `${p.coach} anuncia sua última temporada`,
      coachRetired: (p: Record<string, string | number>) => `${p.coach} se aposenta como treinador`,
      // rc.32 (ECONOMY-CONTRACT M3 / M4 / M8, provisório).
      foundingPartner: () => `Um parceiro fundador apoia a org`,
      foundingPartnerEnds: () => `O parceiro fundador se despede`,
      cashNotice: (p: Record<string, string | number>) => `Aviso de caixa: cerca de ${p.weeks} semanas de fôlego`,
      // Histórico do rc.32 (ECO-08 / ECO-12): nada os envia desde o rc.33 — ficam para a caixa de um save antigo.
      restructured: () => `O Investidor reestruturou a org`,
      // rc.34 (ECO-04): os e-mails dos contratos.
      sponsorLapsed: () => `As propostas de patrocínio expiraram`,
      // rc.36 (front S2): CAREER_SPONSOR.deadlineRule "signSafest" — ninguém escolheu até o prazo.
      sponsorAutoSigned: (p: Record<string, string | number>) => `${p.name}: o contrato mais seguro, assinado por você`,
      sponsorGoalHit: (p: Record<string, string | number>) => `${p.name}: meta batida`,
      sponsorGoalMissed: (p: Record<string, string | number>) => `${p.name}: meta perdida`,
      sponsorGoalSet: (p: Record<string, string | number>) => `${p.name}: a meta do Split ${p.goalSplit}`,
      sponsorEnded: (p: Record<string, string | number>) => `${p.name}: contrato concluído`,
      foundingHandover: () => `O parceiro fundador passa o bastão`,
      // v2.0 (C1)
      sponsorBootcamp: (p: Record<string, string | number>) => `${p.name}: seu bootcamp está reservado`,
      coachContractExpiring: (p: Record<string, string | number>) => `${p.coach}: contrato na última temporada`,
      coachRenewed: (p: Record<string, string | number>) => `${p.coach} renova`,
      coachLeft: (p: Record<string, string | number>) => `${p.coach} sai ao fim do contrato`,
    },
    body: {
      incomingBid: (p: Record<string, string | number>) =>
        `${p.org} formalizaram uma proposta de ${p.fee} por ${p.player}. Ela expira quando a janela fechar: aceite ou recuse na aba de negociações do Mercado.`,
      listingNoBuyer: (p: Record<string, string | number>) =>
        `Nenhuma org da região dele respondeu à sua listagem de ${p.player} por ${p.ask}. Retire-o ou tente de novo na próxima janela.`,
      listingTooDear: (p: Record<string, string | number>) =>
        `O mercado passou por ${p.player} a ${p.ask}. Baixe o preço na aba de negociações do Mercado ou retire-o.`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} pagam ${p.fee} por ${p.player}, o preço que você pediu (${p.ask}). Aceite ou recuse na aba de negociações do Mercado; ela expira quando a janela fechar.`,
      listingCounter: (p: Record<string, string | number>) =>
        `${p.org} querem ${p.player}, mas oferecem ${p.fee}, abaixo dos ${p.ask} que você pediu. Aceite ou recuse na aba de negociações do Mercado; ela expira quando a janela fechar.`,
      tradeRefusedFit: (p: Record<string, string | number>) =>
        `${p.org} não trocam ${p.take} por ${p.give}: ${p.give} enfraqueceria demais o elenco deles. A proposta foi encerrada.`,
      tradeRefusedValue: (p: Record<string, string | number>) =>
        `${p.org} avaliam ${p.take} bem acima de ${p.give}, e o dinheiro oferecido não fecha a diferença. A proposta foi encerrada.`,
      tradeAgreed: (p: Record<string, string | number>) =>
        `${p.org} aceitam enviar ${p.take} por ${p.give}, com ${p.cash} em dinheiro da sua parte. Aceite ou recuse na aba de negociações do Mercado; vale até a janela fechar.`,
      tradeCountered: (p: Record<string, string | number>) =>
        `${p.org} enviam ${p.take} por ${p.give} se você somar ${p.cash} em dinheiro. Aceite ou recuse na aba de negociações do Mercado; vale até a janela fechar.`,
      // rc.32 (Miguel, 30/10): o que é uma proposta Bomba, por que veio, o preço e o custo de recusar.
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} vieram com tudo: ${p.fee} por ${p.player}, ${p.mult === undefined ? "bem acima do" : `×${String(p.mult).replace(".", ",")} o`} valor de mercado dele. Se você recusar ou deixar expirar, ele fica${p.pct === undefined ? ", mas a próxima pedida de renovação dele pode subir." : `, mas a próxima pedida de renovação dele sobe ${p.pct}%.`}`,
      foundingPartner: (p: Record<string, string | number>) =>
        `Um parceiro local apoia os primeiros passos da org: ${p.base} por split, pagos toda segunda-feira. Basta disputar eventos. Ele fica até o seu primeiro contrato de patrocínio, e pelo menos até o fim de ${p.through}.`,
      foundingPartnerEnds: () =>
        `O ciclo do parceiro fundador acabou: a org já tem o próprio patrocínio e deixou as primeiras temporadas para trás. Daqui em diante as contas se apoiam em patrocínio e premiação.`,
      cashNotice: (p: Record<string, string | number>) =>
        `Um aviso do contador: com ${p.burn} de queima por semana, o saldo cobre mais ou menos ${p.weeks} segundas-feiras, e as contas fechariam abaixo do piso (${p.floor}) n${breachWhenPt(p)}. ${nextBreachPt(p)} Agora é a hora barata de agir: aceite uma boa proposta por um jogador, mire a premiação, segure a próxima renovação${Number(p.backer) ? "" : " ou prepare um empréstimo no banco"}.`,
      // Histórico do rc.32 (ECO-08 / ECO-12): nada os envia desde o rc.33 — ficam para a caixa de um save antigo.
      restructured: (p: Record<string, string | number>) =>
        `As contas fecharam de novo abaixo do piso (quebra ${p.n}), e o Investidor reestruturou a org${p.player ? `: ${p.player} foi vendido para ${p.org} por ${p.fee}, o valor de mercado dele${positive(p.garnished) ? ` (${p.garnished} foram para a dívida)` : ""}` : ""}. ${Number(p.rep) > 0 ? `Reputação −${p.rep}. ` : ""}${Number(p.granted) > 0 ? `O Investidor recompôs o saldo para ${p.rescueTo}` : `O saldo está em ${p.balance}`}; ${positive(p.owed) ? `a dívida é de ${p.owed}` : "não há dívida"}. O elenco segue jogando: o reserva sobe; uma vaga vazia pede um agente livre antes do próximo evento. ${legacyNextBreachPt(p.next)}`,
      sponsorOffers: () =>
        `Marcas estão de olho na org. Avalie as propostas em Finanças: a base é garantida; o bônus depende da meta.`,
      objectiveHit: (p: Record<string, string | number>) =>
        `A meta do split foi entregue. O bônus de ${p.bonus} cai junto com o pagamento. Bom negócio.`,
      objectiveMissed: (p: Record<string, string | number>) =>
        `A meta do split escapou. Faltas repetidas derrubam o tier da renovação. (Faltas até aqui: ${p.misses}.)`,
      // rc.34 (ECO-04): os e-mails dos contratos.
      // rc.36 (front S2): duas ou três marcas (o acesso da escada), com preço pelo risco (rc.35), e a regra do prazo.
      sponsorDecision: (p: Record<string, string | number>) =>
        `${Number(p.n) === 2 ? "Duas marcas querem a organização no Tier " + p.tier + ": um contrato Estável e um Equilibrado" : "Três marcas querem a organização no Tier " + p.tier + ": um contrato Estável, um Equilibrado e um Ousado"}. Quanto mais ousado o contrato, mais ele paga: por uma meta mais difícil e uma multa maior. Compare no QG e assine um até o domingo da semana ${p.byWeek}${Number(p.auto) ? ", depois disso o mais seguro é assinado por você" : ", nesse dia o relógio espera a sua escolha"}.${Number(p.demoted) ? " Três metas escaparam no último contrato Estável, então esta rodada vem um tier abaixo." : ""}`,
      sponsorLapsed: () =>
        `Ninguém assinou antes do prazo e as marcas seguiram em frente. As próximas propostas chegam na próxima virada de split.`,
      sponsorAutoSigned: (p: Record<string, string | number>) =>
        `Ninguém escolheu um contrato até o prazo, então a org assinou o mais seguro da mesa: ${p.name}. Os números estão em Finanças.`,
      sponsorGoalHit: (p: Record<string, string | number>) =>
        `${goalOfParamsPt(p)}: feito. O bônus de ${p.bonus} entra hoje${positive(p.milestone) ? `, junto com o pagamento do marco de ${p.milestone}` : ""}.`,
      sponsorGoalMissed: (p: Record<string, string | number>) =>
        `${goalOfParamsPt(p)}: ${p.done} de ${p.target}. ${
          positive(p.fine)
            ? `A multa é de ${p.fine}, em parcelas de ${p.perMonday} nas próximas ${p.mondays} segundas.`
            : Number(p.steady)
              ? `Contrato Estável não tem multa, mas a paciência da marca cai: ${p.misses} de ${p.patience} metas perdidas; em ${p.patience}, a próxima proposta vem um tier abaixo.`
              : "Sem multa."
        }`,
      sponsorGoalSet: (p: Record<string, string | number>) =>
        `A meta do novo split: ${goalOfParamsPt(p)}, ${SPONSOR_WORD_PT[String(p.word)] ?? p.word}. Bater paga ${p.bonus}${positive(p.fine) ? `; perder custa até ${p.fine}` : ""}.`,
      sponsorEnded: (p: Record<string, string | number>) =>
        `O contrato chegou ao fim: ${p.hits} de ${p.goals} metas batidas. Novas propostas estão na sua mesa.${Number(p.demoted) ? " Depois de três metas perdidas num contrato Estável, elas vêm um tier abaixo." : ""}`,
      foundingHandover: (p: Record<string, string | number>) =>
        `Com um contrato próprio e as primeiras temporadas para trás, a organização não depende mais do parceiro fundador. Ele sai aos poucos: ${p.first}% do valor até ${stepWhenPt(p.stepWeek, p.stepNextSeason)}, depois ${p.second}% até ${stepWhenPt(p.endWeek, p.endNextSeason)}, e então encerra.`,
      contractExpiring: (p: Record<string, string | number>) =>
        `${p.player} está na última temporada de contrato. Você tem janela exclusiva de renovação até o fim do Split 3: depois disso, ele sai de graça.`,
      contractReminder: (p: Record<string, string | number>) =>
        `${p.players}: ainda sem contrato depois desta temporada, com ${p.weeks} semanas pela frente. Renove no Elenco antes da virada, ou eles saem como agentes livres (a revisão antes da nova temporada lista todos).`,
      bankLoan: (p: Record<string, string | number>) =>
        `O banco liberou ${p.amount}. Parcelas de ${p.weekly} caem toda segunda-feira até quitar ${p.total}. Gaste em algo que se pague.`,
      // rc.37 F2 (pacote 2): o empréstimo comum do banco, oferecido na segunda em que o fôlego chega ao nível de alerta.
      creditOffer: (p: Record<string, string | number>) =>
        `${Number(p.weeks) > 0 ? `Com ${p.burn} de queima por semana, o saldo cobre mais ou menos ${p.weeks} segundas-feiras` : `As contas estão no vermelho (${p.balance}), com ${p.burn} de queima por semana`}, e fechariam abaixo do piso (${p.floor}) n${breachWhenPt(p)}. O banco oferece o empréstimo comum: ${p.loanNet} agora, ${p.loanWeekly} toda segunda por ${p.loanTerm} semanas (${p.loanTotal} no total, ${p.loanPct}% de juros). Sai mais barato que o emergencial (${p.emergencyPct}%${Number(p.emergencyTerm) > 0 ? `, a quitar em até ${p.emergencyTerm} semanas` : ""}). Em Finanças dá para pegar outro valor.`,
      // rc.37 F2 (pacote 3): uma proposta de venda de emergência — abaixo do valor de mercado, com o caixa no vermelho.
      emergencyBid: (p: Record<string, string | number>) =>
        `O caixa está no vermelho (${p.balance}), e a ${p.org} sentiu a oportunidade: ${p.fee} por ${p.player}, ${p.pct}% do valor de mercado dele. A proposta vale por ${p.days} dias ou até a janela fechar, e aceitar vende o jogador na hora. Os detalhes estão na aba de negociações do Mercado.`,
      bankCleared: () =>
        `A última parcela foi paga. A linha de crédito está aberta de novo, se a org precisar.`,
      // rc.32 (M4, provisório): toda segunda com ≤ 4 semanas — a quebra projetada e a saída.
      cashWarning: (p: Record<string, string | number>) =>
        p.breachWeek === undefined
          ? `A ${p.net} por semana, o saldo cobre mais ou menos ${p.weeks} segundas-feiras. Corte salários, ganhe premiação ou negocie um empréstimo antes que as contas rompam o piso.`
          : `Com ${p.burn} de queima por semana, o saldo cobre mais ou menos ${p.weeks} segundas-feiras; nesse ritmo as contas fecham abaixo do piso (${p.floor}) n${breachWhenPt(p)}. ${nextBreachPt(p)} Saídas: aceitar uma boa proposta por um jogador, ganhar premiação, enxugar a folha na renovação${Number(p.backer) ? "" : " ou pegar um empréstimo no banco"}.`,
      qualifiedRegional: (p: Record<string, string | number>) =>
        `O Swiss de sábado acabou e a org está entre os oito classificados. ${p.event} é no domingo: os oito diretos esperam.`,
      missedRegional: (p: Record<string, string | number>) =>
        `Três derrotas no Swiss de sábado: o ${p.event} acontece no domingo sem você. Descanse; segunda começa uma nova semana de treino.`,
      // HISTÓRICO (rc.32–rc.33): o e-mail de resgate do Investidor, como saiu (o rc.34 envia emergencyLoan).
      backerIn: (p: Record<string, string | number>) =>
        p.rescueTo === undefined
          ? `As contas romperam o piso e o Investidor de emergência entrou: uma única vez. O pagamento sai descontado da premiação. Um segundo colapso encerra a org.`
          : `As contas fecharam uma segunda-feira abaixo do piso${Number(p.n) > 1 ? ` pela ${ordinalPt(Number(p.n))} vez` : ""} e o Investidor de emergência entrou: o saldo voltou a ${p.rescueTo}${Number(p.weeks) > 0 ? ` (cerca de ${p.weeks} semanas de salários)` : ""}. A dívida é de ${p.owed}: ${p.garnishPct}% de cada premiação e metade de qualquer venda vão para ela até quitar, ou abata em Finanças. Enquanto ela existir, taxas de transferência, equipamentos${Number(p.lock) ? " e novos compromissos que encurtam o fôlego" : ""} ficam suspensos.${positive(p.partnerWeekly) ? ` Um parceiro de resgate, o ${p.partnerName}, entra junto: ${p.partnerWeekly} por semana a partir da próxima segunda, por ${p.partnerWeeks} semanas, o último pagamento n${partnerUntilPt(p)}. É receita, nunca descontada; Finanças o mostra enquanto durar.` : ""} ${legacyNextBreachPt(p.next, p.nextPartner, p.partnerRun)}`,
      // rc.34 (Miguel, 31/10): o empréstimo emergencial do banco — por quê, quanto, como se paga,
      // até quando, o investidor se veio junto, e o que encerra a carreira.
      emergencyLoan: (p: Record<string, string | number>) =>
        `As contas fecharam uma segunda-feira abaixo do piso (${p.floor}), e o banco fez um empréstimo emergencial de ${p.lent}: o saldo voltou a ${p.rescueTo}${Number(p.weeks) > 0 ? ` (cerca de ${p.weeks} semanas de salários)` : ""}. A dívida é de ${p.owed}, juros incluídos. ${p.garnishPct}% de cada premiação e ${p.salePct}% de cada venda abatem a dívida; o resto você paga em Finanças.${p.dlWeek !== undefined ? ` O prazo é ${mondayWhenPt(p.dlWeek, p.dlAhead)}. ${deadlineRulePt}` : ""}${loansLeftPt(p) ? ` ${loansLeftPt(p)}` : ""}${positive(p.partnerWeekly) ? ` Um investidor, o ${p.partnerName}, entra junto: ${p.partnerWeekly} por semana durante ${p.partnerWeeks} semanas, até ${partnerUntilPt(p)}.` : ""}${Number(p.lock) ? " Enquanto houver dívida, taxas de transferência, equipamentos e novos compromissos ficam suspensos." : ""} ${nextBreachPt(p)}`,
      emergencyTopUp: (p: Record<string, string | number>) =>
        `As contas fecharam abaixo do piso de novo, e o banco emprestou mais ${p.lent}: o saldo voltou a ${p.rescueTo}, e a dívida agora é de ${p.owed} no total.${p.dlWeek !== undefined ? ` O prazo não muda: ${mondayWhenPt(p.dlWeek, p.dlAhead)}. ${deadlineRulePt}` : ""} ${nextBreachPt(p)}`,
      // rc.34 review: as contas projetadas até o prazo (um e-mail antigo sem a projeção lê o saldo de hoje).
      loanDeadline: (p: Record<string, string | number>) =>
        `${Number(p.weeksLeft) === 1 ? "Falta uma semana" : `Faltam ${p.weeksLeft} semanas`} para o prazo do empréstimo emergencial, ${mondayWhenPt(p.dlWeek, p.dlAhead)}. A dívida é de ${p.owed}; o saldo está em ${p.balance}. ${p.projected === undefined ? (Number(p.covered) ? "O saldo de hoje cobriria a dívida." : "O saldo de hoje não cobriria a dívida.") : onPacePt(p)}${Number(p.covered) ? "" : ` ${gapWaysPt(p)}`} ${deadlineRulePt}`,
      loanCollected: (p: Record<string, string | number>) =>
        `O empréstimo emergencial venceu e as contas aguentaram: o banco cobrou ${p.collected}, e o saldo está em ${p.balance}. O empréstimo está encerrado. ${p.next === undefined ? "Uma nova quebra do piso abriria outro, com um prazo novo." : nextBreachPt(p)}`,
      loanSlipped: (p: Record<string, string | number>) =>
        `${Number(p.weeksLeft) === 1 ? "A uma semana" : `A ${p.weeksLeft} semanas`} do prazo do empréstimo emergencial, ${mondayWhenPt(p.dlWeek, p.dlAhead)}, as contas deixaram de cobri-lo: neste ritmo (${p.net} por semana) o saldo estaria em ${p.projected} nessa segunda, ${p.gap} abaixo do que o banco precisa para os ${p.owed} devidos. ${gapWaysPt(p)} ${deadlineRulePt}`,
      loanTakenOver: (p: Record<string, string | number>) =>
        `O Investidor de emergência saiu de cena: o banco assumiu o que você devia a ele, ${p.owed}, como um empréstimo emergencial.${p.dlWeek !== undefined ? ` O prazo é ${mondayWhenPt(p.dlWeek, p.dlAhead)}: daqui a ${p.dlWeeks} semanas. ${deadlineRulePt}` : ""} ${p.garnishPct}% de cada premiação e ${p.salePct}% de qualquer venda continuam abatendo a dívida automaticamente, e Finanças aceita qualquer pagamento. ${Number(p.lock) ? "" : "Nada fica mais travado enquanto você deve: contratações, taxas e equipamentos estão liberados. "}${nextBreachPt(p)}`,
      unlock: (p: Record<string, string | number>) =>
        `O progresso da org desbloqueou: ${p.name}. Confira a trilha de progressão no QG: o arsenal cresce com a reputação.`,
      windowReport: (p: Record<string, string | number>) =>
        `A janela fechou: ${p.n} trocas em todas as regiões. Taxas de destaque: ${p.p1} (${p.f1})${p.p2 ? ` · ${p.p2} (${p.f2})` : ""}${p.p3 ? ` · ${p.p3} (${p.f3})` : ""}. O plantão completo está no QG.`,
      unavailable: (p: Record<string, string | number>) =>
        `${p.player} não joga ${p.event}: o reserva assume a vaga com a química dele.`,
      unavailableNoReserve: (p: Record<string, string | number>) =>
        `${p.player} não joga ${p.event}, e o elenco não tem reserva para a vaga. Reserva só assina na janela de transferências: se nenhuma abrir antes do evento, o time não joga.`,
      noReserve: () =>
        `A partir desta temporada um titular pode ficar fora de um evento oficial. Com um reserva, ele entra no lugar. Sem reserva, o time não joga o evento. Reserva só assina na janela de transferências.`,
      // rc.34 review: com o que a próxima quebra faz (o último empréstimo da carreira quitado: o fim) — um e-mail antigo lê como saiu.
      debtCleared: (p: Record<string, string | number> = {}) =>
        `O empréstimo emergencial está quitado, e o prazo deixou de existir: a org volta a ser dona do próprio futuro. ${p.next === undefined ? "A porta do banco segue aberta." : nextBreachPt(p)}`,
      retiredToCoach: (p: Record<string, string | number>) =>
        `${p.player} jogou sua última temporada e deixa as competições: direto para a carreira de treinador. Ele já está no grupo de técnicos e pode aparecer na lista de treinadores.`,
      retiredLeaves: (p: Record<string, string | number>) =>
        `${p.player} jogou sua última temporada e deixa a cena de vez. A vaga está aberta: o mercado é onde começa o próximo capítulo.`,
      coachRetireAnnounce: (p: Record<string, string | number>) =>
        `${p.coach} avisa a comissão que esta é sua última temporada no banco. Ele fica até o fim da temporada; o sucessor sai do mercado de treinadores.`,
      coachRetired: (p: Record<string, string | number>) =>
        `${p.coach} fez sua última temporada e se aposenta. O banco está vazio por enquanto: contrate um treinador no mercado antes do primeiro evento.`,
      // v2.0 (C1)
      sponsorBootcamp: (p: Record<string, string | number>) =>
        `Faz parte do contrato: a marca paga o bootcamp deste split. Ele já começou, sem custo, e a vantagem vale até o fim do split. ${
          Number(p.left) > 0
            ? `Restam ${p.left} nesta temporada, cada um começando com o seu split.`
            : `Essa é a cota desta temporada (${p.perSeason}); o próximo começa com a próxima temporada.`
        }`,
      coachContractExpiring: (p: Record<string, string | number>) =>
        `O contrato de ${p.coach} termina com esta temporada. Para ficar, ele pede ${p.wage} por semana (hoje ${p.old}). Renove na página de Treinadores antes do fim da temporada; se não renovar, ele sai na virada e não há multa.`,
      coachRenewed: (p: Record<string, string | number>) =>
        Number(p.raised)
          ? `${p.coach} assinou por mais ${p.seasons} temporadas. Ele evoluiu no cargo, e o salário acompanha: ${p.wage} por semana, antes ${p.old}.`
          : `${p.coach} assinou por mais ${p.seasons} temporadas com o mesmo salário, ${p.wage} por semana.`,
      coachLeft: (p: Record<string, string | number>) =>
        `O contrato de ${p.coach} acabou e não foi renovado. Não há multa. O elenco treina sem treinador até você contratar outro.`,
    },
  },

  // Scrims v0.2 — blocos de dia útil entre eventos. v0.3: agendáveis, escolha
  // de adversário, resultados visíveis.
  scrim: {
    live: "Scrim ao vivo",
    game: (n: number) => `Jogo ${n}`,
    schedule: "Terça e quarta",
    title: "Bloco de scrim",
    desc: "Uma MD5 de portas fechadas: reps de química e desenvolvimento leve. Dois blocos por semana.",
    vs: (opp: string) => `vs ${opp}`,
    run: "Rodar scrim",
    won: (opp: string, a: number, b: number) => `Scrim V ${a}-${b} vs ${opp}`,
    lost: (opp: string, a: number, b: number) => `Scrim D ${a}-${b} vs ${opp}`,
    usedUp: "Sem blocos de scrim restantes nesta semana",
    restDay: "As scrims acontecem na terça e na quarta",
    squadShort: "Sem scrim com menos de três jogadores: contrate um terceiro antes.",
    // v0.3 agendamento + resultados
    planTitle: "Parceiros de treino",
    planDesc: "Escolha o adversário e o dia: scrims agendadas rodam sozinhas e aparecem no calendário.",
    chooseOpponent: "Adversário",
    pickDay: "Dia",
    bookCta: "Agendar scrim",
    booked: (date: string, opp: string) => `Agendada: ${date} vs ${opp}`,
    upcoming: "Scrims agendadas",
    cancel: "Cancelar",
    benefit: "O que você ganha",
    projGain: (n: string) => `≈ +${n} OVR por titular`,
    projChem: "+ reps de química",
    fieldLevel: (n: number) => `Nível do treino ${n}`,
    strongerSide: "Adversário mais forte desenvolve mais rápido",
    results: "Scrims recentes",
    noResults: "Nenhuma scrim nesta temporada ainda.",
    gameLine: (scores: string) => `Jogos: ${scores}`,
    sameDay: "Vocês já treinaram contra esse time hoje.",
    // v2.0 (R29): três níveis de sparring, depois a lista completa
    tiers: { easier: "Mais fácil", even: "Parelho", harder: "Mais difícil" } as Record<string, string>,
    tierHint: {
      easier: "Reps de química e vitória provável: pouco XP.",
      even: "Um teste de verdade. XP padrão.",
      harder: "Sparring mais forte desenvolve mais rápido: espere perder.",
    } as Record<string, string>,
    moreOpponents: "Mais adversários",
    fewerOpponents: "Menos adversários",
  },

  calendar: {
    previousMonth: "Mês anterior",
    nextMonth: "Próximo mês",
    title: "Calendário",
    thisWeek: "Esta semana",
    today: "Hoje",
    preseason: "Pré-temporada",
    openWeek: "Semana livre",
    window: "Janela de transferências",
    worldsWindow: "Janela do Worlds",
    windowOpen: "Janela aberta",
    windowCloses: (n: number) =>
      n <= 0 ? "A janela fecha hoje" : n === 1 ? "A janela fecha amanhã" : `A janela fecha em ${n} dias`,
    regional: (n: number) => `Regional ${n}`,
    major: "Major",
    worlds: "Mundial",
    split: (n: number) => `Split ${n}`,
    registered: "Inscrito",
    notQualified: "Não classificado",
    spectate: "Ver resultados",
    done: "Encerrado",
    stakes: "Em jogo",
    prizePool: "Premiação",
    points: "Pontos da Temporada",
    field: "Chave",
    fieldQuality: "Nível do campo",
    enter: "Entrar",
    skip: "Passar",
    skipHint: "Passar mantém a semana para treinos (+25% de eficiência).",
    offerTitle: "Convite de torneio",
    seasonOverview: "Visão da temporada",
    // Visão por dia (v0.2)
    monthView: "Mês",
    agendaView: "Agenda",
    nextForYou: "Próximos para você",
    matchday: "Dia de jogo",
    payday: "Pagamento",
    trainingDay: "Treino",
    restDay: "Descanso",
    scrimDay: "Scrim",
    legend: "Legenda",
    advanceDay: "Avançar um dia",
    advanceToStop: (label: string) => `Continuar: ${label}`,
    seasonEnd: "Fim da temporada",
    showWorld: "Mostrar outras regiões",
    hideWorld: "Só a minha agenda",
    worldEvents: "Pelo mundo",
    // rc.36 (CAL-01, SUN-01/03)
    windowUntil: (date: string) => `Janela de transferências · até ${date}`,
    sundayAhead: "Começar o domingo no QG",
    follow: "Acompanhar",
  },

  squad: {
    title: "Elenco",
    starters: "Titulares",
    bench: "Banco",
    subSlot: "Substituto",
    coachSlot: "Coach",
    staffRow: "Staff & boosts",
    hire: "Contratar",
    emptySub: "Sem reserva. Se um titular ficar indisponível, o time não joga o evento. Reserva só assina na janela de transferências.",
    emptyCoach: "Um coach acelera o desenvolvimento e a preparação.",
    contracts: "Contratos",
    wage: "Salário",
    perWeek: (s: string) => `${s} / semana`,
    expires: (label: string) => `Termina ${label}`,
    expiring: "Contrato expirando",
    // rc.34 (UX-06b): o tempo que resta num contrato na última temporada, e a revisão antes da virada.
    weeksLeft: (n: number) => (n <= 0 ? "sai na virada" : n === 1 ? "1 semana restante" : `${n} semanas restantes`),
    reviewTitle: "Antes da nova temporada: contratos",
    reviewBody: (n: number) =>
      n === 1
        ? "1 contrato termina com esta temporada. Renove no Elenco, ou deixe acabar: ele sai na virada."
        : `${n} contratos terminam com esta temporada. Renove no Elenco, ou deixe acabar: eles saem na virada.`,
    reviewRenew: "Renovar no Elenco",
    reviewConfirm: (n: number) => (n === 1 ? "Deixar sair" : `Deixar os ${n} saírem`),
    reviewDone: "Revisado: eles saem na virada.",
    reviewHeld: "Uma decisão ainda espera no QG: responda antes da nova temporada.",
    renew: "Renovar",
    release: "Dispensar",
    releaseFee: (s: string) => `Rescisão: ${s}`,
    releaseConfirm: (name: string) => `Dispensar ${name}?`,
    releaseBody: "A rescisão é paga agora; o salário sai da folha.",
    makeStarter: "Promover a titular",
    makeSub: "Mover para o banco",
    swapPreview: (a: number, b: number) => `Rating do time ${a} → ${b}`,
    chemPreview: (a: number, b: number) => `Química ${a}% → ${b}%`,
    bestLineup: "Melhor escalação",
    stability: "Estabilidade do elenco",
    stabilityState: (used: number, max: number) => `Caras novas neste split: ${used}/${max}`,
    stabilityWarning: (pct: number, pts: number) =>
      `Escalar mais uma cara nova custa ${pct}% dos seus ${pts} Pontos da Temporada`,
    finalSeason: "Última temporada",
    squadFull: "Elenco cheio (3 titulares + 1 sub)",
    // rc.32 (M2, provisório): a regra da renovação e os dois valores.
    renewalTerms: "Termos da renovação",
    renewalRuleCapFloor: (cap: string, floorPct: number, jump: string) =>
      `Renovando um jogador seu: o aumento tem teto de ×${cap} o salário atual, nunca fica abaixo de ${floorPct}% do valor de mercado, e uma renovação sobe no máximo ×${jump}.`,
    renewalRuleFresh: "A renovação cobra o valor de mercado dele.",
    renewalMarketAsk: "Valor de mercado",
    renewalAsk: "Pedida na renovação",
    renewalBoundFresh: "Abaixo do teto: ele renova pelo valor de mercado.",
    renewalBoundCap: (cap: string) => `No teto de ×${cap} o salário atual.`,
    renewalBoundFloor: (floorPct: number) => `Segurado em ${floorPct}% do valor de mercado.`,
    renewalBoundJump: (jump: string) => `Segurado em ×${jump} o salário atual: o máximo que uma renovação sobe.`,
    renewalTitles: (pct: number) => `+${pct}% pelos títulos que ele ganhou com você nas últimas temporadas.`,
    renewalAmbition: (pct: number) => `+${pct}% de ambição: um craque num clube menor pede mais.`,
    renewalBlockbuster: (pct: number) => `+${pct}%: você recusou uma proposta bombástica por ele.`,
    // rc.37 (F1): a escada por tempo de clube e o teto dos bônus.
    renewalTenure: (seasons: number) =>
      `${seasons} temporadas com você: a renovação fica mais cara a cada ano.`,
    renewalPremiumCapped: (pct: number) =>
      `Bônus com teto: ambição, proposta bombástica recusada e títulos somam no máximo +${pct}%.`,
    renewalsTitle: "Contratos para renovar",
    renewalsEmpty: "Nenhum contrato termina nesta temporada.",
    renewalsGo: "Renovar no Elenco",
  },

  player: {
    age: (n: number) => `${n} anos`,
    potential: "Potencial",
    potBand: (min: number, max: number) => `POT ${min}-${max}`,
    potExact: (v: number) => `POT ${v}`,
    overall: "Overall",
    attributes: "Atributos",
    development: "Desenvolvimento",
    contract: "Contrato",
    history: "Histórico",
    scoutReport: "Relatório de olheiro",
    scoutCost: (s: string) => `Encomendar relatório · ${s}`,
    scoutDone: "Totalmente observado",
    scoutHint: "Estreita a faixa de potencial e revela a fase dele.",
    growthRoom: "Margem de evolução",
    // DEV-04 (rc.33): a fase dele na própria trajetória — "?" até um relatório de scout revelar.
    phase: { growing: "Em evolução", prime: "No auge", declining: "Em declínio", unknown: "Fase ?" },
    phaseUnknownHint: "Um relatório de scout revela se ele está em evolução, no auge ou em declínio.",
    // ECO-10 (rc.33): a parte do prêmio que o contrato dele garante.
    prizeShare: "Parte do prêmio",
    prizeSharePct: (pct: number) => `${pct}% dos prêmios de pódio`,
    // rc.34 (front I): um contrato sem parte do prêmio (abaixo do corte, um contrato de fundação, ou negociado a 0 %).
    prizeShareNone: "Sem parte do prêmio",
    prizeShareLegacy: (seats: number, regional: number, major: number, worlds: number) =>
      `Contrato antigo: os ${regional} / ${major} / ${worlds}% do time divididos por ${seats} (regional / Major / Worlds)`,
    projected: (v: string) => `Projeção: ${v} até o fim do split`,
    trainingFocusLabel: "Foco de treino",
    archetype: {
      mechanical: "Mecânico",
      anchor: "Âncora",
      playmaker: "Armador",
      icecold: "Sangue Frio",
      veteranmind: "Mente Veterana",
      allround: "Completo",
    },
    archetypeHint: {
      mechanical: "Teto altíssimo, piso instável.",
      anchor: "Segura o segundo poste. Vence jogo feio.",
      playmaker: "Cria para todo mundo. Lê o campo primeiro.",
      icecold: "Quer o jogo decisivo.",
      veteranmind: "Mãos mais lentas, cérebro mais rápido.",
      allround: "Sem buracos no kit.",
    },
    fictionalTag: "Jogador da simulação",
  },

  training: {
    weekSummary: "Evolução do elenco neste ciclo",
    weekChemistry: "Entrosamento",
    effectDescription: {
      offense: "Cria pressão e oportunidades de gol ao longo de cada jogo.",
      defense: "Mantém o time competitivo ao conter o adversário em cada jogo.",
      mechanics: "Aumenta a chance de uma jogada excepcional que pode decidir o jogo.",
      consistency: "Reduz o impacto de uma atuação ruim, sem eliminar toda a variação.",
      experience: "Acrescenta controle e força ao time nas partidas dos playoffs.",
      clutch: "Acrescenta força no jogo decisivo da série, quando a eliminação está em disputa.",
    } as Record<string, string>,
    weekScrims: "Scrims da semana",
    weekScrimsEmpty: "Nenhuma scrim registrada nesta semana ainda.",
    title: "Treinos",
    autoTrain: "Delegar ao coach",
    manageMyself: "Quero cuidar disso",
    focus: "Foco",
    balanced: "Equilibrado",
    auto: "Auto",
    coachEffect: (name: string, pct: number) => `Coach ${name}: ${pct > 0 ? "+" : ""}${pct}% de eficiência`,
    noCoach: "Sem coach: o desenvolvimento roda abaixo do ritmo.",
    facilityEffect: (pct: number) => `Equipamentos: +${pct}% de eficiência`,
    projection: (v: string) => `+${v} OVR neste split`,
    matchXpHint: "Jogar contra campos fortes desenvolve mais que qualquer treino.",
    report: (delta: string) => `Relatório de treinos: elenco ${delta} OVR`,
    // v0.2 — focos com identidade, intensidade, ritmo semanal
    weeklyPlan: "Plano semanal",
    weeklyPlanHint: "Sessões de segunda a sexta. Fim de semana é dia de jogo.",
    perWeekOverall: (v: string) => `+${v} OVR / semana`,
    perWeekOffset: (v: string, stat: string) => `+${v} ${stat} / semana`,
    focusHintBalanced: "Crescimento puro de overall: nada afiado.",
    focusHintAttr: "Troca uma fatia do crescimento de overall para afiar um atributo.",
    focusHintAuto: "O coach escolhe a ênfase da semana: quase ótimo, sem esforço.",
    intensity: "Intensidade",
    intensityLight: "Leve",
    intensityNormal: "Normal",
    intensityHeavy: "Pesada",
    intensityLightHint: "-40% de desenvolvimento, zero risco de fadiga.",
    intensityNormalHint: "O bloco padrão.",
    intensityHeavyHint: "+35% de desenvolvimento: adiciona um pequeno risco (avisado) de ausência antes de eventos.",
    fatigueWarning: "Sessões pesadas aumentam o risco de ausência pré-evento",
    sessionToday: "Sessão de hoje",
    noSessionToday: "Sem sessão hoje",
    // rc.34 (DEV-03 §4b): o motor treina a semana comprometida com meia carga (matchPrepShare) — o texto dizia que pausava.
    matchPrepWeek: "Semana de jogo: sessões com meia carga; o evento paga XP de partida por cima",
    // v2.0 training rework (R27–R29)
    drillTitle: "Treino da semana",
    drillHint: "Um treino coletivo por semana: o elenco todo evolui no atributo escolhido.",
    drillNone: "Sem treino definido, as sessões seguem o plano base.",
    drillByCoach: (name: string) => `Escolhido pelo coach ${name}`,
    drillEffect: (offset: string, stats: string, pct: number) => `+${offset} ${stats} / semana para o elenco inteiro · +${pct}% de overall`,
    drillClear: "Sem treino",
    drills: {
      "mechanics-lab": "Laboratório de mecânica",
      rotations: "Rotações",
      "set-plays": "Jogadas ensaiadas",
      "film-room": "Sala de vídeo",
      "clutch-sets": "Séries de clutch",
    } as Record<string, string>,
    drillsDesc: {
      "mechanics-lab": "Controle aéreo, flip resets, velocidade: o atributo do high roll.",
      rotations: "Disciplina no back-post e shadow: defesa.",
      "set-plays": "Kickoffs, passes, pressão: ataque.",
      "film-room": "Revisão de VOD e cenários: consistência e experiência.",
      "clutch-sets": "Cenários de jogo 7 sob pressão: clutch.",
    } as Record<string, string>,
    growth: "Evolução",
    nextPoint: (ovr: number) => `Próximo: ${ovr} OVR`,
    etaDays: (days: number) => (days === 1 ? "≈ 1 dia de treino" : `≈ ${days} dias de treino`),
    etaNone: "Parado: no teto do período ou no potencial",
    etaAtPotential: "No potencial, não há mais o que aprender aqui",
    capLine: (split: string, splitMax: number, season: string, seasonMax: number) =>
      `Neste split +${split} de ${splitMax} · temporada +${season} de ${seasonMax}`,
    // rc.32 (DEV-01): o contrato de evolução tem só o teto da temporada, um auge e um declínio.
    capLineSeason: (season: string, seasonMax: number) => `Nesta temporada +${season} de ${seasonMax}`,
    etaAtPeak: "No auge: ele segura esse nível por enquanto",
    declineLine: (perWeek: string) => `Passou do auge: cerca de −${perWeek} OVR por semana`,
    effectsTitle: "O que seus atributos fazem",
    effectsHint: "Seu elenco atual e os momentos em que cada atributo faz a diferença.",
    effectBaseline: (n: number) => `Com o atributo abaixo de ${n}, o efeito fica negativo. O overall ainda é o que mais pesa.`,
    effectWhen: {
      always: "todo jogo",
      deciding: "jogos decisivos",
      playoffs: "jogos de playoff",
      badRolls: "ameniza rolls ruins",
      proc: "chance de high roll",
    } as Record<string, string>,
    effectRating: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} de rating`,
    effectPct: (v: number) => `${v}%`,
    // rc.34 (DEV-03, TRAINING-CONTRACT): um pacote de treino por período.
    // rc.35 (front T, Miguel): o ciclo de treino simplificado — objetivo + intensidade + scrims.
    cycle: {
      restart: "Reiniciar o mesmo plano",
      title: "Ciclo de treino",
      cycleOf: (n: number, count: number) => `Ciclo ${n} de ${count}`,
      dayOf: (day: number, len: number) => `Dia ${day} de ${len}`,
      daysLeft: (n: number) => (n === 1 ? "falta 1 dia" : `faltam ${n} dias`),
      endsOn: (date: string) => `Termina ${date}`,
      running: "Em andamento",
      by: { coach: "Plano do coach", user: "Seu plano", auto: "Plano automático", base: "Evolução base" } as Record<string, string>,
      baseLine: "Sem plano: todos evoluem no ritmo base. Nunca é penalidade.",
      controllerCoach: (name: string) => `${name} planeja e inicia cada ciclo. Você pode ajustar.`,
      // rc.36 (front T2): um coach contratado que não planeja mais — ele só recomenda.
      controllerCoachOff: (name: string) => `Você inicia cada ciclo. O plano de ${name} vem marcado como Recomendado.`,
      controller: {
        auto: "Fácil: o melhor plano vem marcado como Recomendado. Inicie quando quiser.",
        recommend: "Normal: a opção mais eficaz de cada etapa vem marcada como Recomendada.",
        manual: "Difícil: você escolhe tudo. Sem recomendação.",
      } as Record<string, string>,
      steps: { objective: "Objetivo", focus: "Foco", intensity: "Intensidade", scrims: "Scrims" } as Record<string, string>,
      // rc.36 (front T2, Miguel): Evoluir / Entrosar / Recuperar.
      objectives: { development: "Evoluir", preparation: "Entrosar", recovery: "Recuperar" } as Record<string, string>,
      objectiveEffect: {
        development: "Evolução mais rápida rumo ao auge de cada jogador.",
        preparation: "Os scrims entrosam o elenco mais rápido, com um pouco de evolução.",
        recovery: "Menos desgaste. Veteranos seguram o nível por mais tempo.",
      } as Record<string, string>,
      // rc.36 (front T2, Miguel): o foco do elenco volta a ser uma escolha — um por plano.
      focuses: {
        balanced: "Equilibrado",
        "mechanics-lab": "Mecânica",
        rotations: "Defesa",
        "set-plays": "Ataque",
        "film-room": "Consistência",
        "clutch-sets": "Clutch",
      } as Record<string, string>,
      focusBalanced: "Só evolução geral. Nada afiado.",
      focusEffect: (stats: string, perWeek: string) => `+${perWeek} de ${stats} por semana, para todos.`,
      focusHint: "Um atributo que todos afiam. Não custa evolução geral.",
      scrimsHint: "Só treino: sem pontos, prêmios ou reputação.",
      intensities: { light: "Leve", normal: "Normal", heavy: "Pesada" } as Record<string, string>,
      intensityEffect: {
        light: "Metade do ganho, 40% menos desgaste.",
        normal: "O ganho padrão. Sem risco extra.",
        heavy: "1,5× o ganho. Aumenta o risco de desfalque.",
      } as Record<string, string>,
      scrimChoices: { off: "Nenhum", easy: "Fácil", even: "Parelho", hard: "Difícil" } as Record<string, string>,
      scrimEffect: {
        off: "Sem scrims, sem desgaste de scrim.",
        easy: "Confiança, pouco desgaste.",
        even: "O maior entrosamento.",
        hard: "O maior aprendizado. Aumenta o risco de desfalque.",
      } as Record<string, string>,
      // rc.36 (front T2): nada roda até um plano ser escolhido e iniciado.
      pickTitle: "Escolha o plano deste ciclo",
      pickHint: "Nada roda até você iniciar um plano. Enquanto isso, todos evoluem no ritmo base.",
      idle: "Nenhum plano rodando",
      idleLine: "Seu elenco evolui no ritmo base. Inicie um plano para acelerar.",
      choosePlan: "Escolher um plano",
      start: "Iniciar treino",
      applyChanges: "Aplicar mudanças",
      pickAll: "Escolha uma opção em cada etapa para iniciar.",
      useRecommended: "Usar o plano recomendado",
      sameAgain: "Mesmo plano do ciclo passado",
      runsTo: (date: string, days: number) => `Vai até ${date} · ${days === 1 ? "1 dia" : `${days} dias`}`,
      fromTomorrow: "O treino de hoje já rolou: começa amanhã.",
      startsTomorrow: "Começa amanhã",
      promised: (v: string) => `+${v} OVR prometidos`,
      promiseTitle: "Ganho do ciclo",
      promiseLine: (paid: string, total: string) => `+${paid} de +${total} OVR`,
      onCompletion: (v: string) => `+${v} chegam quando o ciclo terminar`,
      legend: { paid: "Conquistado", toCome: "A caminho", completion: "Na conclusão" } as Record<string, string>,
      adjustHint: "Ajustar mantém o que já foi conquistado. A parte da conclusão ainda chega no fim.",
      coachPlans: (name: string) => `${name} planeja cada ciclo`,
      coachPlansHint: "Desligado: ele só marca o plano dele como Recomendado, e você inicia cada ciclo.",
      riskLine: (pts: string) => `Risco de desfalque antes de cada evento: +${pts} pts`,
      scrimsAWeek: (n: number) => `${n} por semana · só treino`,
      recommended: "Recomendado",
      expected: "Resultado esperado",
      expectedGain: (v: string) => `+${v} OVR`,
      expectedHint: "Média dos titulares até o fim do ciclo. Séries oficiais somam mais.",
      perPlayer: "Por jogador",
      risk: (pts: string) => `+${pts} pts de risco de desfalque`,
      noRisk: "Sem risco extra de desfalque",
      apply: "Aplicar plano",
      adjust: "Ajustar plano",
      useBase: "Usar a base",
      cancel: "Cancelar",
      keepPlan: "Manter meu plano no próximo ciclo",
      keepPlanHint: "Desligado: o próximo ciclo começa na base.",
      progress: "Neste ciclo até agora",
      gained: (v: string) => `+${v} OVR em média`,
      scrimsDone: (done: number, planned: number) => `${done} de ${planned} scrims`,
      record: (w: number, l: number) => `${w}–${l}`,
      lastCycle: "Último ciclo",
      lastNone: "Nenhum ciclo concluído ainda",
      history: "Ciclos anteriores",
      historyEmpty: "Seu primeiro relatório chega quando este ciclo terminar.",
      noCoach: "Sem coach: um plano rende pela metade",
      hireCoach: "Contratar coach",
      coachBoost: (pct: number) => `+${pct}% do seu coach`,
      sessions: "Sessões",
      scrims: "Scrims",
      series: "Séries",
      chemistry: "Entrosamento",
      wear: "Desgaste",
      report: {
        kicker: "Ciclo concluído",
        title: (n: number, season: string) => `Ciclo ${n} · ${season}`,
        avg: "Média do elenco",
        best: "Maior ganho",
        plan: "Plano",
        close: "Continuar",
        open: "Abrir treino",
        // rc.36 (front T2): o relatório mais bonito.
        completion: (v: string) => `+${v} chegaram na conclusão`,
        completionShort: (v: string) => `+${v} no fim`,
        planNext: "Alterar para o próximo ciclo",
        dontShowAgain: "Não mostrar novamente os resultados de ciclo automaticamente",
        showAutomatic: "Mostrar resultados de ciclo automaticamente",
        historyHint: "Os resultados continuam disponíveis no histórico de treinos.",
        coachNext: (name: string) => `${name} já iniciou o próximo ciclo.`,
        joined: "Entrou no meio do ciclo",
        players: "Jogador por jogador",
      },
      coach: {
        quality: "Qualidade",
        experience: "Experiência",
        specialty: "Especialidade",
        qualityEffect: (pct: number) => `${pct}% de um plano rende`,
        experienceEffect: (seasons: number) => (seasons === 1 ? "1 temporada" : `${seasons} temporadas`),
        experienceHint: (pct: number, wear: number) => `O plano dele rende ${pct}% · −${wear}% de desgaste`,
        specialtyEffect: (pct: number) => `+${pct}% neste objetivo`,
        expected: "Por titular, próximo ciclo",
        vsNow: (v: string) => `${v} vs agora`,
        same: "Igual ao atual",
        wage: "Salário",
        exPro: "Ex-pro",
        proCoach: "Coach profissional",
        staff: "Coach da casa",
      },
    },
    plan: {
      title: "Plano de treino",
      periodOf: (n: number, count: number) => `Período ${n} de ${count}`,
      dayOf: (day: number, len: number) => `Dia ${day} de ${len}`,
      daysLeft: (n: number) => (n === 1 ? "falta 1 dia" : `faltam ${n} dias`),
      runsTo: (date: string, days: number) => `Vai até ${date} · ${days === 1 ? "1 dia" : `${days} dias`}`,
      base: "Crescimento base",
      baseHint: "Sem pacote: os jogadores evoluem com os dias de treino e as séries que jogam.",
      by: { coach: "Montado pelo coach", user: "Montado por você", base: "Sem pacote" } as Record<string, string>,
      objective: "Objetivo",
      objectives: { development: "Desenvolvimento", preparation: "Preparação competitiva", recovery: "Recuperação" } as Record<string, string>,
      objectiveHint: {
        development: "Crescimento mais rápido rumo ao pico esperado de cada jogador, e os atributos do foco.",
        preparation: "Química e scrims mais afiados para os eventos do período: pouco crescimento extra.",
        recovery: "Menos desgaste, e quem passou do pico segura o nível por mais tempo.",
      } as Record<string, string>,
      focus: "Foco do elenco",
      balanced: "Equilibrado",
      focusHint: (offset: string) => `Quem segue o foco cresce os atributos dele +${offset} por semana. Equilibrado não molda nada.`,
      workload: "Carga",
      workloads: { light: "Leve", normal: "Normal", heavy: "Pesada" } as Record<string, string>,
      workloadHint: {
        light: "Metade do bônus, 40% menos desgaste.",
        normal: "A carga padrão.",
        heavy: "1,5× o bônus, +1 de desgaste por semana.",
      } as Record<string, string>,
      scrims: "Scrims",
      scrimsPerWeek: (n: number) => (n === 0 ? "Nenhum" : n === 1 ? "1 por semana" : `${n} por semana`),
      scrimDaysHint: "Terça e quinta (quarta para um terceiro), fora dos dias de jogo. Só treino: sem pontos, prêmios ou reputação.",
      levels: { easy: "Fácil", even: "Equilibrado", hard: "Difícil", auto: "O coach escolhe" } as Record<string, string>,
      levelHint: {
        easy: "Confiança (+consistência) e menos desgaste; pouco crescimento.",
        even: "Sinergia: a maior química, um retorno moderado.",
        hard: "O maior aprendizado, mais desgaste e risco.",
        auto: "O nível que o objetivo pede.",
      } as Record<string, string>,
      tweaks: "Ajustes por jogador",
      tweaksHint: "Opcional, só os jogadores que fogem do plano do elenco.",
      followSquad: "Segue o elenco",
      rest: "Descanso",
      restHint: "Treina na base, sem scrims, sem desgaste.",
      tweakFocus: (stat: string) => `Foco próprio: ${stat}`,
      tweakWorkload: (w: string) => `carga ${w.toLowerCase()}`,
      ownFocus: "Foco próprio",
      ownLoad: "Carga própria",
      carryHint: "O seu antigo foco e intensidade por jogador entram como ajustes.",
      projection: "O que este pacote faz",
      projectionHint: "Lido do motor que o executa: sessões e scrims até o fim do período. As séries oficiais vêm por cima.",
      perPlayer: (gain: string) => `+${gain}`,
      startersAvg: (gain: string) => `Titulares ≈ +${gain} OVR neste período`,
      wearLine: (wear: string, pts: string) => `Desgaste ${wear} · +${pts} pts de risco de ausência antes de cada evento`,
      noWear: "Sem desgaste: sem risco extra de ausência",
      daysLine: (sessions: number, scrims: number) =>
        `${sessions === 1 ? "1 sessão" : `${sessions} sessões`} · ${scrims === 1 ? "1 scrim" : `${scrims} scrims`}`,
      apply: "Aplicar",
      applyHint: (date: string) => `Vale de ${date} até o fim do período, e se repete com "Repetir" ligado.`,
      useProposal: "Carregar o plano do coach",
      keepBase: "Manter a base",
      edit: "Ajustar",
      cancel: "Cancelar",
      mode: "Quem decide",
      repeat: "Repetir até eu mudar",
      repeatHint: "O pacote roda de novo no próximo período.",
      proposalTitle: (name: string) => `O plano de ${name} para este período`,
      proposalReason: {
        default: "Desenvolvimento por padrão.",
        event: "Um Major ou o Mundial cai neste período: preparação primeiro.",
        wear: "O desgaste foi alto no último período: recuperação primeiro.",
      } as Record<string, string>,
      approve: "Aprovar",
      decisionLine: "O relógio espera a sua resposta.",
      coachLine: (name: string, pct: number) => `${name} · +${pct}% neste pacote`,
      coachless: "Sem coach: um pacote rende metade.",
      planQuality: (pct: number) => `Conduzindo sozinho, o plano dele rende ${pct}%`,
      progress: "Este período até aqui",
      soFar: (sessions: string, scrims: string, series: string) => `Sessões +${sessions} · scrims +${scrims} · séries +${series}`,
      scrimRecord: (w: number, l: number) => `Scrims ${w}–${l}`,
      history: "Relatórios de período",
      historyEmpty: "Nenhum período fechado ainda: o primeiro relatório chega quando o próximo período começar.",
      summaryTitle: (n: number, season: string) => `Período ${n} · ${season}`,
      summaryAvg: (avg: string) => `Elenco ${avg} em média`,
      seriesPlayed: (n: number) => (n === 1 ? "1 série" : `${n} séries`),
      coachShare: (gain: string) => `coach +${gain}`,
      wear: (w: string) => `desgaste ${w}`,
      unavailable: "vetado uma vez",
      joined: "entrou no meio do período",
      chemistry: (a: number, b: number) => `Química ${a}% → ${b}%`,
      coachDays: (name: string, days: number, gain: string) => `${name}: ${days === 1 ? "1 dia" : `${days} dias`}, +${gain}`,
      next: (o: string) => `Próximo período: ${o}`,
      notes: {
        joined: (p: Record<string, string | number>) => `${p.player} entrou no plano`,
        coachHired: (p: Record<string, string | number>) => `${p.coach} assumiu o plano`,
        coachFired: (p: Record<string, string | number>) => `${p.coach} saiu: o plano seguiu no ritmo sem coach`,
        objectiveChange: () => "O objetivo mudou no meio do período",
        // rc.36 (front T2): um ciclo interrompido antes do fim perde o ganho retido.
        cycleStopped: (p: Record<string, string | number>) => `O ciclo parou antes do fim: +${p.lost} retidos foram perdidos`,
        coachEvent: () => "O coach planejou preparação para o grande evento do período",
        coachWear: () => "O coach planejou recuperação depois de um período pesado",
      } as Record<string, (p: Record<string, string | number>) => string>,
      wearBand: { low: "desgaste baixo", mid: "desgaste moderado", high: "desgaste alto" } as Record<string, string>,
      squadGrowth: "Crescimento do elenco",
    },
  },

  market: {
    title: "Mercado",
    freeAgents: "Agentes livres",
    contracted: "Sob contrato",
    myDeals: "Minhas negociações",
    tabsShort: { free: "Livres", contracted: "Contrato", coaches: "Coaches", deals: "Negócios" },
    windowClosed: "Mercado fechado",
    windowClosedHint: (label: string) => `A janela de transferências abre ${label}`,
    scoutingOpen: "A observação segue aberta entre janelas.",
    // RTW-05 (rc.33): um elenco com menos de três contrata um agente livre para a vaga vazia, com ou sem janela.
    emptySeatOpen: "Seu elenco tem menos de três: um agente livre pode ocupar a vaga vazia hoje, com ou sem janela.",
    emptySeatCheapest: (name: string, wage: string) =>
      `Sem dinheiro? ${name} (${wage} / semana) é o agente livre mais barato para a vaga.`,
    fee: "Taxa de transferência",
    signingBonus: "Luvas",
    freeAgentTag: "Agente livre",
    ask: "Pedida",
    whyPrice: "Por que esse preço",
    // Os efeitos no salário mantêm a unidade: por split (a linha semanal os arredonda).
    whyPriceWages: "Efeitos no salário · por split",
    perSplit: (s: string) => `${s} / split`,
    oneOff: (s: string) => `${s} pagamento único`,
    factor: {
      overall: "Rating",
      age: "Idade",
      potential: "Potencial",
      repPremium: "Prêmio de estrela",
      length: "Duração do contrato",
      contract: "Sob contrato",
    },
    seasons: (n: number) => (n === 1 ? "1 temporada" : `${n} temporadas`),
    starter: "Titular",
    sub: "Reserva",
    signCta: "Contratar",
    offerSent: "Negócio registrado: resolve no próximo avanço.",
    signed: (name: string) => `${name} assina com a org`,
    rejected: (name: string) => `${name} recusou os termos`,
    recommendedShelf: "Contratações recomendadas",
    recommendedWhy: (reason: string) => `Encaixe: ${reason}`,
    affordable: "Cabe no caixa",
    incomingBid: "Proposta recebida",
    bidFrom: (org: string) => `Proposta de ${org}`,
    accept: "Aceitar",
    decline: "Recusar",
    blockbuster: "Bombástica",
    // rc.33 (UX-07): a Bombástica explicada numa frase, só numa proposta Bombástica
    // (com o custo de recusar — CAREER_SALARY.blockbusterRefusalRenewalMult).
    blockbusterWhat: (org: string, mult: string, pct: number) =>
      `Proposta Bombástica: ${org} paga ×${mult.replace(".", ",")} o valor de mercado dele; se você recusar, ele fica, mas pede ${pct}% a mais na próxima renovação.`,
    consequences: "Depois deste negócio",
    balanceAfter: (s: string) => `Saldo após: ${s}`,
    // rc.32 (M4, provisório): o fôlego que a contratação deixa.
    runwayAfter: (weeks: number | null) =>
      weeks === null
        ? "Fôlego depois: as contas seguem no azul"
        : `Fôlego depois: ${weeks === 1 ? "1 semana" : `${weeks} semanas`} com a nova queima`,
    // ECO-02 (R46): uma venda com o Investidor em aberto — a parte dele na taxa.
    saleBackerRepaid: (s: string) => `Abatido do empréstimo emergencial: ${s}`,
    // rc.37 F2 (pacote 3): a venda de emergência — o selo da proposta, o que ela é, e o que a venda deixa.
    emergencyBadge: "Proposta de emergência",
    emergencyWhat: (days: number) =>
      `Com as contas no vermelho, este comprador oferece abaixo do mercado. Vale por ${days} dias ou até a janela fechar.`,
    // rc.37 F2 (Miguel, 05/11): o selo de valor de mercado nas propostas de emergência e bombásticas.
    belowValue: (pct: number | null) => (pct === null ? "Abaixo do valor de mercado" : `Abaixo do valor de mercado · ${pct}%`),
    aboveValue: (pct: number | null) => (pct === null ? "Acima do valor de mercado" : `Acima do valor de mercado · ${pct}%`),
    saleLeaves: (player: string, org: string, n: number) => `${player} vai para a ${org}: o elenco fica com ${n}.`,
    saleShortSeat: "Uma vaga de titular aberta: um agente livre pode ocupá-la em qualquer dia, pelo Mercado.",
    saleNetAfterDebt: (net: string, fee: string, share: string) => `Entram ${net}: ${fee} menos a parte do banco, ${share}.`,
    saleNetFull: (net: string) => `Entram ${net}, sem descontos.`,
    saleWagesFreed: (s: string) => `Salário liberado: ${s} por semana.`,
    // ECO-03 (R47): a vaga é definida depois da contratação e nunca muda o preço.
    slotLabel: "Vaga no elenco",
    slotStarter: "Assume uma vaga aberta no trio titular.",
    slotReserve: "Entra como reserva. Promova-o na tela de Elenco quando quiser: o contrato não muda.",
    samePrice: "Mesmo preço de um titular.",
    // rc.33 (UX-07): elenco cheio só avisa e leva ao Elenco; a contratação espera uma vaga livre.
    squadFullWarn: (cap: number) =>
      `Seu elenco está cheio (${cap} de ${cap}). Dispense ou venda um jogador na tela de Elenco e depois contrate.`,
    toSquad: "Ir para o Elenco",
    // DEV-02 (R48): uma contratação cuja temporada atual tem de ser a última.
    finalSeasonDeal: "Última temporada: ele se aposenta ao fim desta temporada, só contrato de 1 temporada.",
    payrollWeek: (now: string, after: string) => `Folha: ${now} → ${after} / semana`,
    coachEffects: "O que este coach faz",
    // rc.34 (DEV-03 T4): o efeito dele chega pelo pacote do período — sem pacote = a base, com ou sem coach.
    coachTraining: (pct: number) => `+${pct}% num pacote de Desenvolvimento`,
    coachRating: (n: number) => `+${n} de rating do time em toda série`,
    coachNoneEffects: (pct: number) =>
      `Sem coach, um pacote de treino rende metade (+${pct}% em Desenvolvimento).`,
    // rc.34 (DEV-03 T4): o card de contratação — três atributos, cada um com o seu efeito.
    coachQuality: (q: number) => `Qualidade ${q}`,
    coachQualityEffect: (pct: number) => `Eficiência de foco ${pct}%: a parte do efeito do pacote que chega`,
    coachExperience: (n: number) => (n === 1 ? "1 temporada" : `${n} temporadas`),
    coachExperienceEffect: (pct: number, wear: number) =>
      `Qualidade de plano ${pct}% quando conduz sozinho${wear > 0 ? ` · desgaste −${wear}%` : ""}`,
    coachSpecialty: (o: string) => `Especialidade: ${o}`,
    coachSpecialtyEffect: (o: string, pct: number) => `+${pct}% em pacotes de ${o}`,
    coachPackage: (o: string, pct: number) => `Seu pacote de ${o}: +${pct}% com ele`,
    coachImpact: (gain: string) => `≈ ${gain} OVR por titular no próximo período vs. o seu cenário atual`,
    coachImpactSame: "Mais ou menos o mesmo que o seu cenário atual no próximo período",
    coachBestCard: (card: number) => `Melhor carta como jogador: ${card}`,
    coachGrows: (ceiling: number) => `Evolui a cada temporada como coach (até ${ceiling})`,
    coachCompare: "Comparar",
    shopHim: "Colocar na vitrine",
    shopHimHint: "Sinaliza disponibilidade: espere propostas na próxima janela.",
    quickFlipWarning: "Contratado há pouco: vende com deságio.",
    // v0.2 — mercado de coaches + ferramentas de busca
    coaches: "Coaches",
    coachRealTag: "Ex-pro",
    coachProTag: "Coach profissional",
    coachGenTag: "Coach",
    coachBonus: (stat: string) => `Reforça ${stat}`,
    hireCoach: "Contratar",
    currentCoach: "Coach atual",
    replaceWarning: "Trocar de coach paga um split de rescisão.",
    searchPlaceholder: "Buscar jogadores…",
    sortBy: "Ordenar",
    sortOvr: "Overall",
    sortAge: "Idade",
    sortPrice: "Preço",
    sortPot: "Potencial",
    sortAsc: "Menor → maior",
    sortDesc: "Maior → menor",
    filterRegion: "Região",
    allRegions: "Todas as regiões",
    // rc.33 (UX-07): só os jogadores que a reputação da org consegue contratar (a regra que a contratação confere).
    filterAvailable: "Disponíveis",
    filterSignable: "Contratáveis com minha reputação",
    filterSignableCount: (n: number) => `${n} ${n === 1 ? "jogador" : "jogadores"} ao alcance`,
    /** rc.35 (front C): uma org o contratou nesta janela. */
    justSignedTag: "Recém-contratado",
    viewSheet: "Ver ficha",
    noResults: "Nenhum jogador com esses filtros.",
    dealsEmpty: "Nenhuma negociação ativa. Propostas chegam aqui com a janela aberta.",
    // v0.3 contratações travadas por reputação (cadeado visível)
    lockedAtRep: (rep: number) => `Assina com ${rep} de reputação`,
    lockedHint: "Jogadores desse nível ainda não topam a org: a reputação abre essa porta.",
    coachLockedAt: (rep: number) => `Contratar coach desbloqueia com ${rep} de reputação`,
    exProLockedAt: (rep: number) => `Coaches ex-pro desbloqueiam com ${rep} de reputação`,
    // rc.33 (ECO-10 + ECO-11): a negociação do contrato — duas alavancas, a faixa à vista, uma resposta.
    negotiation: {
      title: "Negociação do contrato",
      // rc.35 (front N): a negociação visual — uma terceira alavanca e a chance.
      bonus: "Luvas",
      bonusAsk: (amount: string) => `Pede ${amount}`,
      bonusDown: "Baixar as luvas",
      bonusUp: "Subir as luvas",
      shareAskNone: "Não pede",
      odds: "Chance de assinar",
      oddsSure: "Certo",
      perWeek: "/ semana",
      fullAsk: "Pagar a pedida",
      wage: "Salário semanal",
      share: "Parte do prêmio",
      shareAsk: (pct: number) => `Ele pede ${pct}%`,
      wageDown: "Baixar o salário semanal",
      wageUp: "Subir o salário semanal",
      shareDown: "Baixar a parte do prêmio",
      shareUp: "Subir a parte do prêmio",
      // rc.34 (front I): por que uma alavanca para, embaixo do botão que ela trava (contract.TalkLimits).
      why: {
        floor: "Piso dele",
        minimum: "Mínimo da liga",
        ask: "Pedida cheia",
        shareLeast: "O mínimo que ele aceita",
        shareMost: "O máximo que ele aceita",
        shareMinimum: "Salário no mínimo",
        noShare: "Sem parte",
        // rc.36 (front S2): os limites das luvas.
        noBonus: "Sem luvas",
        bonusMost: "O máximo da oferta",
      },
      // rc.36 (front S2, Miguel sobre a rc.35): três grupos — sua oferta, a posição dele, enviar — e a resposta só depois do envio.
      groupOffer: "Sua oferta",
      groupPosition: "A posição dele",
      length: "Duração",
      asks: (wage: string, pct: number, bonus: string | null) =>
        `Pede ${wage} / sem.${pct > 0 ? ` · ${pct}%` : ""}${bonus ? ` · ${bonus}` : ""}`,
      worthTitle: "Quanto sua oferta vale para ele",
      sureFrom: (wage: string) => `Assina com certeza a partir de ${wage}`,
      askMark: (wage: string) => `Pedida ${wage}`,
      effectsTitle: "O que move a resposta dele",
      effectShare: (pts: number) => `Parte ${pts > 0 ? "+" : "−"}${Math.abs(pts)} pt${Math.abs(pts) === 1 ? "" : "s"}`,
      effectBonus: (delta: string) => `Luvas ${delta}`,
      effectLength: (seasons: number) => `Contrato de ${seasons} temporada${seasons === 1 ? "" : "s"}`,
      effectRefusals: (n: number) => (n === 1 ? "1 oferta recusada" : `${n} ofertas recusadas`),
      effectWeekly: (amount: string) => `${amount} / sem.`,
      send: "Enviar oferta",
      sendHint: "Ele responde quando você enviar. Uma recusa aumenta o que ele exige.",
      refused: (wage: string) => `Ele recusou ${wage} / semana.`,
      nowWants: (wage: string) => `Com essa parte e essas luvas, agora ele assina com certeza a partir de ${wage} / semana.`,
      meetPrice: "Atender a pedida",
    },
    errors: {
      bootcampEventActive: "Conclua o evento em andamento antes de comprar um bootcamp. O time do evento já está congelado.",
      windowClosed: "A janela de transferências está fechada.",
      alreadySigned: "Já está no elenco.",
      squadFull: "Elenco cheio: dispense ou venda antes.",
      unavailable: "Jogador indisponível.",
      funds: "Caixa insuficiente para este negócio.",
      // rc.36 (front S2, rc.35-(d)): sem dinheiro, a vaga vazia só é coberta com as luvas que ele pede.
      fundsSeatBonus: "Sem dinheiro, a vaga vazia só é coberta com as luvas que ele pede: baixe as luvas.",
      loanActive: "Sem transferências com taxa enquanto houver dívida do empréstimo emergencial.",
      bankActive: "Um empréstimo bancário por vez: quite o atual primeiro.",
      bankBacker: "O banco não faz outro empréstimo enquanto o emergencial estiver aberto: quite esse primeiro.",
      bankNegative: "O caixa está negativo demais para um empréstimo comum. Resta só o empréstimo emergencial.",
      bankAmount: "Informe um valor válido.",
      bankLimit: "Acima do que o banco oferece para a sua reputação.",
      unknown: "Esse negócio não está mais disponível.",
      locked: "Bloqueado por enquanto.",
      maxed: "Já está no máximo.",
      used: "Já utilizado.",
      restDay: "Não em dia de descanso.",
      squadShort: "Sem scrim com menos de três jogadores: contrate um terceiro antes.",
      blocked: "Agora não.",
      none: "Nada a fazer.",
      invalid: "Seleção inválida.",
      contractedRep: "A contratação de jogadores sob contrato libera na reputação 20.",
      repGate: "A reputação da org ainda é baixa para um jogador desse nível.",
      /** rc.35 (front C): uma org o contratou nesta janela. */
      justSigned: "Ele acabou de assinar com outra org nesta janela: tente na próxima.",
      exProGate: "Coaches ex-pro e profissionais pedem mais reputação: a escada de progressão mostra quando.",
      // rc.33 (ECO-11): uma oferta abaixo do piso dele — a ficha mostra a contraproposta.
      negotiationCounter: "Isso está abaixo do piso dele: aceite a contraproposta ou suba a oferta.",
      sameDay: "Vocês já treinaram contra esse time hoje.",
      rosterLocked: "Mudanças no elenco só depois do fim do evento.",
      /** DEV-02 (R48): a idade mínima para competir. */
      tooYoung: "Jovem demais para competir: jogadores assinam a partir dos 13 anos.",
      /** rc.32 (M4, provisório): a trava do Investidor sobre compromissos que encurtam o fôlego. */
      loanRunway: "Bloqueado enquanto houver dívida emergencial. Quite o empréstimo ou libere salários antes.",
      /** R135 (ECO-06): lista de transferências e trocas de jogador por jogador. */
      listDisabled: "A lista de transferências não está disponível.",
      listFirstWindow: "A primeira janela está fechada para vendas: sem listagens e sem trocas por enquanto.",
      listWindowClosing: "A janela fecha hoje. Tarde demais para listar um jogador ou propor uma troca.",
      listFull: "A lista de transferências está cheia. Retire um jogador primeiro.",
      listOffered: "Há uma proposta por ele na mesa. Responda a ela primeiro.",
      resaleLocked: "Um jogador que você contratou não pode ser listado nem trocado na janela em que chegou nem na seguinte.",
      tradeDisabled: "As trocas não estão disponíveis.",
      tradeFreeAgent: "Ele não tem mais contrato com uma org.",
      tradeRegion: "As trocas ficam dentro da região. Seu jogador precisa ser da mesma região da org dele.",
      tradePending: "Uma proposta de troca por vez. Espere a resposta ou retire a proposta.",
      buyBack: "Ele saiu do seu clube há menos de uma temporada. Ainda não assina com você de novo.",
      tradeGone: "Um dos dois jogadores não está mais disponível.",
    },
    /** R135 (ECO-06): a lista de transferências, na aba de negociações do Mercado e na tela do Elenco. */
    transferList: {
      title: "Lista de transferências",
      empty: "Defina um preço pedido por um jogador do elenco e uma org da região dele responde em poucos dias. Ninguém sai sem o seu aceite.",
      listPlayer: "Listar um jogador",
      listForSale: "Listar para venda",
      listedTag: "Listado",
      changePrice: "Mudar preço",
      withdraw: "Retirar",
      asking: (money: string) => `Pedindo ${money}`,
      waiting: (date: string) => `Resposta esperada até ${date}`,
      offered: "Proposta na mesa, veja acima",
      noBuyer: "Nenhuma org da região dele está comprando agora.",
      tooDear: "O preço pedido foi alto demais.",
      offerTag: "Resposta à sua listagem",
      counterLine: (ask: string) => `Contraproposta: você pediu ${ask}`,
      sheetTitle: "Listar um jogador",
      repriceTitle: "Mudar o preço pedido",
      pickTitle: "Escolha um jogador",
      pickHint: "Escolha quem vai para a lista.",
      value: "Valor de mercado",
      askLabel: "Preço pedido",
      askPct: (pct: number) => `${pct}% do valor de mercado dele`,
      guidance: (minDays: number, maxDays: number) =>
        `Um preço justo é pago por inteiro. Um preço alto pode render uma contraproposta menor, ou ninguém. A resposta leva de ${minDays} a ${maxDays} dias.`,
      confirm: "Listar",
      confirmReprice: "Atualizar preço",
      shortTenure: (pct: number) => `Ele chegou há menos de uma temporada: os clubes pagam cerca de ${pct}% do valor por enquanto.`,
    },
    /** R135 (ECO-06): trocas de jogador por jogador. */
    trade: {
      title: "Trocas",
      empty: "Para propor uma troca, abra a oferta de um jogador sob contrato. Trocas só valem dentro de uma janela de transferências, com uma org da região do jogador que você cede.",
      proposeCta: "Propor uma troca",
      proposeHint: "Ofereça um dos seus jogadores por ele em vez de pagar a multa.",
      row: (give: string, take: string, org: string) => `${give} por ${take} (${org})`,
      cashLine: (money: string) => `mais ${money} em dinheiro`,
      waiting: (date: string) => `Resposta esperada até ${date}`,
      agreed: "Acordada. Aguardando o seu sim ou não.",
      countered: (money: string) => `Eles pedem ${money} em dinheiro.`,
      nowTitle: "Proposta de troca",
      withdraw: "Retirar",
      confirmTitle: "Confirmar a troca",
      leaves: "Sai",
      arrives: "Chega",
      cash: "Dinheiro que você paga",
      noCash: "Sem dinheiro",
      wageLine: (wage: string, share: string) => `${wage} · ${share}`,
      lengthLine: (n: number) => (n === 1 ? "1 temporada" : `${n} temporadas`),
      irreversible: "Isso não pode ser desfeito.",
      sheetTitle: (name: string) => `Troca por ${name}`,
      target: "Quem chega",
      give: "Quem sai",
      pickGive: "Escolha quem vai para a org dele",
      length: "Duração do contrato",
      cashLabel: "Dinheiro adicional",
      cashHint: "Opcional. O dinheiro cobre uma diferença de valor.",
      summary: "O contrato dele",
      wage: "Salário",
      share: "Parte do prêmio",
      outlook: {
        likely: "Eles devem aceitar.",
        close: "Está perto: eles podem pedir dinheiro.",
        unlikely: "Improvável por esse preço.",
        noFit: "Eles não vão enfraquecer tanto o elenco.",
      },
      rules: (minDays: number, maxDays: number) =>
        `A org nunca paga a diferença: qualquer lacuna fica por sua conta, em dinheiro. A resposta leva de ${minDays} a ${maxDays} dias.`,
      send: "Enviar proposta",
    },
  },

  finances: {
    title: "Finanças",
    balance: "Saldo",
    net: "Líquido / semana",
    projected: "Projeção após segunda-feira",
    weeklyStatement: "Extrato semanal",
    statementHint: "Toda segunda-feira o caixa se move: o patrocínio entra; salários, staff, manutenção e parcelas saem.",
    runway: (weeks: number) => (weeks === 1 ? "Fôlego: 1 semana nesse ritmo" : `Fôlego: ${weeks} semanas nesse ritmo`),
    runwayOk: "As contas fecham no azul",
    nextPayday: (s: string) => `Próximo pagamento ${s}`,
    // rc.33 (UX-07): a visão ampliada do gráfico do saldo — as segundas que o save registrou.
    chartOpen: "Abrir o gráfico do saldo",
    chartTitle: "Histórico do saldo",
    chartRange: (n: number, from: string, to: string) =>
      n === 1 ? `Um saldo registrado: ${from}.` : `${n} saldos registrados, de ${from} a ${to}.`,
    chartEmpty: "O gráfico se preenche de segunda em segunda: volte depois do próximo pagamento.",
    chartLegendBalance: "Saldo, incluindo o caixa atual",
    chartLegendFloor: "O piso (uma segunda abaixo dele é uma quebra)",
    chartLegendSeason: "Início de temporada",
    chartHigh: (s: string) => `Máximo ${s}`,
    chartLow: (s: string) => `Mínimo ${s}`,
    chartFloor: (s: string) => `Piso ${s}`,
    chartColSeason: "Temporada",
    chartColLow: "Mínimo",
    chartColHigh: "Máximo",
    chartColLast: "Atual",
    chartSummary: (n: number, first: string, last: string, low: string, high: string) =>
      `Saldo em ${n} registros: de ${first} a ${last}, mínimo ${low}, máximo ${high}.`,
    chartClose: "Fechar",
    line: {
      sponsorBase: "Base do patrocínio",
      foundingPartner: "Parceiro fundador",
      rescuePartner: "Investidor",
      payroll: "Salários do elenco",
      coach: "Coach",
      psychologist: "Psicólogo esportivo",
      staff: "Equipe de apoio",
      upkeep: "Manutenção das instalações",
      bankPayment: "Parcela do banco",
      // rc.34 (ECO-04): a missed goal's fine, in Monday instalments.
      sponsorFine: "Multa do patrocinador",
    },
    loans: "Empréstimos & dívidas",
    // rc.34: um banco, dois empréstimos — o voluntário e o emergencial.
    loansHint: "Dois empréstimos: o voluntário, quando você quiser, e o emergencial, se as contas romperem o piso.",
    // A próxima quebra do piso encerra a carreira — sem empréstimo emergencial para socorrer.
    loansHintEnd: "Só resta o empréstimo voluntário. Romper o piso de novo encerra a carreira.",
    bankTitle: "Empréstimo bancário",
    bankNone: "Nenhum empréstimo bancário aberto",
    bankHint: (weeks: number, pct: number) =>
      `Crédito do tamanho da sua reputação: ${weeks} parcelas semanais, ${pct}% de juros.`,
    bankHintEnd: (weeks: number, pct: number) =>
      `Crédito do tamanho da sua reputação: ${weeks} parcelas semanais, ${pct}% de juros. Sem empréstimo emergencial: romper o piso encerra a carreira.`,
    bankAvailable: (s: string) => `Disponível agora: até ${s}`,
    bankTerms: (weekly: string, weeks: number, total: string) =>
      `${weekly} / semana por ${weeks} semanas · ${total} no total`,
    bankRequest: "Pedir empréstimo",
    bankAmount: "Valor",
    bankRemaining: (s: string) => `Banco: ${s} a pagar`,
    bankWeekly: (s: string) => `Parcela de ${s} / semana`,
    bankPayEarly: "Antecipar o banco",
    bankBlockedActive: "Um empréstimo por vez: quite este primeiro.",
    bankLockedRep: "O banco abre as portas quando a org tiver um pouco de reputação.",
    // ECO-02 (R46): o cronograma do banco, como a folha de segunda lança.
    bankNext: (amount: string, date: string) => `Próxima parcela de ${amount} em ${date}`,
    bankLeft: (n: number) => (n === 1 ? "última parcela" : `${n} parcelas restantes`),
    // ECO-02 (R46): um pagamento que deixa o saldo negativo avisa antes. rc.34: o empréstimo do banco.
    payRiskBacker: (floor: string) =>
      `Isso deixa as contas no vermelho. Abaixo de ${floor} numa segunda, entra o empréstimo emergencial, com prazo.`,
    payRiskEnd: (floor: string) =>
      `Isso deixa as contas no vermelho. Abaixo de ${floor} numa segunda, a carreira acaba.`,
    // O que a próxima quebra faz nestas contas (nextBreachParamsOf do fluxo).
    payRiskNext: (floor: string, p: Record<string, string | number>) =>
      `Isso deixa as contas no vermelho. Abaixo de ${floor} numa segunda-feira é uma quebra. ${nextBreachPt(p)}`,
    // Os nomes acessíveis dos ajustes de valor (pagamentos e o pedido ao banco).
    amountDown: "Diminuir o valor",
    amountUp: "Aumentar o valor",
    income: "Entradas",
    expenses: "Saídas",
    ledger: "Movimentações",
    payday: "Dia de pagamento",
    ledgerKind: {
      prize: "Premiação",
      sponsorBase: "Pagamento de patrocínio",
      sponsorBonus: "Bônus de patrocínio",
      sponsorSigning: "Luvas do patrocínio",
      salary: "Salários dos jogadores",
      coachSalary: "Salário do coach",
      severance: "Rescisão",
      transferIn: "Taxa de transferência recebida",
      transferOut: "Taxa de transferência paga",
      signingBonus: "Luvas",
      releaseFee: "Taxa de dispensa",
      standInFee: "Substituto de emergência",
      facility: "Upgrade de instalações",
      upkeep: "Manutenção das instalações",
      buff: "Staff & boosts",
      loanGrant: "Empréstimo emergencial",
      loanGarnish: "Abatimento do empréstimo emergencial",
      loanPayment: "Pagamento do empréstimo",
      foundingPartner: "Parceiro fundador",
      rescuePartner: "Investidor",
      playerShare: "Parte dos jogadores no prêmio",
      // rc.36 (POL-04): a receita saiu; mantida para o caixa de um save do rc.35 continuar legível.
      fanbase: "Receita de loja e streaming",
      payroll: "Salários do elenco",
      bankLoan: "Empréstimo bancário recebido",
      bankPayment: "Parcela do banco",
      insert: "Evento paralelo",
      // rc.34 (ECO-04): a Bold deal's milestone payment and a missed goal's fine instalment.
      sponsorMilestone: "Marco do patrocinador",
      sponsorFine: "Multa do patrocinador",
      boardGrant: "Verba da diretoria",
      boardBonus: "Bônus da diretoria",
    },
    sponsors: "Patrocinadores",
    sponsorTier: (t: number) => `Nível ${t}`,
    sponsorObjective: "Meta",
    objective: {
      enterEvents: (n: number) => `Dispute ${n}+ eventos neste split (oficiais contam)`,
      regionalTop8: "Alcance um top-8 regional neste split",
      majorQualify: "Classifique-se para o Major",
      majorTop4: "Alcance o top-4 do Major",
    },
    onTrack: "No caminho",
    objectiveHit: "Entregue",
    objectiveMissed: "Perdida neste split",
    patience: (n: number, max: number) => `Confiança do patrocinador: ${max - n} de ${max}`,
    patienceWarn: "Mais um tropeço e a oferta da próxima temporada cai um nível.",
    offerTitle: "Ofertas de patrocínio",
    perWeekBase: (s: string) => `${s} / semana garantidos`,
    bonusFor: (s: string) => `+${s} por meta batida`,
    // rc.34 (ECO-04, SPONSOR-CONTRACT S5): os contratos — as cinco linhas do comparativo e a mesa.
    deal: {
      profile: { steady: "Estável", balanced: "Equilibrado", bold: "Ousado" } as Record<string, string>,
      profileHint: {
        steady: "Quase todo o dinheiro é garantido. Bônus pequeno por meta, sem multas.",
        balanced: "Uma base semanal sólida, um bônus de verdade por meta e uma multa pequena por meta perdida.",
        bold: "Menos dinheiro garantido, bônus grande por meta e um extra na primeira meta batida. Meta perdida gera multa.",
      } as Record<string, string>,
      word: SPONSOR_WORD_PT,
      rowStability: "Estabilidade",
      rowTotal: "Retorno total",
      rowLength: "Duração",
      rowRisk: "Risco",
      rowGoal: "Meta",
      // rc.35 (front S): a comparação visual — uma faixa por linha, ícones primeiro.
      rowWeekly: "Pagamento semanal",
      rowUpfront: "Adiantado",
      rowBonus: "Bônus por meta",
      rowFine: "Multa se falhar",
      upfrontSigning: "na assinatura",
      upfrontMilestone: "na 1ª meta",
      upToWeekly: (s: string) => `até ${s} / semana`,
      contractTotal: (s: string, n: number) => `${s} no total · ${n === 3 ? "1 temporada" : `${n} splits`}`,
      upTo: (s: string) => `até ${s}`,
      noFine: "Nenhuma",
      lengthShort: (splits: number) =>
        splits === 1 ? "1 split" : splits === 3 ? "1 temporada" : splits === 6 ? "2 temporadas" : `${splits} splits`,
      difficultyMeter: (word: string) => `Dificuldade da meta: ${word}`,
      profileTag: { steady: "Mais seguro", balanced: "Meio-termo", bold: "Maior pagamento" } as Record<string, string>,
      compareRule: "Compare a renda garantida e o total possível. Metas e multas determinam o risco.",
      boldLocked: "Contratos ousados liberam conforme a reputação cresce.",
      globalSponsor: "Global",
      nextPay: "Próximo pagamento",
      noNextPay: "Último já pago",
      finesNone: "Nenhuma multa devida",
      finesShort: (mondays: number) => `em ${mondays} segundas`,
      seasonFineCap: (s: string) => `Multas: no máximo ${s} por temporada`,
      dealRun: (paid: number, total: number) => `${paid} de ${total} segundas pagas`,
      weeklySure: (s: string) => `${s} por semana, garantido`,
      plusSigning: (s: string) => `+ ${s} na assinatura`,
      plusMilestone: (s: string) => `+ ${s} no dia da primeira meta batida`,
      total: (sure: string, upTo: string) => `${sure} garantido · até ${upTo}`,
      length: (splits: number, date: string) =>
        `${splits === 1 ? "Um split" : splits === 3 ? "Uma temporada" : splits === 6 ? "Duas temporadas" : `${splits} splits`} · termina ${date}`,
      riskSteady: (n: number) => `Sem multas · ${n} metas perdidas baixam a próxima proposta em um tier`,
      riskFine: (s: string, mondays: number) => `Meta perdida custa até ${s}, pago em ${mondays} segundas`,
      riskNone: "Sem multas nesta dificuldade",
      goal: sponsorGoalPt,
      goalBy: (date: string) => `até ${date}`,
      laterGoals: "Depois, uma meta nova a cada split, na mesma dificuldade",
      sign: "Assinar",
      // rc.36 (front S2): CAREER_SPONSOR.deadlineRule — "hold" (no último dia o relógio espera) ou "signSafest".
      decideBy: (date: string) => `Escolha uma até ${date}: nesse dia o relógio espera a sua escolha.`,
      decideBySafest: (date: string) => `Escolha uma até ${date}: depois disso a oferta mais segura é assinada por você.`,
      compareHint:
        "As três valem parecido em média. Muda o quanto é garantido, a duração e a meta.",
      // rc.34: uma marca de Tier 3 / 4 paga menos a um time abaixo do nível dela (sponsorDeals.levelValueShareOf).
      levelScaled: (tier: number, pct: number) =>
        tier >= 4
          ? `Marcas de Tier 4 pagam o valor cheio a candidatos ao título mundial. Hoje o time recebe ${pct}%.`
          : tier === 3
            ? `Marcas de Tier 3 pagam o valor cheio a times que competem em Majors. Hoje o time recebe ${pct}%.`
            : `Marcas de Tier 2 pagam o valor cheio a times de top 8 regional. Hoje o time recebe ${pct}%.`,
      stabilityBar: (pct: number) => `${pct}% do máximo é garantido`,
      handover: (first: number, second: number) =>
        `Seu parceiro fundador sai aos poucos quando este contrato começar: ${first}%, depois ${second}% do valor, um split cada.`,
      // rc.34 review (S6): antes da temporada de índice 2, assinar não inicia a transição — o parceiro paga integralmente até o fim do prazo.
      handoverLater: (season: string, first: number, second: number) =>
        `Seu parceiro fundador paga o valor cheio até o fim de ${season}, assine o que assinar; depois sai aos poucos: ${first}%, depois ${second}% do valor, um split cada.`,
      handoverNet: (delta: string, date: string) => `Variação semanal líquida na transição (${date}): ${delta}`,
      activeTitle: "Contrato atual",
      endsOn: (date: string) => `Termina ${date}`,
      signingPaid: (s: string) => `${s} pagos na assinatura`,
      milestonePending: (s: string) => `${s} no dia da primeira meta batida`,
      milestonePaid: (s: string) => `Marco de ${s} pago`,
      thisGoal: "Meta deste split",
      nextGoal: (date: string) => `A próxima meta sai em ${date}`,
      progress: (done: number, target: number) => `${done} de ${target}`,
      goalReached: "Batida",
      goalMissed: "Perdida",
      goalOpen: "Em aberto",
      bonusIfHit: (s: string) => `${s} se bater`,
      fineIfMissed: (s: string) => `até ${s} se perder`,
      record: (hits: number, misses: number) => `Metas até aqui: ${hits} batidas, ${misses} perdidas`,
      finesOwed: (s: string, mondays: number) => `Multas a pagar: ${s} nas próximas ${mondays} segundas`,
      fineFloorNote: "pagas em parcelas semanais",
      otherIncome: "Outras receitas",
      otherIncomeLine: (taken: string, cap: string, n: number, max: number) =>
        `${taken} de ${cap} na temporada · ${n} de ${max} neste split`,
      otherIncomeHint: (pct: number, max: number) =>
        `Showmatches e ações de parceiros pagam à parte: até ${pct}% do faturamento da temporada, ${max} por split.`,
    },
    // rc.34 (Miguel, 31/10): o empréstimo emergencial do banco (rc.31–rc.33: o Investidor de emergência).
    backer: "Empréstimo emergencial",
    backerRemaining: (s: string) => `Empréstimo emergencial: ${s} a devolver`,
    backerLine: (pct: number) => `Abatido da premiação (${pct}%) e das vendas, ou amortize abaixo`,
    // v0.3 quitação da dívida
    backerSaleLine: (pct: number) => `Vendas de jogadores abatem ${pct}% automaticamente`,
    payDebt: "Pagar o empréstimo",
    payDebtAll: (s: string) => `Quitar tudo (${s})`,
    payDebtAmount: "Valor",
    payDebtHint: "Quitado antes do prazo, o empréstimo se encerra e o prazo deixa de existir.",
    debtCleared: "Empréstimo quitado: o prazo deixou de existir.",
    // rc.34: a regra quando nada é devido — o piso, o empréstimo até o alvo, o prazo (null = sem prazo).
    backerIdle: (floor: string, rescueTo: string, term: number | null) =>
      `Sem uso. Se uma segunda-feira fechar abaixo de ${floor}, o banco empresta até o saldo voltar a ${rescueTo}${term !== null ? `, com ${term} semanas para quitar` : ""}.`,
    // CAREER_LOAN.breachesToEnd encerra a carreira desta dificuldade na primeira quebra — sem empréstimo emergencial.
    backerIdleNone: (floor: string) =>
      `Sem empréstimo emergencial nesta dificuldade: uma segunda-feira que fechar abaixo de ${floor} encerra a carreira.`,
    backerWarning: "Este negócio provavelmente rompe o piso: o empréstimo emergencial do banco entraria, com prazo.",
    endsCareerWarning: "Este negócio provavelmente encerra a carreira: a próxima quebra do piso é a última.",
    // rc.37 F2: o empréstimo comum do banco como Finanças o sugere enquanto as contas queimam (careerFlow.creditOfferOf).
    creditSuggest: (net: string, total: string, weekly: string, weeks: number, covers: number) =>
      `Sugestão do banco: ${net} agora, ${weekly} toda segunda por ${weeks} semanas (${total} no total). Cobre cerca de ${covers} segundas neste ritmo.`,
    // rc.37 F2 (pacote 4): a visão consolidada das contas da próxima temporada na revisão (careerFlow.seasonOutlookOf).
    outlook: {
      title: "As contas da próxima temporada",
      payroll: "Folha salarial",
      payrollLine: (now: string, next: string) => `${now} por semana agora → ${next} por semana na próxima temporada (depois da revisão de contratos)`,
      leaving: (names: string) => `Saem na virada, sem contrato novo: ${names}`,
      debt: "Dívida",
      debtNone: "Nada a pagar.",
      debtEmergency: (s: string) => `Empréstimo emergencial: ${s}`,
      debtBank: (s: string, n: number) => `Empréstimo bancário: ${s} (${n === 1 ? "falta 1 parcela" : `faltam ${n} parcelas`} de segunda)`,
      deadline: (date: string, weeks: number) => `O empréstimo emergencial vence ${date}: daqui a ${weeks === 1 ? "1 semana" : `${weeks} semanas`}.`,
      cash: "Até o primeiro regional",
      cashLine: (balance: string, week: number, mondays: number, net: string) =>
        `${balance} no saldo até a semana ${week}: ${mondays} segundas a ${net} por semana, sem contar premiação.`,
      sponsorEnds: "O patrocínio acaba nesta temporada: a projeção fica sem a base dele até você assinar outro.",
      retirements: "Aposentadorias",
      retireNone: "Ninguém está perto do fim da carreira.",
      retireNow: (name: string) => `${name} se aposenta na virada (a última temporada dele foi anunciada).`,
      retireLikely: (name: string) => `${name} deve anunciar a próxima temporada como a última.`,
      retirePossible: (name: string) => `${name} pode anunciar a próxima temporada como a última.`,
    },
    backerRescued: "O último empréstimo emergencial está quitado.",
    insolvencyWarning: "As contas estão ruindo: a próxima quebra do piso encerra a carreira.",
    // rc.32 (M4): a linha em semanas de salário.
    backerWeeksLine: (floorWeeks: number, rescueWeeks: number) =>
      `O piso fica ${floorWeeks} semanas de salário abaixo de zero. O empréstimo emergencial devolve o saldo a ${rescueWeeks} semanas acima.`,
    // rc.34: a regra inteira nesta dificuldade — o prazo, o investidor, os acréscimos, o vencimento,
    // e CAREER_LOAN.breachesToEnd se ela encerra carreiras direto (null = não encerra).
    loanRule: (p: { term: number | null; partnerPct: number; partnerWeeks: number; maxTopUps: number | null; endAt: number | null; maxLoans?: number | null }) => {
      if (p.endAt !== null && p.endAt <= 1) return "Nesta dificuldade a primeira quebra do piso encerra a carreira.";
      const partner = p.partnerPct > 0 ? ` (na primeira vez, um investidor soma ${p.partnerPct}% da folha${partnerRunPt(p.partnerWeeks)})` : "";
      const term = p.term !== null ? ` Quite em até ${p.term} semanas: premiações e vendas abatem parte, e você paga o resto em Finanças.` : "";
      const topUps = `Se o piso romper de novo antes de quitar, o banco soma ao empréstimo${p.maxTopUps !== null ? ` (até ${p.maxTopUps} vezes)` : ""} e o prazo não muda.`;
      const end = p.term !== null ? ` No prazo, o banco cobra a dívida; se as contas não aguentarem, a carreira acaba.` : "";
      const count = p.endAt !== null ? ` A ${ordinalPt(p.endAt)} quebra encerra a carreira.` : "";
      // rc.34 review: o limite de empréstimos novos na carreira (CAREER_LOAN.emergency.maxLoans).
      const loans =
        p.maxLoans !== undefined && p.maxLoans !== null
          ? ` No máximo ${p.maxLoans === 1 ? "um empréstimo emergencial" : `${p.maxLoans} empréstimos emergenciais`} por carreira: depois do último, romper o piso encerra a carreira.`
          : "";
      return `Uma quebra abre o empréstimo emergencial do banco${partner}.${term} ${topUps}${end}${loans}${count}`;
    },
    // Contagem histórica (a regra do rc.33 encerrava a carreira numa quebra; `end` null = nenhuma contagem encerra).
    breachCount: (n: number, end: number | null) =>
      end === null
        ? `Quebras até aqui: ${n}`
        : n + 1 >= end
          ? `Quebras até aqui: ${n}, a próxima encerra a carreira`
          : `Quebras até aqui: ${n}, a carreira acaba na quebra ${end}`,
    backerLock: "Enquanto houver dívida: sem taxas de transferência, sem equipamento, nada que encurte o fôlego.",
    // rc.34: nada fica travado enquanto há dívida (CAREER_LOAN.lockCommitments false).
    loanNoLock: "Nada fica travado enquanto você deve: contratações, taxas e equipamentos seguem liberados.",
    // rc.34: o prazo e o estado do empréstimo, como Finanças e o QG mostram.
    loanDeadline: (date: string, weeks: number) =>
      weeks <= 0 ? `Vence nesta segunda (${date})` : weeks === 1 ? `Vence na próxima segunda, ${date}` : `Vence em ${date}: faltam ${weeks} semanas`,
    loanDeadlineRule: deadlineRulePt,
    // rc.34 review: as contas projetadas até a segunda do prazo (com o gasto semanal), o teste do próprio banco.
    loanCovered: (covered: boolean) =>
      covered ? "Neste ritmo as contas cobrem a dívida no dia." : "Neste ritmo as contas não vão cobrir a dívida no dia.",
    loanLent: (s: string) => `Emprestado no total: ${s}`,
    loanTopUps: (n: number, max: number | null) =>
      max === null
        ? `Acréscimos até aqui: ${n}`
        : n >= max
          ? `Acréscimos: ${n} de ${max}, a próxima quebra encerra a carreira`
          : `Acréscimos: ${n} de ${max}`,
    // rc.33 (ECO-07): o card do parceiro de resgate — rc.34: o investidor que entra com o primeiro empréstimo emergencial.
    rescueTitle: "Investidor",
    rescueTerms: (weeks: number) => `Veio com o primeiro empréstimo emergencial · ${weeks} semanas de receita extra`,
    rescueUntil: (date: string, left: number) =>
      left === 1 ? `Último pagamento ${date}.` : `Faltam ${left} pagamentos: o último em ${date}.`,
    // rc.32 (M3, provisório): o card do parceiro fundador.
    foundingTitle: "Parceiro fundador",
    foundingTerms: (pct: number) => `${pct}% da folha de fundação · meta: disputar eventos · sem luvas`,
    foundingEnds: (through: string) => `Termina no seu primeiro contrato de patrocínio, não antes do fim de ${through}.`,
    foundingEnded: "Saiu de cena quando a org assinou o próprio patrocínio.",
    // rc.34 (S6): a transição — uma parte do valor, um split por passo.
    foundingTapering: (pct: number, last: boolean) =>
      last ? `Passando o bastão: ${pct}% do valor neste split, o último.` : `Passando o bastão: ${pct}% do valor neste split, menos no próximo, e então encerra.`,
    // rc.32 (M6, provisório): a parte dos jogadores nos prêmios de pódio.
    // rc.33 (ECO-10): cada contrato tem a própria parte (o Elenco e a oferta mostram).
    playerShareRule:
      "Os jogadores ficam com parte dos prêmios de top 4 em regionais, Majors e Worlds. A parte de cada um está no Elenco.",
    boosts: "Boosts & staff",
    psychologist: "Psicóloga esportiva",
    staff: {
      assistant: { title: "Assistente técnico", desc: "Reservas ganham 80% da experiência das séries do time, em vez de 60%." },
      analyst: { title: "Analista de adversários", desc: "+0,75 de rating do time em toda rodada de playoff." },
      physio: { title: "Preparador físico", desc: "Reduz em 25% o risco de um jogador perder um evento por desgaste de treino." },
      brand: { title: "Gerente de marca", desc: "Novas ofertas de patrocínio valem 15% mais. Compensa a partir dos patrocinadores globais." },
    },
    psychologistDesc: (clutch: number, consistency: number) => `+${clutch} Clutch, +${consistency} Consistência enquanto contratada. Apoio para jogos decisivos.`,
    bootcamp: "Bootcamp",
    bootcampDesc: "Ganho permanente de química + próximo evento oficial mais afiado.",
    bootcampUsed: "Bootcamp já realizado neste split.",
    upkeepLabel: (s: string) => `Manutenção ${s} / semana`,
    lockedAtRep: (rep: number) => `Desbloqueia com ${rep} de Reputação`,
    activeLabel: "Ativo",
    ownedLabel: "Adquirido",
    retainedLabel: "Contratada",
    hireLabel: "Contratar",
    dropLabel: "Encerrar contrato",
    buy: "Comprar",
    // Escada de equipamentos & staff (v0.2)
    gearLadder: "O arsenal da org",
    gearLadderHint: "Comprado em ordem, desbloqueado por reputação: uma org de garagem vira potência.",
    gear: {
      peripherals: "Periféricos pro",
      monitors: "Monitores 240Hz",
      pcs: "PCs de torneio",
      perfCenter: "Centro de Performance",
    },
    gearDesc: {
      peripherals: "Controles, mouses e teclados que os jogadores realmente pediram. +5% de treino.",
      monitors: "Chega de desculpa de frame. +5% de treino.",
      pcs: "Máquinas nível servidor de scrim. +10% de treino e uma vantagem real de rating.",
      perfCenter: "O prédio completo: sala de análise, academia, teatro de review. +15% de treino, vantagem de elite.",
    },
    bootcampT1: "Bootcamp",
    bootcampT1Desc: "Uma semana sob o mesmo teto. Química e preparação competitiva durante o período ativo.",
    bootcampT2: "Bootcamp estruturado",
    bootcampT2Desc: "Comissão técnica, agenda de scrims e review de VOD. Mais química e preparação competitiva durante o período ativo.",
    sponsorPerks: "Vantagens do patrocinador",
    perkDiscount: (pct: number) => `${pct}% de desconto em equipamentos`,
    perkBootcamps: (n: number) => (n === 1 ? "1 bootcamp grátis / temporada" : `${n} bootcamps grátis / temporada`),
    perkNone: "Sem vantagens neste nível",
    freeBootcampLeft: (n: number) =>
      n === 1 ? "1 bootcamp pago pelo patrocinador restante na temporada" : `${n} bootcamps pagos pelo patrocinador restantes na temporada`,
    // rc.34 (UX-01f, 5-A): o bootcamp dura o split — o fim dele na escada.
    bootcampUntil: (date: string) => `Ativo até ${date}`,
    // rc.34 (UX-01e): a projeção de Finanças, o mesmo número do QG.
    projectionSplit: (date: string, balance: string) => `Fim do split (${date}), sem prêmios: ${balance}`,
  },

  // rc.34 (UX-01f, HQ-CONTRACT H6; UX-06a): a caixa de ferramentas no QG — comprar com confirmação.
  toolbox: {
    title: "Caixa de ferramentas",
    open: "Escada completa em Finanças",
    active: "Ativo",
    owned: "Seus",
    next: "Para comprar",
    none: "Nada para comprar ainda: a reputação abre a caixa de ferramentas.",
    lockedRep: (rep: number) => `Reputação ${rep}`,
    after: (name: string) => `Depois de ${name}`,
    used: "Já usado neste split",
    superseded: "Substituído pelo nível seguinte",
    training: (pct: number) => `+${pct}% de treino`,
    buff: (n: number) => `+${n} nível de buff`,
    rating: (n: string) => `+${n} de rating do time`,
    chemistry: "um ganho de química",
    stats: "+5 Clutch, +5 Consistência",
    permanent: "Permanente",
    until: (date: string) => `Até ${date}`,
    nextEvent: "O próximo evento oficial",
    weekly: (amount: string) => `${amount} por semana até dispensar`,
    upkeep: (amount: string) => `manutenção ${amount} por semana`,
    priceLabel: "Preço",
    effectLabel: "Efeito",
    durationLabel: "Duração",
    afterLabel: "Depois",
    afterLine: (balance: string, runway: string) => `Saldo ${balance} · ${runway}`,
    free: "Grátis: vantagem do patrocínio",
    discount: (pct: number) => `−${pct}% de desconto do patrocínio`,
    buy: "Comprar",
    hire: "Contratar",
    refusal: {
      locked: "Bloqueado: reputação, ou o degrau anterior da escada primeiro.",
      funds: "Dinheiro insuficiente acima do piso.",
      loanActive: "Não com o empréstimo emergencial em aberto.",
      loanRunway: "Não com o empréstimo emergencial em aberto: encurtaria o fôlego de caixa.",
      used: "Já usado neste split.",
      maxed: "A escada está completa.",
      blocked: "A carreira terminou.",
      other: "Não dá para comprar agora.",
    },
    // UX-06a: o modal central de desbloqueio — uma vez por novidade; desbloqueado não é comprado.
    unlockTitle: "Novo na caixa de ferramentas",
    bootcampHint: "Reúna o elenco por alguns dias: fortaleça o entrosamento e leve uma vantagem temporária para as competições.",
    available: "Melhorias disponíveis",
    unlockBody: (name: string) => `${name} foi desbloqueado: pronto para comprar, ainda não comprado.`,
    unlockSee: "Ver",
    unlockLater: "Depois",
    newTag: "Novo",
    unlockKicker: "Desbloqueado",
    // rc.36: o anúncio não tem Comprar — onde o item espera.
    unlockNote: "Ainda não comprado: está em Progressão, pronto para comprar.",
    benefits: "Benefícios",
    close: "Fechar",
  },

  ladder: {
    title: "Progressão",
    rep: (n: number) => `Rep ${n}`,
    next: "Próximo desbloqueio",
    progress: (rep: number, gate: number) => `${rep} / ${gate} rep`,
    top: "Escada completa",
    seeMore: "Ver mais",
    owned: "Seu",
    open: "Desbloqueado",
    locked: "Bloqueado",
    gate: (n: number) => `Rep ${n}`,
    toBuy: "Pronto para comprar",
    running: "Em uso",
    finances: "Finanças",
    rung: {
      peripherals: "Periféricos pro",
      coach: "Coach",
      monitors: "Monitores 240Hz",
      sponsors1: "Patrocinadores locais",
      pcs: "PCs de torneio",
      exProCoach: "Coaches ex-pro",
      bootcamp1: "Bootcamp",
      sponsors2: "Patrocinadores Challenger",
      bootcamp2: "Bootcamp estruturado",
      psychologist: "Psicóloga",
      assistant: "Assistente técnico",
      analyst: "Analista",
      physio: "Preparador físico",
      brand: "Gerente de marca",
      sponsors3: "Patrocinadores globais",
      perfCenter: "Centro de performance",
      sponsors4: "Patrocinadores master",
    },
    hint: {
      peripherals: "Treino rende mais",
      coach: "Contrate um coach genérico",
      monitors: "Treino rende mais",
      sponsors1: "Duas ofertas seguras por split",
      pcs: "Treino e um buff de time",
      exProCoach: "Ex-pros na lista de coaches",
      bootcamp1: "Química e vantagem de rating",
      sponsors2: "Três ofertas, acordos ousados, mais dinheiro",
      bootcamp2: "Mais química e mais rating",
      psychologist: "+5 Clutch, +5 Consistência",
      assistant: "Reservas aprendem mais nos eventos",
      analyst: "Vantagem de rating nos playoffs",
      physio: "Menos risco de desgaste antes dos eventos",
      brand: "Ofertas de patrocínio valem mais",
      sponsors3: "Marcas globais: mais dinheiro, perks melhores",
      perfCenter: "O melhor treino e buff de time",
      sponsors4: "A marca na camisa: o maior acordo",
    },
  },

  standings: {
    title: "Classificação",
    splitTab: "Classificação do split",
    seasonTab: "Road to Worlds",
    majorLine: "Linha do Major",
    worldsLine: "Linha do Worlds",
    clinched: "Classificado",
    contention: "Na briga",
    eliminated: "Fora da corrida",
    ptsShort: "pts",
    remaining: (n: number) => `${n} eventos restantes`,
    maxAvailable: (n: number) => `${n} pts ainda em disputa`,
    userChip: "Você",
    regionLabel: "Região",
    worldsField: "Chave do Worlds",
    fieldRevealPending: "Revelada quando todas as regiões concluírem",
  },

  // RTW-01 (R49): as duas tabelas da corrida — as abas da Classificação e o seletor do QG.
  race: {
    majorTab: "Tabela do Major",
    worldsTab: "Tabela do Worlds",
    majorToggle: "Major",
    worldsToggle: "Worlds",
    majorScope: (split: number, slots: number) =>
      `Split ${split} · pontos dos regionais · ${slots === 1 ? "o líder vai" : `os ${slots} primeiros vão`} ao Major`,
    worldsScope: (slots: number) =>
      `Temporada · pontos dos regionais + Majors · ${slots === 1 ? "o líder vai" : `os ${slots} primeiros vão`} ao Worlds`,
    fixturesMajor: (n: number) =>
      n === 0 ? "Split concluído" : n === 1 ? "Falta 1 regional no split" : `Faltam ${n} regionais no split`,
    fixturesWorlds: (regionals: number, majors: number) => {
      const parts = [
        regionals ? `${regionals} regiona${regionals === 1 ? "l" : "is"}` : "",
        majors ? `${majors} Major${majors === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      return parts.length
        ? `${regionals + majors === 1 ? "Falta" : "Faltam"} ${parts.join(" + ")} na temporada`
        : "Temporada concluída";
    },
    status: { clinched: "Vaga garantida", contention: "Na briga", out: "Fora de alcance" },
    localTag: "Local",
    localLegend: "Local: um time amador da cena regional. Pontua como qualquer time e pode conquistar uma vaga.",
    qualifiedTag: "Classificado",
    majorField: "Chave do Major",
    majorFieldPending: "Anunciada na segunda-feira da semana do Major",
    open: "Classificação completa",
    toggleLabel: "Tabela da corrida",
    fixturesLabel: "Ainda por jogar",
  },

  news: {
    title: "Central",
    unread: (n: number) => `${n} não lidas`,
    markAllRead: "Marcar tudo como lido",
    filter: { all: "Tudo", mine: "Minha org", region: "Minha região", world: "Mundo", deals: "Negócios" },
    wire: "PLANTÃO",
    feed: {
      name: "Central de notícias",
      lead: "Manchete",
      archive: "Do arquivo",
      archiveNote: "História real da RLCS: esta linha do tempo segue o próprio rumo.",
      subject: {
        result: "Resultado",
        transfer: "Transferência",
        beat: "A cena",
        org: "Sua org",
        training: "Treino",
        milestone: "Marco",
        window: "Janela",
        rep: "Reputação",
        flavor: "Pela cena",
      } as Record<string, string>,
      action: {
        market: "Mercado",
        standings: "Classificação",
        squad: "Elenco",
        finances: "Finanças",
        training: "Treinos",
        club: "Clube",
        calendar: "Calendário",
      } as Record<string, string>,
      moved: (player: string, org: string) => `${player} → ${org}`,
      newIn: (region: string) => `Nova na ${region}`,
      leftScene: (region: string) => `Deixa a ${region}`,
    },
    brand: {
      wire: { name: "O plantão", kicker: "PLANTÃO", credit: "" },
      fiftyFifty: { name: "50/50", kicker: "50/50", credit: "Notícias de Rocket League oferecidas pelo 50/50" },
    } as Record<string, { name: string; kicker: string; credit: string }>,
    digest: (n: number) => `Giro pela liga: mais ${n} movimentações`,
    tpl: {
      transfer: (p: Record<string, string | number>) => `${p.player} assina com ${p.to}`,
      transferFee: (p: Record<string, string | number>) => `${p.to} tira ${p.player} de ${p.from} (${p.fee})`,
      transferFa: (p: Record<string, string | number>) => `${p.player} encontra casa na ${p.to}`,
      userSigned: (p: Record<string, string | number>) => `Oficial: ${p.player} chega a ${p.org}`,
      userSold: (p: Record<string, string | number>) => `${p.player} deixa ${p.org} rumo à ${p.to}`,
      userTraded: (p: Record<string, string | number>) => `${p.club} trocam ${p.give} por ${p.take} com ${p.org}`,
      listingLapsed: (p: Record<string, string | number>) =>
        Number(p.n) === 1 ? `Lista de transferências fecha: ${p.players} fica` : `Lista de transferências fecha: ${p.players} ficam`,
      listingNoBuyer: (p: Record<string, string | number>) => `Ninguém quis ${p.player} por ${p.ask}`,
      listingTooDear: (p: Record<string, string | number>) => `${p.player}: sem proposta por ${p.ask}`,
      listingOffer: (p: Record<string, string | number>) => `${p.org} oferecem ${p.fee} por ${p.player}`,
      listingCounter: (p: Record<string, string | number>) => `${p.org} contrapropõem ${p.fee} por ${p.player}`,
      tradeLapsed: (p: Record<string, string | number>) => `Troca expira: ${p.give} por ${p.take}`,
      tradeRefusedFit: (p: Record<string, string | number>) => `${p.org} recusam ${p.give} por ${p.take}`,
      tradeRefusedValue: (p: Record<string, string | number>) => `${p.org} recusam ${p.give} por ${p.take}`,
      tradeAgreed: (p: Record<string, string | number>) => `${p.org} aceitam ${p.give} por ${p.take}`,
      tradeCountered: (p: Record<string, string | number>) => `${p.org} pedem ${p.cash} a mais por ${p.take}`,
      userReleased: (p: Record<string, string | number>) => `${p.org} dispensa ${p.player}`,
      result: (p: Record<string, string | number>) => `${p.org} levam o ${p.event}`,
      resultUser: (p: Record<string, string | number>) => `${p.org ?? "A equipe"} termina em ${p.placement} no ${p.event}`,
      // v2.0 (R40): resultado de qualificatória é classificado / eliminado, nunca colocação.
      resultUserQualified: (p: Record<string, string | number>) => `${p.event}: classificado para domingo`,
      resultUserEliminated: (p: Record<string, string | number>) => `${p.event}: eliminado no Swiss`,
      qualifiedRegional: (p: Record<string, string | number>) => `Passou na qualificatória: ${p.event} está marcado`,
      missedRegional: (p: Record<string, string | number>) => `Fora na qualificatória: ${p.event} acontece sem você`,
      qualifiedMajor: () => `Está dentro. O Major espera.`,
      missedMajor: () => `O Major acontece sem você neste split.`,
      qualifiedWorlds: () => `WORLDS. A org chegou lá.`,
      missedWorlds: () => `A corrida pelo Worlds termina aqui nesta temporada.`,
      stability: (p: Record<string, string | number>) => `Reformulação do elenco custa ${p.points} Pontos da Temporada`,
      contractExpiring: (p: Record<string, string | number>) => `O contrato de ${p.player} entra na janela final`,
      contractReminder: (p: Record<string, string | number>) => `Relógio dos contratos: ${p.players}, ${p.weeks} semanas`,
      // rc.34 (Miguel, 31/10): um elenco incompleto ficou fora de uma regional.
      regionalSkipped: (p: Record<string, string | number>) => `${p.org} fica fora da ${p.event}`,
      eventMissedNoReserve: (p: Record<string, string | number>) => `${p.org} perde ${p.event}: sem reserva`,
      playerLeft: (p: Record<string, string | number>) => `${p.player} sai como agente livre`,
      retirementAnnounce: (p: Record<string, string | number>) => `${p.player} anuncia sua última temporada`,
      retired: (p: Record<string, string | number>) => `${p.player} pendura o controle`,
      // DEV-02 (R48): o aposentado do próprio elenco — banco ou fora do jogo.
      retiredToCoach: (p: Record<string, string | number>) => `${p.player} troca o controle pelo headset de treinador`,
      retiredLeaves: (p: Record<string, string | number>) => `${p.player} pendura o controle de vez`,
      insertResolved: (p: Record<string, string | number>) => `Decisão tomada: ${p.insert}`,
      orgEnters: (p: Record<string, string | number>) => `${p.org} entra na cena de ${p.region}`,
      // rc.33 (RTW-03): uma org cuja história acabou cede a vaga a quem entra.
      orgLeaves: (p: Record<string, string | number>) => `${p.org} deixa a cena de ${p.region}`,
      // v2.1 M1 (R139): o mundo se renova.
      orgNewcomer: (p: Record<string, string | number>) => `${p.org} assume a vaga de ${p.old} em ${p.region}`,
      stackSigned: (p: Record<string, string | number>) => `O stack local ${p.stack} assina com a ${p.org}`,
      prospectScouted: (p: Record<string, string | number>) => `${p.org} contrata o prospecto ${p.player} para o banco`,
      // v2.1 M2.1 (R142): o mundo cresce.
      prodigyRises: (p: Record<string, string | number>) => `${p.player} (${p.region}) desponta como prodígio`,
      // v2.2 ENDLESS
      endlessProject: (p: Record<string, string | number>) => `${p.org} monta o time em torno de ${listPt(p)}`,
      endlessProjectGrows: (p: Record<string, string | number>) => `${p.org} segue montando, temporada ${p.season} do projeto`,
      endlessGeneration: (p: Record<string, string | number>) => `Uma geração mais forte: ${p.player} (${p.region}) lidera ${p.n} novos prodígios`,
      endlessHosts: (p: Record<string, string | number>) => `${p.season}: os Majors vão para ${hostPt(p.h1)}, ${hostPt(p.h2)} e ${hostPt(p.h3)}`,
      rookieClass: (p: Record<string, string | number>) => `Chega a turma de novatos de ${p.region}: ${p.name} é o destaque`,
      decline: (p: Record<string, string | number>) => `${p.player}, ${p.n}, perdeu meio passo`,
      breakout: (p: Record<string, string | number>) => `${p.player} está superando todas as projeções`,
      trainingReport: (p: Record<string, string | number>) => `Relatório de treinos: elenco ${p.n} OVR`,
      // rc.34 (DEV-03 T7): o relatório de um período é arquivado — uma linha no feed, nunca um toast.
      trainingPeriod: (p: Record<string, string | number>) =>
        `Relatório do ciclo ${p.n} (${({ development: "Evoluir", preparation: "Entrosar", recovery: "Recuperar" } as Record<string, string>)[String(p.objective)] ?? "Crescimento base"}): elenco +${p.avg} em média, ${p.player} +${p.gain}`,
      // rc.36 (front T2): a fase desconhecida de uma contratação, lida após alguns dias de treino.
      phaseRead: (p: Record<string, string | number>) =>
        `Depois de ${p.n} dias de treino, a comissão lê ${p.player}: ${({ growing: "ainda em evolução", peak: "no auge", declining: "já passou do auge" } as Record<string, string>)[String(p.phase)] ?? "fase incerta"}`,
      // rc.34 (T3): uma linha por semana para os scrims do pacote (só treino).
      scrimWeek: (p: Record<string, string | number>) =>
        `Semana de scrims (${({ easy: "fácil", even: "equilibrado", hard: "difícil" } as Record<string, string>)[String(p.level)] ?? String(p.level)}): ${p.won}–${p.lost}`,
      windowOpen: () => `Janela de transferências aberta: os telefones ligados`,
      windowClose: () => `Janela fechada. Os elencos são o que são.`,
      windowClosing: (p: Record<string, string | number>) => `A janela de transferências fecha em ${p.n} dias`, // v2.3 SKIP
      windowReport: (p: Record<string, string | number>) => `Relatório da janela: ${p.n} trocas pelas regiões`,
      debtCleared: () => `Empréstimo emergencial quitado: a org anda livre`,
      sponsorSigned: (p: Record<string, string | number>) => `${p.org} anuncia parceria com ${p.name}`,
      // rc.34 (ECO-04): um contrato que chegou ao fim (termina numa virada de split).
      sponsorEnded: (p: Record<string, string | number>) => `${p.name}: contrato de patrocínio concluído`,
      sponsorDropped: (p: Record<string, string | number>) => `${p.name} esfria a parceria`,
      repUp: (p: Record<string, string | number>) => `A cena está falando de ${p.org}`,
      repDown: (p: Record<string, string | number>) => `Analistas pegam pesado após o tropeço de ${p.org}`,
      starUp: (p: Record<string, string | number>) => `${p.org} alcança o status de ${p.n} estrelas`,
      unlock: (p: Record<string, string | number>) => `Desbloqueado: ${p.name}`,
      // rc.30 (A4): a limpeza única de uma carreira criada antes da rc.29.
      registryRepair: (p: Record<string, string | number>) =>
        `Registro da liga atualizado: ${p.n} ajustes de elenco e gamertag`,
      unavailable: (p: Record<string, string | number>) => `${p.player} está fora de ${p.event}`,
      standIn: (p: Record<string, string | number>) => `Substituto de emergência entra em ${p.event}`,
      bankLoan: (p: Record<string, string | number>) => `A org pega um empréstimo de ${p.amount}`,
      // rc.37 F2 (pacote 3): chega uma proposta de venda de emergência.
      emergencyBid: (p: Record<string, string | number>) => `${p.org} fazem uma proposta de emergência por ${p.player}`,
      bankCleared: () => `A org quita o empréstimo bancário`,
      cashWarning: (p: Record<string, string | number>) => `Caixa apertado: ${p.weeks} semanas de fôlego`,
      // Histórico (rc.31–rc.33); o rc.34 publica emergencyLoan / emergencyTopUp / loanCollected.
      backerIn: () => `Um investidor de emergência estabiliza as contas`,
      emergencyLoan: () => `O banco entra com um empréstimo emergencial`,
      emergencyTopUp: () => `O banco aumenta o empréstimo emergencial da org`,
      loanCollected: () => `A org quita o empréstimo emergencial no prazo`,
      insolvency: () => `As finanças da org entram em colapso`,
      seasonChampion: (p: Record<string, string | number>) => `${p.org} são os campeões do ${p.event}`,
      gearBought: (p: Record<string, string | number>) => `Upgrade na org: ${p.name} instalado`,
      bootcampRun: (p: Record<string, string | number>) =>
        Number(p.tier) >= 2 ? `Bootcamp estruturado concluído` : `Semana de bootcamp concluída`,
      coachHired: (p: Record<string, string | number>) => `${p.org} traz ${p.coach}`,
      scrimWin: (p: Record<string, string | number>) => `Portas fechadas: scrim V ${p.a}-${p.b} vs ${p.opponent}`,
      scrimLoss: (p: Record<string, string | number>) => `Portas fechadas: scrim D ${p.a}-${p.b} vs ${p.opponent}`,
      scrimSkipped: (p: Record<string, string | number>) =>
        `Scrim contra ${p.opponent} cancelado: o elenco tem menos de três`,
      blockbusterBid: (p: Record<string, string | number>) => `${p.org} fazem proposta bombástica por ${p.player}`,
      // Histórico do rc.32 (ECO-08 / ECO-12): nada os envia desde o rc.33 — ficam para o feed de um save antigo.
      restructured: (p: Record<string, string | number>) =>
        p.player ? `Reestruturação: ${p.player} vendido para equilibrar as contas` : `Reestruturação: o Investidor entra de novo`,
      listed: (p: Record<string, string | number>) => `${p.player} está no mercado: a org o anunciou`,
      flavor1: () => `Notas da bancada: disciplina de rotação é o novo jargão do meta`,
      flavor2: () => `Servidores de scrim lotados: a região inteira está no grind`,
      flavor3: () => `O microfone de um caster pegou uma análise bem sincera no intervalo`,
      flavor4: () => `Reclamações de ping registradas. Reclamações de ping arquivadas.`,
      flavor5: () => `Uma montage da comunidade está bombando esta semana`,
      // v2.0 (C1)
      worldsCancelled: () => `Mundial cancelado pela pandemia`,
      orgRelocates: (p: Record<string, string | number>) => `${p.org} troca ${p.from} por ${p.to}`,
      // Season 1 (R133): a redação da Rocket Street — América do Sul. `v` escolhe a linha (0–2).
      rsCupPreview: (p: Record<string, string | number>) =>
        [
          `${p.event}: a chave é neste sábado`,
          `Semana de Rocket Street: o LATAM Championship está de volta`,
          `O campeonato da comunidade sul-americana volta neste sábado`,
        ][Number(p.v ?? 0) % 3],
      rsCupRecap: (p: Record<string, string | number>) =>
        [
          `${p.champion} vence o ${p.event}`,
          `${p.champion} fica com o título do ${p.event}`,
          `${p.event}: o título é de ${p.champion}`,
        ][Number(p.v ?? 0) % 3],
      rsRegionalRecap: (p: Record<string, string | number>) =>
        [
          `${p.champion} vence o ${p.event}`,
          `O ${p.event} fica com ${p.champion}`,
          `${p.champion} bate ${p.runnerUp} e leva o ${p.event}`,
        ][Number(p.v ?? 0) % 3],
      rsBerths: (p: Record<string, string | number>) => {
        const sides = p.t2 ? `${p.t1} e ${p.t2}` : `${p.t1}`;
        return [
          `${sides} ${p.t2 ? "levam" : "leva"} a América do Sul ao ${p.event}`,
          `América do Sul no ${p.event}: ${sides}`,
          `${sides} ${p.t2 ? "garantem" : "garante"} vaga no ${p.event}`,
        ][Number(p.v ?? 0) % 3];
      },
      rsWindowWrap: (p: Record<string, string | number>) =>
        [
          `Janela fecha na América do Sul: ${p.n} ${Number(p.n) === 1 ? "troca" : "trocas"}`,
          `Janela fechada na América do Sul: ${p.player} em ${p.to} é o destaque`,
          `${p.to} contrata ${p.player} no fechamento da janela sul-americana`,
        ][Number(p.v ?? 0) % 3],
    },
    // v0.2 — corpo de texto por template (mesmos params; o feed do QG renderiza).
    body: {
      transferFee: (p: Record<string, string | number>) =>
        `${p.to} acertou a taxa com ${p.from} por ${p.player}. O mapa da região se redesenha de novo.`,
      transferFa: (p: Record<string, string | number>) =>
        `${p.to} confirmou a contratação de ${p.player}, que estava livre no mercado. O jogador chega para integrar o elenco na próxima etapa do circuito.`,
      userSigned: (p: Record<string, string | number>) =>
        `${p.org} anunciou a chegada de ${p.player}. A contratação abre uma nova fase para o jogador e para a organização, que agora se preparam para a primeira apresentação juntos.`,
      userSold: (p: Record<string, string | number>) =>
        `${p.to} chegou a um acordo para contratar ${p.player}, de ${p.org}. Com a transferência concluída, as duas organizações voltam as atenções para os próximos compromissos da temporada.`,
      userTraded: (p: Record<string, string | number>) =>
        `${p.club} e ${p.org} concluíram uma troca de jogadores: ${p.give} segue para lá e ${p.take} entra no elenco.`,
      userReleased: (p: Record<string, string | number>) =>
        `${p.org}pagou a rescisão e seguiu em frente. ${p.player} entra no mercado de agentes livres.`,
      result: (p: Record<string, string | number>) =>
        `${p.org} fecharam o ${p.event}. A bancada vai reprisar essa grande final por semanas.`,
      resultUser: (p: Record<string, string | number>) =>
        `${p.org ?? "A equipe"} encerrou sua participação no ${p.event} em ${p.placement}. O resultado marca mais um capítulo da temporada, enquanto o circuito segue para o próximo compromisso.`,
      resultUserQualified: (p: Record<string, string | number>) =>
        `Três vitórias no Swiss do ${p.event} e a org garantiu a vaga no regional. A qualificatória paga premiação e reputação: os Pontos da Temporada estão em jogo no domingo.`,
      resultUserEliminated: (p: Record<string, string | number>) =>
        `Três derrotas encerraram o ${p.event} da org no Swiss. A premiação entra mesmo assim, e a próxima semana de regional é outra chance.`,
      qualifiedRegional: (p: Record<string, string | number>) =>
        `O Swiss de sábado acabou e a org está entre os oito classificados. ${p.event} é no domingo: os oito diretos esperam.`,
      missedRegional: (p: Record<string, string | number>) =>
        `Três derrotas no Swiss de sábado: o ${p.event} acontece no domingo sem você. Descanse; segunda começa uma nova semana de treino.`,
      qualifiedMajor: () =>
        `A classificação do split travou e o seu nome está acima da linha. Chave inter-regional, pontos em dobro: o teste de verdade.`,
      missedMajor: () =>
        `Abaixo da linha quando ela travou. O próximo split zera a corrida: os pontos de Worlds já garantidos continuam valendo.`,
      qualifiedWorlds: () =>
        `Uma temporada inteira de pontos garantiu. A maior chave do jogo espera: um bracket para tudo.`,
      missedWorlds: () =>
        `Os pontos da temporada não bastaram. A org assiste ao Worlds de casa, e planeja a volta.`,
      stability: (p: Record<string, string | number>) =>
        `Escalar mais uma cara nova no meio do split custou ${p.points} Pontos da Temporada. Reformulação é coisa de pré-temporada.`,
      contractExpiring: (p: Record<string, string | number>) =>
        `O contrato de ${p.player} está acabando. Você tem janela exclusiva de renovação até o fim do Split 3.`,
      contractReminder: (p: Record<string, string | number>) =>
        `A temporada acaba em ${p.weeks} semanas e ${p.players} não têm contrato depois dela. Renove antes da virada, ou eles saem.`,
      regionalSkipped: (p: Record<string, string | number>) =>
        `Só ${p.n} de 3 vagas estão preenchidas, então o elenco não entra na ${p.event}: sem pontos, sem prêmio. A próxima regional pergunta de novo.`,
      eventMissedNoReserve: (p: Record<string, string | number>) =>
        `Um titular ficou indisponível e não havia ninguém no banco, então o elenco não joga ${p.event}: sem pontos, sem prêmio. Um reserva assina na próxima janela de transferências.`,
      playerLeft: (p: Record<string, string | number>) =>
        `A renovação não veio e ${p.player} saiu de graça. Agentes conversam: a próxima negociação começa daí.`,
      retirementAnnounce: (p: Record<string, string | number>) =>
        `${p.player} vai se aposentar no fim da temporada. Uma última campanha juntos: faça valer.`,
      retired: (p: Record<string, string | number>) =>
        `${p.player} deixa o jogo. A cena fica mais jovem, e um pouco mais pobre, hoje.`,
      retiredToCoach: (p: Record<string, string | number>) =>
        `${p.player} se aposenta das competições e vira treinador. O mercado de técnicos ganha um nome novo, que você conhece bem.`,
      retiredLeaves: (p: Record<string, string | number>) =>
        `${p.player} se aposenta e deixa a cena. A org agradece cada temporada com as nossas cores.`,
      orgEnters: (p: Record<string, string | number>) =>
        `Um escudo novo no circuito de ${p.region}: ${p.org} coloca uma line nesta temporada. A história chega no horário, e a tabela fica mais dura.`,
      orgLeaves: (p: Record<string, string | number>) =>
        `${p.org} não monta line nesta temporada e deixa o circuito de ${p.region}. A vaga fica com um nome novo; os jogadores procuram outra casa.`,
      orgNewcomer: (p: Record<string, string | number>) =>
        `Depois de duas temporadas no fundo da tabela de ${p.region}, ${p.old} vende a vaga. ${p.org} entra no circuito com os mesmos jogadores.`,
      stackSigned: (p: Record<string, string | number>) =>
        `O time amador que chegou ao palco grande vira profissional: a ${p.org} contrata a line inteira do ${p.stack} para a nova temporada.`,
      prospectScouted: (p: Record<string, string | number>) =>
        `${p.org} contrata ${p.player} como reserva. Ele vira titular quando for melhor que um dos titulares.`,
      prodigyRises: (p: Record<string, string | number>) =>
        `Os olheiros de ${p.region} concordam: ${p.player} tem teto entre os melhores do mundo. Dê a ele uma ou duas temporadas.`,
      // v2.2 ENDLESS: só o que o save mostra (as contratações e o rating antes e depois).
      endlessProject: (p: Record<string, string | number>) =>
        `${p.org} (${p.region}) contrata ${listPt(p)} para a nova temporada${p.kit ? ` e soma ${kitPt(p.kit)}, as mesmas ferramentas que o clube de um manager pode comprar` : ""}. No papel, o rating do time vai de ${p.before} para ${p.after}.`,
      endlessProjectGrows: (p: Record<string, string | number>) =>
        `${p.org} (${p.region}) mantém a base por mais uma temporada${p.p1 ? `, contrata ${p.p1}` : ""}${p.kit ? ` e soma ${kitPt(p.kit)}` : ""}. O rating do time está em ${p.after}.`,
      endlessGeneration: (p: Record<string, string | number>) =>
        `Os olheiros avaliam os prospectos de elite deste ano um pouco acima dos do ano passado. ${p.player} (${p.region}) encabeça um grupo de ${p.n} que pode chegar ao topo em uma ou duas temporadas.`,
      endlessHosts: (p: Record<string, string | number>) =>
        `As paradas do circuito em ${p.season} estão definidas: Majors em ${hostPt(p.h1)}, ${hostPt(p.h2)} e ${hostPt(p.h3)}, e o Mundial em ${hostPt(p.h4)}.`,
      rookieClass: (p: Record<string, string | number>) =>
        `Nomes novos chegam ao mercado de ${p.region}. ${p.name} é o que os olheiros sublinham.`,
      decline: (p: Record<string, string | number>) =>
        `A idade cobra a mecânica primeiro. ${p.player} está adaptando o próprio jogo: a experiência segue pagando.`,
      windowOpen: () =>
        `Agentes atendendo, taxas circulando, elencos destravados. Negócios resolvem com o passar dos dias; a janela não espera.`,
      windowClosing: () => `Última semana da janela. Propostas de troca sem resposta e jogadores no mercado caducam quando ela fechar; contrate, venda ou retire antes disso.`, // v2.3 SKIP
      windowReport: (p: Record<string, string | number>) =>
        `${p.n} trocas registradas antes da janela fechar. O plantão completo, taxas, agentes livres, todas as regiões, está no QG.`,
      debtCleared: () =>
        `O último pagamento quitou o empréstimo emergencial do banco. Nenhum prazo pesa mais sobre a org.`,
      // rc.34 (ECO-04): um contrato agora dura um split, uma temporada ou duas, com uma meta por split.
      sponsorSigned: (p: Record<string, string | number>) =>
        `${p.org} e ${p.name} assinaram uma parceria: pagamento semanal e um bônus por meta batida. Os termos estão na mesa de Finanças.`,
      unlock: (p: Record<string, string | number>) =>
        `A reputação abriu uma porta nova: ${p.name}. A trilha de progressão mostra o que ainda vem.`,
      registryRepair: () =>
        `Jogadores listados por duas orgs agora ficam em um só elenco, e gamertags repetidas foram renomeadas. Seu elenco, seus contratos e seus resultados não mudaram.`,
      unavailable: (p: Record<string, string | number>) =>
        `${p.player} está fora de ${p.event}: visto, saúde, vida. O sub entra com a química dele.`,
      standIn: (p: Record<string, string | number>) =>
        `Um substituto contratado mantém a org no ${p.event}. Escalação completa, química zero, e dá para notar.`,
      bankLoan: (p: Record<string, string | number>) =>
        `Crédito novo no balanço: ${p.amount}, pago semanalmente. Ambição com dinheiro emprestado ainda é ambição.`,
      emergencyBid: (p: Record<string, string | number>) =>
        `Com as contas da org no vermelho, ${p.org} vão atrás de ${p.player} com desconto. Venda rápida ou briga para segurar: a decisão é do manager.`,
      bankCleared: () =>
        `A parcela final caiu. O que o dinheiro comprou, a org agora tem de verdade.`,
      cashWarning: (p: Record<string, string | number>) =>
        `Os custos semanais passam a receita e a reserva está em ${p.weeks} semanas. Quem ignora isso acaba no balcão de emergência do banco.`,
      backerIn: () =>
        `O piso rompeu e o aporte do investidor caiu. O reembolso sai descontado da premiação e das vendas até quitar: a caixa de entrada diz o que a próxima quebra significaria.`,
      emergencyLoan: () =>
        `O piso rompeu e o banco depositou um empréstimo emergencial. Premiações e vendas abatem parte dele, e ele tem prazo. A caixa de entrada traz as condições.`,
      emergencyTopUp: () =>
        `Abaixo do piso de novo antes de quitar: o banco somou ao empréstimo. O prazo não mudou.`,
      loanCollected: () =>
        `Dia do prazo, e o saldo cobriu a dívida: o banco cobrou o que era devido. A org segue em frente.`,
      insolvency: () =>
        `O colapso final. Salários sem pagar, cadeiras vazias, servidores no escuro: a história da org termina no livro-caixa.`,
      seasonChampion: (p: Record<string, string | number>) =>
        `${p.org} levantam o troféu do ${p.event}. A régua de todo mundo acabou de subir.`,
      incomingBid: (p: Record<string, string | number>) =>
        `${p.org} querem ${p.player} e puseram dinheiro na mesa. A decisão, e as consequências, são suas.`,
      gearBought: (p: Record<string, string | number>) =>
        `O upgrade de ${p.name} chegou. A eficiência de treino sobe: os jogadores notaram na hora.`,
      bootcampRun: () =>
        `Uma semana sob o mesmo teto faz o que agenda nenhuma faz: o elenco joga como se dividisse um cérebro. Próximo oficial mais afiado, e mais entrosados para sempre.`,
      coachHired: (p: Record<string, string | number>) =>
        `${p.coach} assume o quadro branco de ${p.org}. Ritmo de desenvolvimento e preparação de jogo agora respondem ao banco.`,
      scrimWin: (p: Record<string, string | number>) =>
        `Um set limpo de portas fechadas contra ${p.opponent}. Reps no bolso, química em alta, nada vazou para o plantão: quase.`,
      scrimLoss: (p: Record<string, string | number>) =>
        `${p.opponent} levou o set de scrim. Derrota de portas fechadas é a lição mais barata dos esports.`,
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} vieram com intenção real por ${p.player}. A história quer essa transferência: você decide se ela acontece.`,
      // Histórico do rc.32 (ECO-08 / ECO-12): nada os envia desde o rc.33 — ficam para o feed de um save antigo.
      restructured: (p: Record<string, string | number>) =>
        `A org fechou de novo abaixo do piso e o Investidor forçou a mão${p.player ? `: ${p.player} vai para ${p.org}` : ""}. A reputação sente; ${Number(p.granted) > 0 ? "as contas voltam a ter fôlego" : "a venda cobre as contas"}. ${legacyNextBreachPt(p.next)}`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} responderam ao anúncio com uma proposta formal por ${p.player}. Aceite antes de a janela fechar, ou fique com ele.`,
      listed: (p: Record<string, string | number>) =>
        `A org colocou ${p.player} no mercado. Uma proposta de um time que o escalaria chega em poucos dias de janela.`,
      repDown: (p: Record<string, string | number>) =>
        `As expectativas foram declaradas e não cumpridas; o prestígio de ${p.org} sente. Reputação se recupera do mesmo jeito que se constrói.`,
      // v2.0 (C1)
      orgRelocates: (p: Record<string, string | number>) =>
        Number(p.withRoster)
          ? `${p.org} está deixando ${p.from}. A org se inscreveu em ${p.to} para a nova temporada e leva o elenco junto: os mesmos jogadores, uma região nova para provar seu valor.`
          : `${p.org} está trocando ${p.from} por ${p.to} e recomeça lá com um elenco novo. Os jogadores que ficam para trás estão livres no mercado.`,
      worldsCancelled: () =>
        `A liga cancelou o Mundial desta temporada: com as viagens fechadas pela pandemia, não há como reunir as regiões. O Split 3 e o seu Major seguem como planejado, e a temporada termina depois deles. Nenhum título mundial é entregue neste ano; a corrida recomeça na próxima temporada.`,
      // Season 1 (R133): a redação da Rocket Street — América do Sul. `v` escolhe a linha (0–2).
      rsCupPreview: (p: Record<string, string | number>) =>
        [
          `A Rocket Street abre a chave neste sábado: times da América do Sul, eliminação simples, tudo em um dia. ${p.org} está na lista, e o convite está no calendário.`,
          `O campeonato da comunidade da região é disputado no sábado, do começo ao fim em um dia. ${p.org} tem um convite esperando no calendário.`,
          `Uma chave, um dia e a cena inteira de olho: o ${p.event} é neste sábado. ${p.org} recebeu o convite; a inscrição está no calendário.`,
        ][Number(p.v ?? 0) % 3],
      rsCupRecap: (p: Record<string, string | number>) =>
        Number(p.won)
          ? `${p.champion} venceu ${p.runnerUp} na final e leva o troféu da comunidade para casa. Um título conquistado diante da cena da região.`
          : `${p.champion} venceu ${p.runnerUp} na final da chave da Rocket Street.${p.org && p.org !== p.runnerUp ? ` ${p.org} terminou: ${p.placement}.` : ""}`,
      rsRegionalRecap: (p: Record<string, string | number>) =>
        [
          `${p.champion} venceu ${p.runnerUp} na grande final do ${p.event}. Os Pontos da Temporada entram na tabela da América do Sul.`,
          `O Split ${p.split} tem mais um vencedor: ${p.champion} fechou o ${p.event} com vitória sobre ${p.runnerUp} na grande final.`,
          `${p.runnerUp} chegou à grande final do ${p.event}, e ${p.champion} saiu com o título e a maior fatia dos pontos.`,
        ][Number(p.v ?? 0) % 3],
      rsBerths: (p: Record<string, string | number>) => {
        const sides = p.t2 ? `${p.t1} e ${p.t2}` : `${p.t1}`;
        return [
          `Os participantes do ${p.event} estão definidos. ${sides} ${p.t2 ? "representam" : "representa"} a América do Sul.`,
          `As vagas da América do Sul no ${p.event} estão decididas: ${sides}. A tabela fechou com ${p.t2 ? "os dois times" : "o time"} acima da linha de corte.`,
          `${sides} ${p.t2 ? "carregam" : "carrega"} a bandeira da região no ${p.event}. O resto da América do Sul recomeça a corrida.`,
        ][Number(p.v ?? 0) % 3];
      },
      rsWindowWrap: (p: Record<string, string | number>) => {
        const one = Number(p.n) === 1;
        return [
          `A América do Sul registrou ${p.n} ${one ? "troca" : "trocas"} antes de a janela fechar. O destaque: ${p.player} em ${p.to}${Number(p.paid) ? ` por ${p.fee}` : ", que estava livre no mercado"}.`,
          `O mercado fechou de novo na América do Sul. A chegada de ${p.player} a ${p.to}${Number(p.paid) ? ` por ${p.fee}` : " sem custo de transferência"} foi o negócio da janela; no total, a região registrou ${p.n} ${one ? "troca" : "trocas"}.`,
          `Elencos travados até a próxima janela. ${p.to} fez a maior contratação da região com ${p.player}${Number(p.paid) ? ` (${p.fee})` : ""}; a América do Sul registrou ${p.n} ${one ? "troca" : "trocas"} no total.`,
        ][Number(p.v ?? 0) % 3];
      },
    },
  },

  achievements: {
    title: "Conquistas da carreira",
    hint: "Permanentes: valem em todos os saves e sobrevivem ao reset de season. Cada uma paga Season XP uma vez; as grandes liberam cosméticos.",
    // rc.6 (R171): uma org consolidada não ganha nenhuma; elas são do caminho do clube fundado.
    foundedOnly: "Conquistadas no caminho do clube fundado, o clube que você monta. Temporadas numa organização consolidada não contam para elas.",
    unlocked: "Conquista desbloqueada",
    lockedLabel: "Bloqueada",
    unlockedOn: (date: string) => `Desbloqueada em ${date}`,
    xp: (n: number) => `+${n} Season XP`,
    progress: (done: number, total: number) => `${done} de ${total}`,
    showAll: (n: number) => `Ver todas as ${n}`,
    showLess: "Ver menos",
    tier: { common: "Comum", rare: "Rara", epic: "Épica", legend: "Lenda" } as Record<string, string>,
    // rc.36 (UX-05, #155): the achievements' names and descriptions moved to the core copy
    // (ACH_UI.careerItems) — one source, read by the general list and the career screens.
  },

  inserts: {
    kinds: { random: "Missão paralela", sponsor: "Pedido do patrocinador", training: "Decisão de treino" } as Record<string, string>,
    expires: "Decida hoje: o momento passa com o dia.",
    fx: {
      rep: (n: number) => `${n > 0 ? "+" : ""}${n} rep`,
      chemistry: "+ química",
      training: (w: number) => (w > 0 ? `+${w} semanas de treino` : `${w} semanas de treino`),
      none: "Sem efeito",
      // rc.2 linhas com ícone
      money: "Caixa",
      repLabel: "Reputação",
      chemLabel: "Química",
      trainingLabel: "Treino",
      trainingWeeks: (w: number) => `${w > 0 ? "+" : ""}${w} sem`,
    },
    items: {
      "ins-showmatch": { title: "Um streamer quer um showmatch", body: "Chegou um convite para um amistoso ao vivo. O cachê já está combinado, mas o elenco precisaria abrir mão de uma tarde de treino.", a: "Jogar", b: "Passar" },
      "ins-5050-showmatch": { title: "Um convite do 50/50", body: "O 50/50 está preparando um showmatch e quer sua organização na transmissão. Há um cachê pela participação e a chance de alcançar um novo público; a comissão precisará remanejar uma tarde de treino.", a: "Participar do showmatch do 50/50", b: "Manter a agenda de treinos" },
      "ins-duds-showmatch": { title: "O DudsMelow tem uma vaga na live", body: "O DudsMelow está organizando um showmatch com a comunidade e convidou seu elenco. Os jogadores se animaram e o cachê ajuda, mas o treino daquele dia terminaria mais cedo.", a: "Aceitar o convite do DudsMelow", b: "Ficar de fora desta vez" },
      "ins-charity-cup": { title: "Copa beneficente", body: "Uma copa beneficente local quer sua org no cartaz. Custa pouco e compra boa vontade.", a: "Aparecer", b: "Recusar" },
      "ins-pc-dies": { title: "Um PC morre no meio da semana", body: "Uma das máquinas de torneio pifou. Troque agora ou empreste uma reserva e perca tempo de treino.", a: "Trocar", b: "Emprestar uma reserva" },
      "ins-fan-meetup": { title: "A torcida pede um encontro", body: "A torcida quer um encontro depois do treino. Um custo pequeno, um pouco de prestígio.", a: "Organizar", b: "Não esta semana" },
      "ins-media-day": { title: "Pedido de media day", body: "A imprensa quer um dia inteiro com o elenco. Bom para a marca, uma sessão mais curta.", a: "Media day completo", b: "Manter o mínimo" },
      "ins-sponsor-content": { title: "Seu patrocinador quer um dia de conteúdo", body: "O patrocinador pede um dia de conteúdo com os jogadores. Paga, e o treino paga por isso.", a: "Gravar o conteúdo", b: "Recusar com educação" },
      "ins-sponsor-jersey": { title: "Foto de lançamento da camisa", body: "O patrocinador quer revelar a camisa nova no próximo evento com uma sessão de fotos. Dinheiro rápido e um pouco de prestígio.", a: "Fazer o lançamento", b: "Pular" },
      "ins-rest-request": { title: "Um titular pede uma semana mais leve", body: "O elenco está cansado. Sessões mais leves mantêm o clima; insistir mantém o ritmo.", a: "Aliviar a semana", b: "Insistir" },
      "ins-lan-bootcamp": { title: "Uma LAN house oferece um bootcamp barato", body: "Uma LAN house local oferece ao elenco um fim de semana sob o mesmo teto por um valor fixo.", a: "Reservar", b: "Passar" },
      "ins-coach-clinic": { title: "O coach propõe uma clínica", body: "O coach quer rodar uma clínica focada nesta semana: um custo pequeno, um passo real.", a: "Rodar a clínica", b: "Agora não" },
    } as Record<string, { title: string; body: string; a: string; b: string }>,
  },

  club: {
    honorsEntityFilter: "Comparar organizações ou jogadores",
    honorsEventFilter: "Competição dos títulos",
    honorsTitles: "Títulos",
    honorsEmpty: "Ainda não há títulos registrados nesta competição.",
    honorsAll: "Classificação completa de títulos",
    honorsTitle: "Corrida pela história",
    honorsHint: "Títulos reais até a Season 9, somados aos resultados desta carreira. Majors RLCS começam na Season X.",
    honorsOrgs: "Organizações",
    honorsPlayers: "Jogadores",
    honorsLegacy: "Em saves antigos, títulos individuais são registrados a partir desta atualização.",
    title: "Clube",
    identity: "Identidade",
    manager: "Manager",
    founded: "Fundada em",
    region: "Região",
    reputation: "Reputação",
    repNext: (v: number, label: string) => `Próximo em ${v}: ${label}`,
    stars: "Rating do time",
    starLabel: (n: number) => `Org ${n} estrelas`,
    trophies: "Sala de troféus",
    trophyEmpty: "A prateleira está esperando.",
    worldsPedestal: "O pedestal do Worlds",
    records: "Recordes",
    recordPrize: "Premiação total",
    recordSeries: "Retrospecto em séries",
    recordBiggestFee: "Maior contratação",
    recordTitles: "Títulos",
    seasonHistory: "Histórico de temporadas",
    editColors: "Re-tintar cores",
    progression: "Progressão",
    progressionDesc: "Tudo o que ainda está pela frente desta org.",
    unlockAt: (v: number) => `Desbloqueia com ${v} de Reputação`,
    unlockWorlds: "Desbloqueia com uma vaga no Worlds",
    unlockFuture: "Atualização futura",
    unlocked: "Desbloqueado",
    unlockables: {
      peripherals: "Periféricos pro",
      monitors: "Monitores 240Hz",
      pcs: "PCs de torneio",
      bootcamp1: "Bootcamp",
      bootcamp2: "Bootcamp estruturado",
      psychologist: "Psicóloga esportiva",
      assistant: "Assistente técnico",
      analyst: "Analista de adversários",
      physio: "Preparador físico",
      brand: "Gerente de marca",
      perfCenter: "Centro de Performance",
      coach: "Contratação de coach",
      t2: "Circuito de Invitationals",
      sponsorT2: "Patrocinadores Challenger",
      sponsorT3: "Patrocinadores globais",
      sponsorT4: "Patrocinadores master (topo)",
      exProCoach: "Coaches ex-pro",
      sponsors1: "Patrocinadores locais",
      sponsors2: "Patrocinadores Challenger",
      sponsors3: "Patrocinadores globais",
      sponsors4: "Patrocinadores master (topo)",
      relocation: "Mudança de região",
      star5: "Status 5 estrelas",
    },
    editCrest: "Editar escudo",
    settings: "Opções da carreira",
    // v2.1 Matchday fatia 3: o rótulo da opção e suas escolhas (a tela vem na fatia 5).
    matchdayMode: {
      label: "Dia de jogo",
      quick: "Rápido: o técnico decide",
      custom: "Personalizado: seu plano e suas pausas",
      stopAt: "O personalizado para em",
      stopEvery: "Toda série",
      stopPlayoffs: "Playoffs e eventos LAN",
      quickHint: "O técnico faz o plano e as decisões entre os jogos. O evento nunca para.",
      customHint: "Antes da sua série o evento para: você define o plano e decide entre os jogos.",
    },
    abandonCareer: "Abandonar carreira",
    abandonConfirm: "Isto apaga o save permanentemente. Os troféus vão junto.",
  },

  event: {
    placementLabel: "Colocação",
    rewardsTable: "Premiação por colocação",
    communityLineup: (n: number) => `Seu elenco para o ${n}v${n}`,
    communityLineupHint: "Escolha quem joga este campeonato comunitário.",
    communitySeat: (n: number) => `Jogador ${n}`,
    lobbyTitle: "Lobby do evento",
    format: "Formato",
    formatSwiss: "Swiss de 16 times → top-8 em eliminação dupla",
    formatSingle: "Mata-mata de 8 times",
    yourSeed: (n: number) => `Seed nº ${n}`,
    watch: "Jogar a série",
    instant: "Resultado instantâneo",
    simToEnd: "Simular até o fim",
    skipSeries: "Pular série",
    lockIn: "Confirmar escalação",
    lineupLocked: "Escalação travada para o evento",
    roundLabel: (n: number) => `Rodada ${n}`,
    swissStage: "Fase Swiss",
    playoffs: "Playoffs",
    grandFinal: "Grande Final",
    thirdPlace: "Terceiro lugar",
    semifinal: "Semifinal",
    quarterfinal: "Quartas de final",
    upperBracket: "Chave superior",
    lowerBracket: "Chave inferior",
    game: (n: number) => `Jogo ${n}`,
    goal: "GOL",
    overtime: "PRORROGAÇÃO",
    // GAME-04 — linha do tempo dos gols + apresentação da prorrogação
    goldenGoal: "GOL DE OURO",
    endOfRegulation: "Fim do tempo normal",
    gameClock: "Relógio da partida",
    playByPlay: "Lance a lance",
    seriesTag: "Série",
    matchPoint: "Match point",
    deciding: "Jogo decisivo",
    upset: "ZEBRA",
    seriesWin: (name: string) => `${name} levam a série`,
    sweep: "Uma varrida limpa",
    reverseSweep: "REVERSE SWEEP",
    eliminated: "Sua campanha termina aqui",
    advancing: "Avança para a próxima rodada",
    champion: (name: string) => `${name}: CAMPEÕES`,
    yourResult: (placement: string) => `Colocação final: ${placement}`,
    earned: "Conquistado",
    unavailableNotice: (player: string) => `${player} está fora desta: próximo da fila.`,
    aiTicker: "Pelo chaveamento",
    speed: "Velocidade",
    // Reconstrução v0.2 — classificação ao vivo, chaveamento, match center
    standings: "Classificação",
    bracket: "Chaveamento",
    matchCenter: "Match center",
    throughRound: (n: number) => `Até a rodada ${n}`,
    record: "V-D",
    gameDiff: "SG",
    // rc.29 (CAR-05): curto — "Classificado" cortava o nome do time no trilho de 1280 px.
    advancedTag: "Avançou",
    eliminatedTag: "Fora",
    liveTag: "AO VIVO",
    nextUp: "A seguir",
    yourMatch: "Sua série",
    starOfSeries: (name: string) => `Destaque da série: ${name}`,
    scorerLine: (name: string, n: number) => `${name} ×${n}`,
    resultsDigest: "Resumo de resultados",
    digestPlacement: "Colocação",
    digestPrize: "Premiação",
    // rc.32 (M6, provisório): a parte dos jogadores lançada de um prêmio de pódio.
    digestPlayerShare: (s: string) => `Parte dos jogadores −${s}`,
    digestPoints: "Pontos da Temporada",
    digestRep: "Reputação",
    // rc.33 (RTW-02): reputação paga pelo caminho do estreante (um resultado acima do seed).
    digestRepUnderdog: "Campanha de azarão: a cena repara",
    digestTopScorer: "Artilheiro",
    continueToHq: "Voltar ao QG",
    continueToReview: "Balanço da temporada",
    fieldTitle: "A chave",
    avgOvr: "OVR médio",
    seedLabel: "Seed",
    // v2.0 (R40) — o fim de semana: qualificatória no sábado → regional no
    // domingo; Major / Worlds: fase Swiss no sábado → Championship Sunday
    // (nome do evento, mantido em inglês como Swiss / Major / Worlds).
    formatQualifier: (teams: number, slots: number, wins: number, regional: string) =>
      `Swiss de ${teams} times · os ${slots} que chegarem a ${wins} vitórias garantem vaga no ${regional} de domingo`,
    formatTwoDay: (teams: number, playoffTeams: number) =>
      `Sábado: Swiss de ${teams} times · Domingo: top-${playoffTeams} em eliminação dupla`,
    championshipSunday: "Championship Sunday",
    directSunday: "Já classificados para domingo",
    weekendTitle: "O fim de semana",
    roleQualifierSub: (teams: number, slots: number) => `Swiss de ${teams} times · top ${slots} avançam`,
    roleRegionalSub: (direct: number, qualified: number) => `${direct} diretos + ${qualified} de sábado`,
    roleSwissSub: (teams: number, wins: number) => `Swiss de ${teams} times · ${wins} vitórias para avançar`,
    roleSundaySub: (playoffTeams: number) => `Top-${playoffTeams} em eliminação dupla`,
    entryQualified: "Você se classificou",
    entryDirect: "Vaga direta",
    spots: "Vagas",
    spotsValue: (slots: number, teams: number) => `${slots} de ${teams}`,
    qualifiedTag: "Q",
    qualifiedTagHint: "Veio da qualificatória de sábado",
    simSwiss: "Simular o Swiss",
    qualified: "Classificado",
    eliminatedTitle: "Eliminado",
    qualifiedForSunday: "Classificado para domingo",
    eliminatedInSwiss: "Eliminado no Swiss",
    qualifiedFor: (regional: string) => `Vaga garantida no ${regional} de domingo`,
    regionalWithoutYou: (regional: string) => `O ${regional} segue no domingo sem você`,
    throughToSunday: "Classificado para o Championship Sunday",
    seedLocks: "Seu seed se define quando a última rodada do Swiss acabar",
    sundayWithoutYou: "Os playoffs de domingo seguem sem você",
    swissComplete: "Fase Swiss encerrada",
    playoffEight: "Os oito dos playoffs",
    pauseHint: "Nada de domingo é jogado até você continuar.",
    continueToSunday: "Seguir para o Championship Sunday",
    continueToSundayShort: "Seguir para domingo",
    sundaySub: (playoffTeams: number, bestOf: number) =>
      `Top ${playoffTeams} · eliminação dupla · melhor de ${bestOf}`,
    sundayOpener: (opp: string, seed: number, oppSeed: number) =>
      `Seed nº ${seed}: sua estreia é contra ${opp} (nº ${oppSeed})`,
    sundaySpectating: "Fora no Swiss: hoje a taça é decidida sem você",
    startNow: "Começar agora",
    startPlayoffs: "Começar os playoffs",
    tapToSkip: "Toque em qualquer lugar para pular",
    swissRecord: "Campanha",
    qualifiedEight: "Classificados para domingo",
    onToSunday: "Rumo ao domingo",
    // rc.29 — correções do E2E (CAR-03 · CAR-10)
    /** Ponteiro fino (mouse): o card de abertura pula com um clique ou Esc. */
    clickToSkip: "Clique ou aperte Esc para pular",
    /** Movimento reduzido: a última rodada do dia aparece antes; os resultados esperam este clique. */
    seeResults: "Ver resultados",
    seeSwissResult: "Ver o resultado do Swiss",
    /** Selo dos playoffs quando o usuário não tem seed: a campanha de sábado, rotulada. */
    swissRecordBadge: (record: string) => `Swiss ${record}`,
  },

  // rc.36 (SUN-01..03, R88) — o fim de semana: sábado → QG → domingo.
  sunday: {
    today: "Hoje",
    todayHint: "A preleção vale para este evento. O calendário permanece no domingo.",
    backToCalendar: "Avançar",
    tomorrow: "Amanhã",
    qualifiedLine: "Classificado pela qualificatória de sábado",
    seedLine: (seed: number, record: string) => `Seed nº ${seed} · Swiss ${record}`,
    openerLabel: "Sua estreia",
    fieldLabel: "Quem joga no domingo",
    briefingTitle: "Preleção do técnico",
    briefingHint: "Foque no Swiss inteiro ou nos playoffs. Bootcamp e preleção somam no máximo +2 de rating.",
    championshipBriefing: { keep: "Preparação equilibrada", recover: "Pico na grande final", prepare: "Força nas primeiras rodadas" },
    championshipHint: "Priorize quartas e semis (com a repescagem) ou a grande final. Bootcamp e preleção somam no máximo +2.",
    effectChampionship: (q: number, s: number, o: number, f: number) => `Quartas ${q > 0 ? "+" : ""}${String(q).replace(".", ",")}; semis ${s > 0 ? "+" : ""}${String(s).replace(".", ",")}; demais rodadas ${o > 0 ? "+" : ""}${String(o).replace(".", ",")}; grande final ${f > 0 ? "+" : ""}${String(f).replace(".", ",")}.`,
    effectLaterOnly: (n: number) => `${n > 0 ? "+" : ""}${String(n).replace(".", ",")} nas séries seguintes dos playoffs.`,
    effectLater: (opening: number, later: number) => `${opening > 0 ? "+" : ""}${String(opening).replace(".", ",")} na abertura dos playoffs; ${later > 0 ? "+" : ""}${String(later).replace(".", ",")} nas séries seguintes dos playoffs.`,
    effectStudyRest: (n: number) => `Sem bônus no restante do Swiss; ${String(n).replace(".", ",")} nos playoffs.`,
    briefing: {
      keep: "Continuidade",
      recover: "Recuperar",
      prepare: "Estudar o Swiss",
    },
    effectContinuity: (n: number) => `+${String(n).replace(".", ",")} de rating em todas as séries; sem risco extra.`,
    effectPlayoffs: (n: number) => `${n > 0 ? "+" : ""}${n} em todas as séries dos playoffs.`,
    effectTradeoff: (first: number, later: number) => `${first > 0 ? "+" : ""}${String(first).replace(".", ",")} no Swiss; ${later > 0 ? "+" : ""}${String(later).replace(".", ",")} nos playoffs.`,
    effectKeep: "Nada muda: a rotina que trouxe vocês até aqui.",
    effectRecover: (n: number) => `+${String(n).replace(".", ",")} de rating do time em todas as séries de hoje`,
    effectPrepare: (n: number) => `+${String(n).replace(".", ",")} de rating do time na sua série de estreia`,
    effectPrepareVs: (n: number, opp: string) =>
      `+${String(n).replace(".", ",")} de rating do time contra ${opp}, sua estreia`,
    start: "Começar o domingo",
    startHint: "Um dia adiante. Domingo não tem treino nem folha de pagamento.",
    fromHqHint: "O domingo começa no QG, com a preleção do técnico se você quiser.",
    briefingChip: (label: string) => `Preleção · ${label}`,
    outTitle: "Championship Sunday sem você",
    outLine: (record: string) => `Fora no Swiss (${record}). Os oito dos playoffs disputam a taça.`,
    watch: "Assistir ao domingo",
    results: "Só os resultados",
    skip: "Pular",
    outHint: "Assista ao chaveamento, leia os resultados ou siga em frente: o resultado é o mesmo.",
    withoutYouTitle: (event: string) => `${event} sem você`,
    withoutYouLine: "Fora na qualificatória de sábado. O regional de domingo segue: acompanhe ou siga em frente.",
    whoQualified: "Classificados na qualificatória de sábado",
    resultsInTitle: (event: string) => `${event}: saíram os resultados`,
    resultsInLine: "Você não estava nele. Reveja rodada a rodada ou leia os resultados.",
    replay: "Rever",
    readResults: "Resultados",
    hide: "Ocultar",
  },

  // rc.36 (SUN-03, R88) — /career/follow: um evento sem você.
  follow: {
    swissStandings: "Classificação do Swiss",
    kicker: "Da arquibancada",
    reasonEliminated: "Fora na qualificatória",
    reasonNotQualified: "Fora do evento",
    field: "Quem está no evento",
    direct: "Direto",
    swissRound: (n: number) => `Rodada ${n} do Swiss`,
    standings: "Classificação do Swiss",
    playoffs: "Playoffs",
    results: "Resultado final",
    champion: "Campeão",
    watch: "Assistir",
    resultsTab: "Resultados",
    nextRound: "Próxima rodada",
    pause: "Pausar",
    play: "Continuar",
    skipToResults: "Pular para os resultados",
    backToHq: "Voltar ao QG",
    nothing: "Nenhum evento para acompanhar agora: ele aparece aqui quando um evento segue sem você.",
    progress: (n: number, total: number) => `Rodada ${n} de ${total}`,
    upcoming: "Ainda por jogar",
    teams: (n: number) => `${n} times`,
  },

  spectate: {
    title: "Do sofá",
    watchParty: "Assistindo de casa",
    digestTitle: "Resumo de resultados",
    meaning: "O que isso significa para você",
    followedResult: (org: string, placement: string) => `${org} terminam em ${placement}`,
  },

  ceremonies: {
    splitRecap: "Resumo do split",
    saveAndRest: "Salvar e descansar",
    keepGoing: "Seguir para a janela",
    seasonReview: "Balanço da temporada",
    seasonGrade: (g: string) => `Nota da temporada: ${g}`,
    expected: (label: string) => `Esperado: ${label}`,
    delivered: (label: string) => `Entregue: ${label}`,
    devRecap: "Desenvolvimento",
    bizRecap: "Negócios",
    rolloverTitle: (label: string) => `Começa a ${label}`,
    rolloverCta: "Iniciar a temporada",
    worldsChampion: (name: string) => `${name}: CAMPEÕES MUNDIAIS`,
    yourTitle: "CAMPEÕES MUNDIAIS",
    creditsJourney: "A estrada até aqui",
    creditsRoster: "O elenco que conseguiu",
    finalWhistle: "Apito final",
    finalWhistleBody: "A temporada 2026 fecha o livro, mas não a história da org.",
    insolvencyTitle: "Insolvência",
    insolvencyBody: "As contas fecharam abaixo do piso uma vez a mais do que esta dificuldade tolera. A história da org termina aqui.",
    // rc.34 (end.moneyCause "deadline"): o empréstimo emergencial sem pagar no prazo.
    insolvencyBodyDeadline:
      "O empréstimo emergencial venceu e o saldo não cobria a dívida. O banco cobrou o empréstimo: a história da org termina aqui.",
    legacyTitle: "Legado da carreira",
    legacyGrade: { legend: "Lenda", contender: "Contendor", challenger: "Desafiante", journeyman: "Batalhador" },
    retire: "Aposentar",
    retireDesc: "A carreira é arquivada: troféus e histórico continuam visíveis.",
    infinite: "Era infinita",
    infiniteDesc: "A linha do tempo agora é sua. Sem roteiro, só a simulação.",
    infiniteExplainer:
      "A partir de 2027 o mundo é totalmente procedural: novatos são gerados, veteranos se aposentam, a história é a que você fizer.",
    defendTitle: "Defender o título",
  },

  cloud: {
    synced: (when: string) => `Salvo na sua conta · ${when}`,
    pending: "Alterações aguardando para serem salvas na sua conta",
    syncing: "Salvando na sua conta…",
    conflict: "Duas cópias desta carreira",
    choose: "Escolher",
    newer: "A cópia na sua conta foi salva por uma versão mais nova do jogo. Recarregue para atualizar.",
    error: "Não foi possível acessar a sua conta. Vamos tentar de novo.",
    tryNow: "Tentar agora",
    restoring: "Restaurando da sua conta…",
    exportSave: "Exportar save",
    importSave: "Importar arquivo de save",
    importErrors: {
      unreadable: "Não foi possível ler esse arquivo.",
      "not-a-save": "Esse não é um save de carreira do Rocket Draft.",
      newer: "Esse save vem de uma versão mais nova do jogo. Recarregue para atualizar e importe de novo.",
      damaged: "Esse arquivo está incompleto ou danificado.",
      invalid: "O jogo não conseguiu carregar esse save.",
      "slot-taken": "Este espaço já tem uma carreira.",
    },
    deleteAlso: "A cópia na sua conta também é apagada.",
    helpActive: "Suas carreiras também ficam salvas na sua conta. Exporte um arquivo de save para ter o seu próprio backup.",
    helpLocal: "As carreiras ficam salvas neste navegador. Exporte um arquivo de save para levar uma para outro aparelho ou guardar um backup.",
    helpSignIn: "Entre para manter uma cópia na sua conta.",
    notice: {
      titleDiverged: "Esta carreira foi jogada em dois aparelhos",
      titleDifferent: "Este espaço guarda uma carreira diferente na sua conta",
      titleDeleted: "Esta carreira foi apagada da sua conta",
      bodyDiverged: "As duas cópias não podem ser combinadas. Escolha a que fica; a outra é substituída.",
      bodyDifferent: "Escolha a carreira que fica neste espaço; a outra é substituída.",
      bodyDeleted: "Ela foi apagada em outro aparelho. Mantenha aqui e ela volta para a sua conta, ou apague aqui também.",
      thisDevice: "Este aparelho",
      account: "Sua conta",
      mostRecent: "Mais recente",
      keepDevice: "Manter a carreira deste aparelho",
      useAccount: "Usar a carreira da sua conta",
      keepHere: "Manter aqui",
      deleteHere: "Apagar aqui também",
      exportFirst: "Exportar a carreira deste aparelho antes",
      decideLater: "Decidir depois",
      seasonWeek: (season: string, week: string) => `${season} · ${week}`,
    },
    toast: {
      updated: (org: string) => `${org}: atualizada pela sua conta (jogada em outro aparelho).`,
      restored: (org: string) => `${org}: restaurada da sua conta.`,
    },
  },

  saves: {
    title: "Carreiras",
    empty: "Fundar uma nova org",
    resume: "Retomar",
    archived: "Arquivada",
    champion: "CAMPEÕES",
    endedInsolvent: "Insolvente",
    endedRetired: "Aposentada",
    delete: "Apagar",
    deleteConfirm: (org: string, n: number) =>
      `Apagar ${org}? ${n} temporada${n === 1 ? "" : "s"} de história somem. Permanente e local.`,
    lastPlayed: "Jogado por último",
    newCareer: "Nova carreira",
    slotsFull: "Os três espaços estão ocupados.",
  },

  // v2.0.31: o convite da pesquisa com jogadores na revisão da temporada.
  savesNotice: {
    title: "Suas carreiras em qualquer aparelho",
    body: "Você pode ter até três carreiras ao mesmo tempo: Carreiras, na barra do topo, lista todas. Com a conta conectada, cada uma também fica guardada nela, e a mesma carreira abre no celular e no computador.",
    open: "Ver minhas carreiras",
    dismiss: "Entendi",
  },

  research: {
    title: "Ajude a moldar o Road to Worlds",
    body: "Uma temporada fechada. A sua leitura da carreira e do draft ajuda a decidir o que vem a seguir. Um formulário curto sobre o que funciona, o que não funciona e o que falta.",
    note: "Abre em uma nova aba. Só perguntamos uma vez.",
    open: "Abrir o formulário",
    dismiss: "Agora não, obrigado",
  },

  goals: {
    reward: (n: number) => `+${n} reputação na revisão`,
    reachMajor: "Alcançar um Major",
    regionalTop4: "Um top-4 regional",
    majorTop8: "Um top-8 de Major",
    majorTop4: "Um top-4 de Major",
    qualifyWorlds: "Classificar para o Worlds",
    worldsTop4: "Um top-4 no Worlds",
    winMajor: "Vencer um Major",
    winWorlds: "Vencer o Worlds",
    // rc.35 (front S): meta da temporada pelo modelo de nível dos patrocinadores — em qualquer split.
    model: (kind: string, count: number, place: number): string => {
      switch (kind) {
        case "enterEvents":
          return `Disputar ${count} eventos em um split`;
        case "regionalReach":
          return count === 1 ? "Chegar a um regional" : `Chegar a ${count} regionais em um split`;
        case "regionalFinish":
          if (place <= 1) return count === 1 ? "Vencer um regional" : `Vencer ${count} regionais em um split`;
          return count === 1 ? `Um top ${place} em regional` : `Top ${place} em ${count} regionais de um split`;
        case "majorQualify":
          return "Chegar a um Major";
        case "majorFinish":
          return place <= 1 ? "Vencer um Major" : `Um top ${place} em Major`;
        default:
          return "";
      }
    },
    repRisk: (n: number) => `Sua reputação espera isso (−${n} se falhar)`,
    season: (kind: string, count: number, place: number): string => {
      switch (kind) {
        case "cupFinal":
          return count === 1 ? "Chegue a uma final de Community Cup" : `Chegue a ${count} finais de Community Cup`;
        case "cupWin":
          return count === 1 ? "Vença uma Community Cup" : `Vença ${count} Community Cups`;
        case "regionalReach":
          return count === 1 ? "Jogue um regional de domingo" : `Jogue ${count} regionais de domingo`;
        case "regionalFinish":
          if (place <= 1) return count === 1 ? "Vença um regional" : `Vença ${count} regionais`;
          return count === 1 ? `Um top ${place} em regional` : `Top ${place} em ${count} regionais`;
        case "majorQualify":
          return count === 1 ? "Classifique-se para um Major" : count === 3 ? "Classifique-se para os três Majors" : `Classifique-se para ${count} Majors`;
        case "majorFinish":
          // rc.6 (R172): uma contagem acima de um se perdia ("Vença um Major" para dois títulos).
          if (place <= 1) return count === 1 ? "Vença um Major" : `Vença ${count} Majors`;
          return count === 1 ? `Um top ${place} em Major` : `Top ${place} em ${count} Majors`;
        case "worldsQualify":
          return "Classifique-se para o Worlds";
        case "worldsFinish":
          return place <= 1 ? "Vença o Worlds" : `Um top ${place} no Worlds`;
        default:
          return "";
      }
    },
    // rc.6 (ORGMODE E4): a meta da diretoria de uma org consolidada com o total da temporada.
    seasonTotal: (kind: string, count: number, place: number, total: number): string => {
      switch (kind) {
        case "regionalReach":
          return count === 1 ? "Jogue um regional de domingo" : `Jogue ${count} dos ${total} regionais de domingo`;
        case "regionalFinish":
          if (place <= 1) return count === 1 ? "Vença um regional" : `Vença ${count} dos ${total} regionais`;
          return count === 1 ? `Um top ${place} em regional` : `Top ${place} em ${count} dos ${total} regionais`;
        case "majorQualify":
          return count === 1 ? "Classifique-se para um Major" : count >= total ? `Classifique-se para os ${total} Majors` : `Classifique-se para ${count} dos ${total} Majors`;
        case "majorFinish":
          if (place <= 1) return count === 1 ? "Vença um Major" : `Vença ${count} dos ${total} Majors`;
          return count === 1 ? `Um top ${place} em Major` : `Top ${place} em ${count} dos ${total} Majors`;
        case "worldsQualify":
          return "Classifique-se para o Worlds";
        case "worldsFinish":
          return place <= 1 ? "Vença o Worlds" : `Um top ${place} no Worlds`;
        case "cupFinal":
          return count === 1 ? "Chegue a uma final de Community Cup" : `Chegue a ${count} finais de Community Cup`;
        case "cupWin":
          return count === 1 ? "Vença uma Community Cup" : `Vença ${count} Community Cups`;
        default:
          return "";
      }
    },
    role: { target: "Meta", stretch: "Meta ousada" } as Record<string, string>,
    deadline: {
      lastCup: (w: number) => `Última chance: a última Community Cup · sem. ${w}`,
      lastRegional: (w: number) => `Última chance: o último regional do Split 3 · sem. ${w}`,
      majorField: (w: number) => `Decidida quando o campo do Major do Split 3 sai · sem. ${w}`,
      majorFinal: (w: number) => `Última chance: o Major do Split 3 · sem. ${w}`,
      worldsField: (w: number) => `Decidida quando o campo do Worlds sai · sem. ${w}`,
      worldsFinal: (w: number) => `Última chance: o Worlds · sem. ${w}`,
    } as Record<string, (w: number) => string>,
    status: { done: "Feita", open: "Em jogo", out: "Fora de alcance", met: "Cumprida", missed: "Não cumprida" } as Record<string, string>,
    left: (n: number, kind: string): string => {
      if (kind === "cupFinal" || kind === "cupWin") return n === 1 ? "Falta 1 copa" : `Faltam ${n} copas`;
      if (kind === "majorQualify" || kind === "majorFinish") return n === 1 ? "Falta 1 Major" : `Faltam ${n} Majors`;
      if (kind === "worldsQualify" || kind === "worldsFinish") return "O Worlds segue aberto";
      return n === 1 ? "Falta 1 regional" : `Faltam ${n} regionais`;
    },
    splitLeft: (n: number) => (n === 1 ? "Falta 1 split" : `Faltam ${n} splits`),
    missCost: (n: number) => `Se falhar: −${n} de reputação`,
    noCost: "Sem reputação em jogo",
    fixedNote: "Definida pela diretoria no início da temporada.",
    why: {
      rank: (rank: number, teams: number) => `#${rank} de ${teams} na sua região`,
      stage: { founding: "Temporada de fundação", rising: "Org em ascensão", established: "Org estabelecida" } as Record<string, string>,
      money: { tight: "Caixa apertado: meta aliviada", flush: "Caixa saudável: meta elevada" } as Record<string, string>,
      last: { met: "Última meta cumprida: elevada", missed: "Última meta perdida: aliviada" } as Record<string, string>,
    },
  },

  explainers: {
    skipAll: "Pular todas as dicas",
    gotIt: "Entendi",
    hub: {
      title: "Este é o QG",
      body: "Avance um dia por vez ou pule até a próxima parada. Cartões marcados Precisa de você pedem uma decisão; o resto é opcional.",
    },
    calendar: {
      title: "A temporada num relance",
      body: "Três splits. Cada um tem três regionais (qualificatória no sábado, regional no domingo) e fecha com um Major. Os Pontos da Temporada levam ao Major e ao Worlds.",
    },
    squad: {
      title: "Seu elenco",
      body: "Três titulares e um sub. Mantenha um núcleo junto e a química paga; troque demais e a tabela lembra.",
    },
    training: {
      title: "Treinos",
      body: "Os jogadores evoluem rumo ao potencial toda semana. O coach pode cuidar disso por você: assuma quando quiser.",
    },
    market: {
      title: "O mercado",
      body: "Contrate agentes livres ou compre contratos, só com a janela aberta. Todo preço mostra sua conta.",
    },
    window: {
      title: "Janela de transferências",
      body: "As janelas abrem entre os splits e antes do Worlds. As negociações andam conforme os dias passam.",
    },
    finances: {
      title: "As contas",
      // rc.34 (ECO-13/15): o empréstimo emergencial do banco e o prazo dele.
      body: "Toda segunda entram prêmios e patrocínio e saem salários e manutenção. Abaixo do piso, o banco faz um empréstimo emergencial: quite no prazo ou a carreira acaba.",
    },
    standings: {
      title: "A linha de corte",
      body: "A linha tracejada é o corte de classificação. Tudo pelo que a org luta se mede contra ela.",
    },
    sponsor: {
      title: "Patrocinadores",
      body: "Dinheiro garantido por split e bônus por meta batida. Perder metas seguidas derruba o tier da próxima proposta.",
    },
    randomEvent: {
      title: "Próximo da fila",
      body: "Às vezes um titular não pode jogar. O reserva entra no lugar; sem reserva, o time não joga o evento. Reserva só assina na janela de transferências.",
    },
    worldsRace: {
      title: "A corrida pelo Worlds",
      body: "Os Pontos da Temporada de cada regional e Major acumulam o ano todo. Termine acima da linha da sua região e o maior palco se abre.",
    },
    rollover: {
      title: "Virada de temporada",
      body: "As idades avançam, os contratos contam, o mundo se reorganiza rumo à própria história: a menos que você já a tenha mudado.",
    },
  },

  // v0.3 ficha de org — elenco de qualquer org, aberta de tabelas/eventos/mercado.
  orgSheet: {
    roster: "Elenco",
    coach: "Coach",
    noCoach: "Sem coach",
    points: "Pontos da Temporada",
    viewTeam: "Ver time",
    prestige: (n: number) => `Prestígio ${n}`,
    // rc.2 times locais
    localSide: "Time local",
    // rc.29: desde a R30 a cena local também completa as qualificatórias de sábado.
    // rc.31 (R49): seus pontos de regional contam na corrida do Major e do Worlds.
    localHint:
      "Um time amador da cena regional: joga as community cups e as qualificatórias de sábado, e seus pontos de regional contam na corrida do Major e do Worlds.",
  },

  // rc.34 (Miguel, 31/10: "comunicar melhor com um modal que diga o que está acontecendo"): o aviso
  // de dinheiro, um por evento que muda o jogo (careerFlow.moneyNoticeOf). O modal passa os params
  // do aviso com o dinheiro formatado e `dlDate` (a data do prazo) incluída.
  moneyNotice: {
    otherTerms: "Demais condições do empréstimo",
    received: "Crédito na conta",
    repayTotal: "Total a pagar",
    weeklyPayment: "Por semana",
    termWeeks: "Semanas",
    ok: "Entendi",
    toFinances: "Abrir Finanças",
    loanOpened: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O banco entrou em cena",
      lead: `Nesta segunda as contas fecharam abaixo do piso (${p.floor}), então o banco emprestou ${p.lent} e o saldo voltou a ${p.rescueTo}.`,
      rows: noticeRows(
        ["Dívida", `${p.owed}, com ${p.repayPct}% de juros incluídos`],
        p.dlDate !== undefined && ["Quitar até", `${p.dlDate}: ${p.dlWeeks} semanas`],
        ["Como se paga", `${p.garnishPct}% de cada premiação e ${p.salePct}% de cada venda abatem a dívida; o resto você paga em Finanças.`],
        positive(p.partnerWeekly) && [
          "Investidor",
          `O ${p.partnerName} entra junto com este primeiro empréstimo: ${p.partnerWeekly} por semana durante ${p.partnerWeeks} semanas (${p.partnerPct}% da folha), receita, nunca descontada.`,
        ],
        ["Abaixo do piso de novo", nextBreachPt(p)],
        loansLeftPt(p) !== "" && ["Depois deste empréstimo", loansLeftPt(p)],
        p.dlDate !== undefined && ["O que encerra a carreira", `Em ${p.dlDate} o banco cobra o que é devido. Se pagar deixar as contas abaixo do piso, a carreira acaba.`],
      ),
      foot: Number(p.lock)
        ? "Enquanto houver dívida: sem taxas de transferência, sem equipamento, nada que encurte o fôlego."
        : "Nada fica travado enquanto você deve: contratações, taxas e equipamentos seguem liberados.",
    }),
    loanTopUp: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O banco aumentou seu empréstimo",
      lead: `As contas fecharam abaixo do piso de novo antes de o empréstimo ser quitado, então o banco emprestou mais ${p.lent}. O saldo voltou a ${p.rescueTo}.`,
      rows: noticeRows(
        ["Dívida", `${p.owed} no total`],
        p.dlDate !== undefined && ["Quitar até", `${p.dlDate}: o prazo não muda`],
        ["Abaixo do piso de novo", nextBreachPt(p)],
        p.dlDate !== undefined && ["O que encerra a carreira", `Em ${p.dlDate} o banco cobra o que é devido. Se pagar deixar as contas abaixo do piso, a carreira acaba.`],
      ),
    }),
    deadlineWarning: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: Number(p.weeksLeft) === 1 ? "Uma semana para pagar o banco" : `${p.weeksLeft} semanas para pagar o banco`,
      lead: `O empréstimo emergencial vence em ${p.dlDate}. A dívida é de ${p.owed}; o saldo está em ${p.balance}.`,
      rows: noticeRows(
        // rc.34 review: as contas projetadas até o prazo (com o gasto semanal), não o saldo de hoje.
        ["Neste ritmo", onPacePt(p)],
        !Number(p.covered) && ["Como fechar a diferença", gapWaysPt(p)],
        ["O que encerra a carreira", `Em ${p.dlDate} o banco cobra o que é devido. Se pagar deixar as contas abaixo do piso, a carreira acaba.`],
      ),
    }),
    // rc.34 review: nas últimas semanas a projeção deixou de cobrir a dívida (uma taxa, uma compra, um prêmio perdido).
    deadlineSlipped: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O empréstimo deixou de estar coberto",
      lead: `${Number(p.weeksLeft) === 1 ? "A uma semana" : `A ${p.weeksLeft} semanas`} do prazo do empréstimo emergencial (${p.dlDate}), as contas deixaram de cobri-lo: neste ritmo o saldo estaria em ${p.projected} nessa segunda, ${p.gap} abaixo do que o banco precisa para os ${p.owed} devidos.`,
      rows: noticeRows(
        ["Como fechar a diferença", gapWaysPt(p)],
        ["O que encerra a carreira", `Em ${p.dlDate} o banco cobra o que é devido. Se pagar deixar as contas abaixo do piso, a carreira acaba.`],
      ),
    }),
    deadlineCollected: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "Empréstimo quitado",
      lead: `O prazo chegou e as contas aguentaram: o banco cobrou ${p.collected}. O saldo agora é de ${p.balance}.`,
      rows: noticeRows([
        "E agora",
        `O empréstimo emergencial está encerrado. ${p.next === undefined ? "Uma nova quebra do piso abriria outro, com um prazo novo." : nextBreachPt(p)}`,
      ]),
    }),
    careerEnded: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "A carreira termina aqui",
      lead:
        p.cause === "deadline"
          ? `O empréstimo emergencial venceu com ${p.owed} de dívida e ${p.balance} em caixa. Pagar deixaria as contas abaixo do piso, então o banco cobrou o empréstimo e a org fechou as portas.`
          : !positive(p.owed) && Number(p.maxLoans) >= 0 && Number(p.loans) >= Number(p.maxLoans)
            ? `As contas fecharam abaixo do piso de novo e o banco não abriria outro empréstimo emergencial depois ${Number(p.loans) === 1 ? "do que já emprestou" : `dos ${p.loans} que já emprestou`}. A org fechou as portas.`
            : `As contas fecharam abaixo do piso de novo e o banco não quis emprestar mais${Number(p.topUps) > 0 ? ` depois de ${p.topUps} acréscimos` : ""}. A org fechou as portas.`,
      rows: noticeRows(["O que fica", "A revisão da temporada, o arquivo e os troféus continuam abertos."]),
    }),
    loanTakenOver: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O banco assumiu a sua dívida",
      lead: `Os resgates mudaram: o Investidor de emergência saiu de cena, e os ${p.owed} que você devia a ele agora estão com o banco, como um empréstimo emergencial.`,
      rows: noticeRows(
        p.dlDate !== undefined && ["Quitar até", `${p.dlDate}: daqui a ${p.dlWeeks} semanas`],
        ["Como se paga", `${p.garnishPct}% de cada premiação e ${p.salePct}% de cada venda abatem a dívida; o resto você paga em Finanças.`],
        ["Abaixo do piso de novo", nextBreachPt(p)],
        p.dlDate !== undefined && ["O que encerra a carreira", `Em ${p.dlDate} o banco cobra o que é devido. Se pagar deixar as contas abaixo do piso, a carreira acaba.`],
      ),
      foot: Number(p.lock) ? undefined : "Nada fica mais travado enquanto você deve: contratações, taxas e equipamentos estão liberados.",
    }),
    // rc.37 F2 (pacote 2): o empréstimo comum do banco, oferecido antes do piso (careerFlow.offerCreditOnRunway).
    notNow: "Agora não",
    takeLoan: (amount: string) => `Pegar ${amount}`,
    creditOffer: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O banco oferece um empréstimo",
      lead:
        Number(p.weeks) > 0
          ? `Com ${p.burn} de queima por semana, o saldo cobre mais ou menos ${p.weeks} segundas-feiras. Antes de as contas chegarem ao piso (${p.floor}), o banco oferece o empréstimo comum.`
          : `As contas estão no vermelho (${p.balance}) e queimam ${p.burn} por semana. Antes de chegarem ao piso (${p.floor}), o banco oferece o empréstimo comum.`,
      rows: noticeRows(
        ["Você recebe", `${p.loanNet} agora, no saldo`],
        ["Você paga", `${p.loanTotal} no total, com ${p.loanPct}% de juros`],
        ["Prazo", `${p.loanTerm} semanas: ${p.loanWeekly} toda segunda`],
        [
          "O que ele cobre",
          Number(p.loanCapped)
            ? `É o máximo que o banco empresta na sua reputação: cerca de ${p.loanCovers} segundas acima de $0 neste ritmo.`
            : `Cerca de ${p.loanCovers} segundas acima de $0 neste ritmo, já contando as parcelas.`,
        ],
        ["Sem ele", `Neste ritmo as contas fecham abaixo do piso n${breachWhenPt(p)}. ${nextBreachPt(p)}`],
      ),
      foot: `O empréstimo emergencial custa ${p.emergencyPct}%${Number(p.emergencyTerm) > 0 ? ` e precisa ser quitado em até ${p.emergencyTerm} semanas` : ""}. Finanças empresta qualquer valor até o limite, em qualquer dia.`,
    }),
    // rc.37 F2 (pacote 4): um gasto único trouxe o piso para perto (careerFlow.spendAlertFlow).
    spendRisk: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: Number(p.mondays) === 1 ? "A próxima segunda quebra o piso" : "Este gasto deixa o piso perto",
      lead: positive(p.burn)
        ? `Esse gasto (${p.spent}) deixa ${p.balance} no saldo. Com ${p.burn} de queima por semana, as contas fecham abaixo do piso (${p.floor}) n${breachWhenPt(p)}.`
        : `Esse gasto (${p.spent}) deixa ${p.balance} no saldo, abaixo do piso (${p.floor}) mesmo depois da receita da semana: ${breachWhenPt(p)} quebra o piso.`,
      rows: noticeRows(
        ["Nessa segunda", nextBreachPt(p)],
        Number(p.offer) > 0 && [
          "A oferta do banco",
          `${p.loanNet} agora; ${p.loanTotal} pagos no total (${p.loanPct}% de juros), ${p.loanWeekly} toda segunda por ${p.loanTerm} semanas.`,
        ],
        ["Outras saídas", "Premiação antes dessa segunda, uma boa proposta por um jogador ou uma folha mais leve."],
      ),
      foot:
        Number(p.offer) > 0
          ? `O empréstimo emergencial custa ${p.emergencyPct}%${Number(p.emergencyTerm) > 0 ? ` e precisa ser quitado em até ${p.emergencyTerm} semanas` : ""}.`
          : undefined,
    }),
  },

  // v2.1 Matchday fatia 5: a série do usuário no modo personalizado (o plano, as pausas).
  seriesDesk: {
    planTitle: "Plano da série",
    planSub: "O seu técnico já preencheu. Mude o que quiser, ou só jogue.",
    planSubNoCoach: "Sem técnico: as escolhas do capitão estão preenchidas. Mude o que quiser, ou só jogue.",
    breakTitle: (n: number) => `Depois do jogo ${n}`,
    breakSub: "Um tempo técnico e uma troca por série. O plano fica, a não ser que você mude.",
    overTitle: "Série encerrada",
    scouting: "Scouting",
    theyPlay: (style: string) => `Eles jogam ${style}`,
    theirPlaymaker: (name: string) => `Armador: ${name}`,
    style: "Estilo",
    natural: (style: string) => `Natural: ${style}`,
    beats: (style: string) => `Vence ${style}`,
    fit: (n: number) => `${n}% de encaixe`,
    kickoff: "Kickoffs",
    kickoffs: { safe: "Seguro", standard: "Padrão", aggressive: "Agressivo" },
    kickoffHint: {
      safe: "Menos oscilação para os dois lados.",
      standard: "Como sempre.",
      aggressive: "Mais oscilação para os dois lados.",
    },
    mark: "Marcação",
    markNobody: "Ninguém",
    markHint: "Marcar o armador deles corta as jogadas especiais. Marcar outro custa um pouco de defesa.",
    playmaker: "Armador",
    starters: "Seus titulares",
    coachPick: "Técnico",
    captainPick: "Capitão",
    playGame: (n: number) => `Jogar o jogo ${n}`,
    leaveToCoach: "Deixar com o técnico",
    leaveToCaptain: "Deixar com o capitão",
    continue: "Continuar",
    gameWon: (n: number, a: number, b: number) => `Jogo ${n} vencido, ${a}-${b}`,
    gameLost: (n: number, a: number, b: number) => `Jogo ${n} perdido, ${a}-${b}`,
    overtimeShort: "PR",
    momentum: "Embalo",
    momentumHint: "Quem perde um jogo apertado se reagrupa; uma goleada ou uma virada embala o vencedor.",
    timeoutLabel: "Tempo técnico",
    timeout: "Pedir tempo",
    timeoutHint: "Tira o embalo do outro lado.",
    timeoutUsed: "Tempo usado",
    adjust: "Ajustar",
    sub: "Troca",
    subOut: "Sai",
    subIn: "Entra",
    subConfirm: "Fazer a troca",
    subDone: (inName: string, outName: string) => `${inName} entra no lugar de ${outName}`,
    subNone: "Ninguém no banco.",
    seriesWon: "Série vencida",
    seriesLost: "Série perdida",
    you: "Você",
    styles: {
      pressure: "Pressão",
      possession: "Posse",
      counter: "Contra-ataque",
      individual: "Individual",
      teamplay: "Jogo coletivo",
    },
    traits: {
      decisive: "Decisivo",
      streaky: "Oscilante",
      consistent: "Constante",
      slowStarter: "Começa devagar",
      lan: "Jogador de LAN",
      leader: "Líder",
      hotHeaded: "Cabeça quente",
      iceCold: "Sangue frio",
    },
  },

  // v2.1 Matchday fatia 5: a súmula no Match Center e as estatísticas da temporada no elenco.
  boxScore: {
    title: "Súmula",
    series: "Série",
    game: (n: number) => `J${n}`,
    gameLabel: (n: number) => `Jogo ${n}`,
    player: "Jogador",
    goals: "G",
    assists: "A",
    saves: "D",
    shots: "Ch",
    score: "Pts",
    rating: "Nota",
    games: "J",
    mvp: "MVP",
    moments: "Momentos-chave",
    legend: "G gols · A assistências · D defesas · Ch chutes · Pts pontuação · Nota (0-10)",
    seasonTitle: "Estatísticas da temporada",
    seasonSub: "As suas séries nesta temporada, pelas súmulas.",
    seasonEmpty: "Nenhuma série jogada nesta temporada ainda.",
  },

  // v2.1 Matchday fatia 4: os momentos-chave de um jogo (engine/career/boxScore.ts).
  moments: {
    overtimeWinner: [
      (p: string, c: string) => `${p} decide na prorrogação, aos ${c}.`,
      (p: string, c: string) => `Gol de ouro: ${p}, com ${c} de prorrogação.`,
      (p: string, c: string) => `${p} resolve o jogo no tempo extra, ${c}.`,
    ],
    comeback: [
      (p: string, _c: string, n: number) => `Perdendo por ${n}, o time vira: ${p} coloca na frente.`,
      (p: string, _c: string, n: number) => `De ${n} atrás para a frente do placar, gol de ${p}.`,
      (p: string, _c: string, n: number) => `${p} completa a virada depois de estar ${n} abaixo.`,
    ],
    hatTrick: [
      (p: string, _c: string, n: number) => `${p} chega a ${n} gols: hat-trick.`,
      (p: string, _c: string, n: number) => `Hat-trick de ${p}, ${n} no jogo.`,
      (p: string, _c: string, n: number) => `${p} marca ${n}. Hat-trick nesta partida.`,
    ],
    cleanSheet: [
      (p: string, _c: string, n: number) => `Jogo sem sofrer gol na decisão, ${p} com ${n} defesas.`,
      (p: string, _c: string, n: number) => `Nada passa por ${p} (${n} defesas). Shutout.`,
      (p: string, _c: string, n: number) => `Shutout no jogo decisivo, ${p} faz ${n} defesas.`,
    ],
    lateGoal: [
      (p: string, c: string) => `${p} marca com ${c} no relógio.`,
      (p: string, c: string) => `Gol no fim de ${p}, ${c} para acabar.`,
      (p: string, c: string) => `${p} acha a rede aos ${c}.`,
    ],
    saveMarathon: [
      (p: string, _c: string, n: number) => `${p} faz ${n} defesas.`,
      (p: string, _c: string, n: number) => `${n} defesas de ${p}, a muralha do jogo.`,
      (p: string, _c: string, n: number) => `${p} para ${n} chutes.`,
    ],
    demoBlitz: [
      (p: string, _c: string, n: number) => `${p} derruba ${n} adversários.`,
      (p: string, _c: string, n: number) => `${n} demolições de ${p}.`,
      (p: string, _c: string, n: number) => `${p} não dá trégua: ${n} demolições.`,
    ],
    decider: [
      (p: string, c: string) => `${p} faz o gol que decide, ${c}.`,
      (p: string, c: string) => `O gol decisivo: ${p}, ${c}.`,
      (p: string, c: string) => `${p} fecha o jogo aos ${c}.`,
    ],
    unknownPlayer: "Um jogador",
  },

  common: {
    ovr: "OVR",
    pot: "POT",
    ovrShort: (n: number) => `${n} OVR`,
    starsShort: (n: number) => `${n}★`,
    rep: "Rep",
    reputation: "Reputação",
    seasonPoints: "Pontos da Temporada",
    prize: "Premiação",
    confirm: "Confirmar",
    cancel: "Cancelar",
    back: "Voltar",
    next: "Avançar",
    close: "Fechar",
    locked: "Bloqueado",
    free: "Grátis",
    perWeek: "/ semana",
    you: "Você",
    placement: {
      champion: "Campeões",
      runner_up: "Vice-campeões",
      third: "3º lugar",
      fourth: "4º lugar",
      top4: "Top 4",
      top6: "Top 6",
      top8: "Top 8",
      swiss_exit: "Eliminado no Swiss",
    },
    /** v2.0 (R40): linha de qualificatória nunca tem colocação de chave (top8 = classificado). */
    qualifierOutcome: { qualified: "Classificado", eliminated: "Eliminado" },
    tier: {
      t3: "Community Cup",
      t2: "Invitational",
      qualifier: "Qualificatória",
      regional: "Regional",
      major: "Major",
      worlds: "Worlds",
    },
    // v2.0 (P1): an action that failed inside the game (the save is untouched).
    actionFailed: "Essa ação não foi concluída, e nada mudou no seu save. Tente de novo; se continuar acontecendo, avise a gente no Discord.",
  },
  launch: {
    seasonDetailUnavailable: "Os resultados detalhados desta temporada não foram preservados neste save.",
    competition: "Competição",
    futureGoal: "Meta definida no início deste split",
    careerStats: "Totais da carreira",
    lineup: "Alterar escalação", swapWith: (name: string) => `Trocar com ${name}`,
    unlocked: "Novas possibilidades", open: "Explorar", breaking: "Notícia bombástica",
    coachTypes: { generated: "Coach comum", dataset: "Coach profissional", real: "Ex-jogador profissional" },
    coachDetails: "Efeitos e evolução", coachGrowth: (quality: number, ceiling: number) => `Qualidade ${quality} → potencial ${ceiling}`,
    coachRetainer: "Contrato com prazo · renove antes do fim ou o coach sai",
    offersTitle: "Propostas recebidas", coachDealEnds: (season: string) => `Contrato até ${season}`, coachDealLast: "Última temporada do contrato", coachDealOpen: "Contrato datado no próximo balanço de temporada",
    coachRenewAsk: "Pede para renovar", coachRenewFor: (n: number) => `Renovar ${n} ${n === 1 ? "temporada" : "temporadas"}`,
    coachEvolution: "Qualidade e experiência evoluem no balanço de cada temporada, até o potencial do coach.",
    coachShortlist: "Coaches disponíveis", coachCompare: "Compare tipo, qualidade, especialidade e salário semanal. Abra os detalhes para ver os efeitos no treino.",
    sponsorSchedule: "Metas durante este contrato", automaticCamp: "Bootcamp pago pelo patrocinador · ativa sozinho.",
    seasonTitles: "Títulos nesta temporada", totalTitles: "Títulos na carreira", events: "Eventos disputados", wins: "Séries vencidas", losses: "Séries perdidas", games: "Jogos V–D", goals: "Gols marcados / sofridos", winRate: "Vitórias em séries", podiums: "Pódios",
    calendarPlan: "Planeje sua temporada", calendarHint: "Escolha um mês e selecione um dia para ver a agenda e as ações.", calendarOverview: "Progresso na temporada", calendarLegend: "Legenda do calendário",
    sundayQualified: "Vaga no Championship Sunday garantida", majorChampion: "Campeões de Major", worldsChampion: "Campeões mundiais",
    rocketStreet: "Rocket Street",
  },

  // T1 (v2.0): o tutorial guiado. Um capítulo é mostrado na primeira visita e
  // reaberto pelo botão de ajuda. Cada passo destaca um elemento real
  // (`data-tour`); o texto diz o que o jogador faz ali, em uma ou duas linhas.
  // rc.54: capítulos só para QG, Elenco, Treinos e Finanças (Calendário,
  // Mercado, Classificação, Caixa de entrada e Clube não têm tutorial).
  tour: {
    kicker: "Road to Worlds",
    next: "Avançar",
    back: "Voltar",
    skip: "Pular",
    done: "Entendi",
    progress: (n: number, total: number) => `${n} de ${total}`,
    help: "Guia desta tela",
    beta: {
      title: "O Road to Worlds está em beta",
      body: "O modo carreira já dá para jogar do primeiro qualificatório ao Mundial, mas balanceamento, ritmo e preços ainda estão sendo ajustados.",
      feedback: "Conte o que pareceu estranho, o que falta e o que você curtiu. O feedback no Discord define o que corrigimos primeiro.",
      discord: "Entrar no Discord",
      close: "Começar minha carreira",
    },
    hub: {
      welcome: {
        title: "Bem-vindo ao Road to Worlds",
        body: "Você comanda uma org do primeiro elenco até o Mundial. Um minuto para o essencial.",
        points: [
          { label: "Elenco", text: "Contrate, treine e renove" },
          { label: "Caixa", text: "Os salários saem toda segunda" },
          { label: "Pontos da Temporada", text: "Levam aos Majors e ao Worlds" },
        ],
      },
      tabs: {
        title: "Cada aba, uma área do clube",
        body: "Tudo fica a um toque nesta barra.",
        items: {
          hub: "O dia e as decisões",
          calendar: "Eventos e copas",
          squad: "Titulares e contratos",
          training: "A evolução do time",
          market: "Jogadores e coaches",
          finances: "Caixa e patrocínio",
          standings: "A corrida ao Worlds",
          news: "Propostas e avisos",
          club: "Títulos e progressão",
        } as Record<string, string>,
      },
      advance: {
        title: "O relógio é seu",
        body: "O tempo só passa quando você manda, e o jogo para sozinho quando algo precisa de você.",
        points: [
          { label: "Avançar", text: "Dia a dia, até a próxima parada" },
          { label: "Pular adiante", text: "Direto para a próxima parada" },
        ],
      },
      day: {
        title: "O cartão do dia",
        body: "O que pede decisão hoje aparece aqui: uma proposta, um patrocínio, um evento. Resolva e siga em frente.",
      },
      inbox: {
        title: "Caixa de entrada",
        body: "Propostas, avisos do banco e convites chegam por e-mail. Abra os que pedem resposta.",
      },
      finances: {
        title: "De olho no caixa",
        body: "Prêmios e patrocínio entram, salários saem toda segunda. Se o saldo afundar demais, o banco entra em cena, com prazo.",
      },
      progress: {
        title: "Progressão",
        body: "Resultados aumentam a reputação. A reputação libera o coach, patrocinadores melhores e nova estrutura.",
      },
      help: {
        title: "Ajuda sempre à mão",
        body: "Elenco, Treinos e Finanças abrem um guia curto na primeira visita. Nessas telas e aqui, este botão traz o guia de volta.",
      },
    },
    training: {
      cycle: {
        title: "Escolha o ciclo",
        body: "A cada 14 dias você decide no que o elenco trabalha.",
        points: [
          { label: "Evoluir", text: "Os atributos sobem mais rápido" },
          { label: "Entrosar", text: "A química cresce mais rápido" },
          { label: "Recuperar", text: "Menos desgaste, veteranos seguram o nível" },
        ],
      },
      coach: {
        title: "O coach",
        body: "Com um coach, o plano vem pronto e o treino rende mais. Sem ele, você define cada ciclo.",
      },
      growth: {
        title: "Acompanhe a evolução",
        body: "Veja quem ainda evolui, quem está no auge e quem já passou dele, antes de renovar ou vender.",
      },
    },
    finances: {
      overview: {
        title: "Três leituras do caixa",
        body: "O saldo ao longo do tempo, o que entra e sai toda segunda e para onde a temporada caminha.",
      },
      sponsor: {
        title: "Patrocínio",
        body: "O contrato paga uma base garantida e um bônus por meta batida. Os mais seguros pagam menos; os ousados multam a meta perdida.",
      },
      loans: {
        title: "Empréstimos e o piso",
        body: "Pegue crédito quando quiser. Se uma segunda fechar abaixo do piso, o banco empresta sozinho, e perder esse prazo encerra a carreira.",
      },
      progress: {
        title: "Invista na org",
        body: "Equipamentos, staff e bootcamps fazem o elenco evoluir e jogar melhor. Cada degrau é liberado pela reputação.",
      },
    },
    squad: {
      starters: {
        title: "Seus três titulares",
        body: "Eles jogam todas as séries. Abra um jogador para ver atributos, contrato e opções.",
      },
      bench: {
        title: "Reserva e coach",
        body: "O reserva entra quando um titular não pode jogar. Sem reserva, o time perde aquele evento.",
      },
      contracts: {
        title: "Contratos",
        body: "Renove antes do fim da temporada, ou o jogador sai de graça.",
      },
    },
  },

  /** v2.2 Pro, fatia 2: a semana, o ranqueado e o registro de crescimento (docs/PRO-SPEC.md §5, §7.1). */
  proWeek: {
    title: "Esta semana",
    openWeek: "Planejar a semana",
    kicker: "Três blocos: segunda e terça, quarta e quinta, sexta. O fim de semana é dos eventos.",
    blockNames: ["Seg-Ter", "Qua-Qui", "Sex"] as string[],
    activity: {
      train: "Treino",
      ranked: "Ranqueado",
      scrim: "Scrim",
      content: "Conteúdo",
      rest: "Descanso",
    } as Record<string, string>,
    activityHint: {
      train: "Pontos em um atributo. Custa 20 de energia.",
      ranked: "Sobe ou desce o seu MMR e dá um pouco de XP. Custa 15 de energia.",
      scrim: "Experiência e química com o time. Custa 15 de energia.",
      content: "Dinheiro e fãs. Custa 10 de energia.",
      rest: "Devolve 35 de energia.",
    } as Record<string, string>,
    focus: "Foco",
    focusBalanced: "Equilibrado",
    needsTeam: "Você precisa de um time para fazer scrim.",
    burnedOutBlock: "Fora esta semana: todos os blocos contam como descanso.",
    energy: "Energia",
    energyTrace: (values: number[]) => `${values.slice(0, -1).join(" → ")}, depois ${values[values.length - 1]} no fim de semana`,
    energyTraceLabel: "Energia depois de cada bloco e depois da semana",
    projected: {
      gain: (stat: string, n: number) => `${stat} +${n.toFixed(2)}`,
      none: "Nenhum atributo muda",
      allStats: (n: number) => `Todos os atributos +${n.toFixed(2)}`,
      mmr: (n: number) => `Esperado ${n >= 0 ? "+" : ""}${n} MMR`,
      money: (n: number) => `+${n} de dinheiro`,
      fame: (n: number) => `+${n} fãs`,
      chemistry: (n: number) => `+${n} de química`,
      energy: (n: number) => `${n} de energia restante`,
    },
    warn: {
      tired: (n: number) => `Este plano termina a semana com ${n} de energia. Uma semana que termina abaixo de 30, depois de um aviso, pode acabar em burnout.`,
      warning: (n: number) => `Este plano termina a semana com ${n} de energia, abaixo da linha em que o aviso de burnout aparece. O burnout só vem uma semana depois do aviso.`,
      ok: (n: number) => `Este plano termina a semana com ${n} de energia.`,
      burnedOut: "Você está em burnout. Esta semana é de descanso, e você volta com energia.",
    },
    shortcuts: {
      coach: "Plano do técnico",
      repeat: "Repetir a semana",
      coachHint: "Descansa quando você está cansado, treina os atributos mais fracos e põe ranqueado (ou scrim, com time) no meio.",
    },
    play: "Jogar a semana",
    result: {
      title: "Semana passada",
      energy: "Energia ao longo da semana",
      noGrowth: "Nenhum atributo mudou.",
    },
    notes: {
      tiredTraining: (n?: number) => `Você treinou com ${n ?? 0} de energia, então o bloco rendeu menos.`,
      lowEnergy: (n?: number) => `Você jogou com ${n ?? 0} de energia, o que piora a sua forma.`,
      burnoutWarning: (n?: number) => `Aviso: a semana terminou com ${n ?? 0} de energia. Mais uma semana assim pode acabar em burnout. Descanse para tirar o aviso.`,
      burnedOut: (n?: number) => `Burnout. Você fica fora por ${n ?? 1} ${n === 1 ? "semana" : "semanas"}.`,
      stillBurnedOut: () => "Ainda fora: os blocos contaram como descanso.",
      backFromBurnout: (n?: number) => `De volta do burnout com ${n ?? 0} de energia.`,
      scrimNeedsTeam: () => "O scrim não aconteceu: você ainda não tem time.",
      rankedResult: (n?: number) => `Ranqueado: ${(n ?? 0) >= 0 ? "+" : ""}${n ?? 0} MMR.`,
      rankUp: (_n?: number, ref?: string) => `Subiu para ${ref ?? ""}.`,
      rankDown: (_n?: number, ref?: string) => `Caiu para ${ref ?? ""}.`,
      mechanicUnlocked: (_n?: number, ref?: string) => `Nova mecânica: ${ref ?? ""}.`,
      contentPaid: (n?: number) => `O conteúdo rendeu ${n ?? 0}.`,
    } as Record<string, (n?: number, ref?: string) => string>,
    ranked: {
      title: "Ranqueado",
      mmr: "MMR",
      division: (label: string, d: number) => (d > 0 ? `${label} ${"I".repeat(d)}` : label),
      toNext: (n: number, label: string) => `${n} MMR para ${label}`,
      top: "Topo da escada",
      sessions: "Últimas sessões",
      noSessions: "Nenhuma sessão de ranqueado ainda.",
      session: (wins: number, games: number, delta: number) => `${wins} de ${games} vencidas, ${delta >= 0 ? "+" : ""}${delta} MMR`,
      cupsLocked: (rank: string) => `Chegue a ${rank} e as copas da comunidade mandam um convite.`,
      cupsOpen: "Os convites para as copas da comunidade estão abertos.",
      grandChampion: "Grand Champion",
    },
    log: {
      title: "Por que o seu overall mudou",
      empty: "Nada mudou ainda. Treine, jogue ranqueado ou uma partida e o motivo aparece aqui.",
      source: {
        training: "Treino",
        ranked: "Ranqueado",
        scrim: "Scrim",
        match: "Partida",
        age: "Idade",
      } as Record<string, string>,
      line: (stat: string, delta: number) => `${stat} ${delta > 0 ? "+" : ""}${delta.toFixed(2)}`,
      day: (season: number, week: number) => `Temporada ${season + 1}, semana ${week}`,
      /** Por que um atributo caiu com a idade (a chave de motivo numa entrada "age"). */
      reasons: {
        reflexes: "Os seus reflexos começam a cair.",
        pace: "Você chega um passo atrás na bola.",
        reactions: "O seu tempo de reação na defesa está caindo.",
        stamina: "Séries longas custam mais do que custavam.",
        nerve: "Os grandes momentos pesam um pouco mais em você.",
        reads: "A sua leitura de jogo cai, devagar.",
      } as Record<string, string>,
    },
    form: {
      confidence: "Confiança",
      words: ["Abalado", "Baixa", "Estável", "Afiado", "Em boa fase"] as string[],
      bonus: (n: string) => `${n} nas suas notas de partida`,
      confidenceHint: "Vem das suas cinco últimas notas em partidas. Ajuda nos jogos de ranqueado e nos seus lances numa partida.",
    },
  },

  /** v2.2 Pro, fatia 5: o lance de um jogo e as mecânicas assinatura (docs/PRO-SPEC.md §4.2, §6). */
  proMoments: {
    title: "A sua decisão",
    kicker: "Uma decisão por jogo. A palavra ao lado de cada opção diz quão provável é dar certo para você agora; a linha embaixo do nome é o atributo que ela testa. Opção travada é uma mecânica que você ainda não desbloqueou.",
    moment: {
      decider: "A decisão",
      overtimeWinner: "Overtime",
      lateGoal: "No fim do jogo",
      comeback: "Correndo atrás",
      cleanSheet: "Segurando a vantagem",
      saveMarathon: "Sob pressão",
      hatTrick: "Numa boa sequência",
      demoBlitz: "Ganhando no físico",
    } as Record<string, string>,
    calls: {
      holdForSupport: "Segurar e esperar o apoio",
      takeTheShot: "Chutar de primeira",
      stayBack: "Ficar atrás e segurar a linha",
      challengeEarly: "Ir na bola cedo",
      resetPlay: "Reiniciar a jogada",
      keepPushing: "Continuar pressionando",
      wavedash: "Wavedash",
      speedflip: "Speedflip",
      airDribble: "Air dribble",
      ceilingShot: "Ceiling shot",
      doubleTap: "Double tap",
      mustyFlick: "Musty flick",
      flipReset: "Flip reset",
    } as Record<string, string>,
    hints: { risky: "Arriscado", uncertain: "Incerto", likely: "Provável", mastered: "Você domina isso" } as Record<string, string>,
    locked: (_name: string) => `Ainda não desbloqueada`,
    instinct: "No instinto",
    instinctHint: "O seu estilo faz a escolha. Não ajuda e não atrapalha.",
    result: {
      success: (call: string) => `${call} deu certo.`,
      miss: (call: string) => `${call} não funcionou.`,
      instinct: (call: string) => `No instinto você foi de: ${call}.`,
      team: (n: number) => `Nota do time neste jogo ${n >= 0 ? "+" : ""}${n.toFixed(2)}`,
      own: (n: number) => `A sua nota ${n >= 0 ? "+" : ""}${n.toFixed(2)}`,
    },
    mechanics: {
      title: "Mecânicas assinatura",
      owned: "Desbloqueadas",
      next: (name: string, blocks: number, mech: number) =>
        blocks > 0 && mech > 0
          ? `Próxima: ${name}. Faltam ${blocks} blocos de treino em Mecânica e ${mech} pontos de Mecânica.`
          : blocks > 0
            ? `Próxima: ${name}. Faltam ${blocks} blocos de treino em Mecânica.`
            : mech > 0
              ? `Próxima: ${name}. Faltam ${mech} pontos de Mecânica.`
              : `Próxima: ${name}. Falta um bloco de treino em Mecânica.`,
      all: "Todas as mecânicas assinatura estão desbloqueadas.",
    },
  },

  /** v2.2 Pro, fatia 6: a página do cartão final (docs/PRO-SPEC.md §9). */
  proCard: {
    kicker: "Cartão da carreira Pro",
    gala: {
      kinds: { mvp: "MVP", breakout: "Revelação", teamOfSeason: "Seleção da temporada", mostDecisive: "Jogador mais decisivo" } as Record<string, string>,
      scopes: { region: "Regional", world: "Mundial" } as Record<string, string>,
      line: (scope: string, kind: string, year: number) => `${kind} ${scope} ${year}`,
      winner: (award: string) => `Você venceu: ${award}.`,
      nominee: (award: string) => `Você foi indicado: ${award}.`,
    },
    nicknames: {
      theWall: "A Muralha",
      mrLan: "Sr. LAN",
      theCloser: "O Fechador",
      iceCold: "Sangue Frio",
      theChamp: "O Campeão",
      oneClub: "Jogador de um clube só",
      theMaestro: "O Maestro",
      theFinisher: "O Finalizador",
      theBulldozer: "O Trator",
      comebackKid: "O Rei da Virada",
      mrSteady: "Sr. Constante",
      theProdigy: "O Prodígio",
    } as Record<string, string>,
    nicknameWhy: {
      theWall: (n: number) => `${n} defesas na carreira.`,
      mrLan: (n: number) => `${n} títulos de LAN.`,
      theCloser: (n: number) => `${n} séries vencidas no jogo decisivo.`,
      iceCold: (n: number) => `${n} jogos com nota alta em lances de clutch.`,
      theChamp: () => "Um título de Worlds.",
      oneClub: (n: number) => `${n} temporadas na mesma org.`,
      theMaestro: (n: number) => `${n} assistências na carreira.`,
      theFinisher: (n: number) => `${n} gols na carreira.`,
      theBulldozer: (n: number) => `${n} demolições na carreira.`,
      comebackKid: (n: number) => `${n} séries vencidas depois de estar atrás.`,
      mrSteady: (n: number) => `${n} temporadas com nota média alta.`,
      theProdigy: () => "Contratado por uma org aos 15 anos ou menos.",
    } as Record<string, (n: number) => string>,
    peak: "Overall de pico",
    seasons: (n: number) => `${n} ${n === 1 ? "temporada" : "temporadas"}`,
    orgs: "Orgs",
    titles: "Títulos",
    awards: "Prêmios",
    bestRating: "Melhor nota de temporada",
    none: "Nenhum ainda",
    nickname: "Conhecido como",
    legends: {
      title: "Entre os jogadores reais",
      between: (peak: string, above: string, below: string) => `Um overall de pico de ${peak} fica entre ${above} e ${below} no ranking histórico das melhores cartas.`,
      below: (peak: string, name: string) => `Um overall de pico de ${peak} fica logo abaixo de ${name} no ranking histórico das melhores cartas.`,
      above: (peak: string, name: string) => `Um overall de pico de ${peak} fica acima da melhor carta de qualquer jogador real, logo acima de ${name}.`,
      place: (n: number, of: number) => `Posição ${n} de ${of}`,
      loading: "Lendo o ranking...",
    },
    download: "Baixar imagem",
    share: "Compartilhar",
    copyLink: "Copiar link",
    copied: "Link copiado",
    shareText: (name: string) => `A carreira Pro de ${name} no Rocket Draft`,
    invalidTitle: "Este cartão não pode ser lido",
    invalidBody: "O link está incompleto ou foi editado. Peça o link de novo, ou comece a sua carreira.",
    start: "Começar uma carreira Pro",
    own: "Compartilhar o meu cartão",
  },

  /** v2.2 Pro, a carreira de jogador (docs/PRO-SPEC.md, R150). Só no staging (FEATURES.proCareer). */
  pro: {
    door: {
      title: "Pro: carreira de jogador",
      body: "Seja o jogador. Comece aos 13 ou 14 no ranqueado e suba pela cena amadora até o Worlds.",
      cta: "Começar uma carreira Pro",
      managerCareers: "Carreiras de manager",
    },
    saves: {
      title: "Carreiras Pro",
      kicker: "As carreiras de jogador ficam ao lado das de manager: três vagas cada.",
      empty: "Criar um jogador",
      resume: "Continuar",
      delete: "Apagar",
      deleteConfirm: (name: string) => `Apagar a carreira de ${name}? É definitivo e só neste aparelho.`,
      slotsFull: "As três vagas Pro estão ocupadas.",
      newCareer: "Nova carreira Pro",
      season: (n: number) => `Temporada ${n}`,
    },
    wizard: {
      title: "Crie o seu jogador",
      kicker: "Sem teto fixo: até onde você chega depende de como treina, descansa e joga.",
      name: "Apelido",
      namePlaceholder: "O seu nome na cena",
      nameLength: (min: number, max: number) => `${min} a ${max} caracteres.`,
      country: "País",
      region: "Região",
      regionHint: "Onde você joga o ranqueado e as primeiras copas.",
      age: "Idade inicial",
      ageHint: "O RLCS aceita jogadores a partir dos 13. Começar aos 13 dá um ano a mais antes de as orgs olharem.",
      ageOption: (n: number) => `${n} anos`,
      style: "Estilo",
      styleHint: "Os seus dois atributos mais fortes no começo. O treino decide o resto.",
      difficulty: "Dificuldade",
      difficultyHint: "Mais difícil quer dizer propostas mais duras e titularidade mais disputada, nunca um jogador mais fraco.",
      create: "Criar jogador",
    },
    player: {
      age: (n: number) => `${n} anos`,
      overall: "Overall",
      attributes: "Atributos",
      noCeiling: "Não há teto para descobrir. O treino, o descanso, o time em que você joga e como você joga decidem até onde você chega.",
      stage: {
        ranked: "Ranqueado",
        amateur: "Time amador",
        org: "Contratado",
        freeAgent: "Sem time",
        retired: "Aposentado",
      } as Record<string, string>,
      energy: "Energia",
      fans: "Fãs",
      money: "Dinheiro",
      mmr: "MMR",
      unranked: "Sem rank",
      nextTitle: "O que vem a seguir",
      nextBody: "A tela da carreira cuida do calendário, das partidas e das propostas. A tela da semana define o seu treino e mostra por que os atributos mudaram.",
      openCareer: "Abrir a carreira",
      allCareers: "Todas as carreiras Pro",
    },
  },
  // v2.2 board front: assumir uma organização real, a diretoria, seus objetivos, confiança e propostas de emprego.
  board: {
    title: "Diretoria",
    kicker: "O que a diretoria espera desta temporada e como ela avalia o seu trabalho.",
    // rc.6 (ORGMODE UI-B): um clube fundado responde aos donos pelas mesmas peças.
    ownersTitle: "Donos",
    ownersConfidence: "Confiança dos donos",
    ownersKicker: "O que os donos do seu clube esperam desta temporada e como eles avaliam o seu trabalho.",
    seasonOf: (org: string, season: string) => `${org} · ${season}`,
    stature: { elite: "Elite", contender: "Candidato", mid: "Meio de tabela", underdog: "Azarão", owners: "Donos" } as Record<string, string>,
    statureNote: {
      elite: "Dinheiro e estrelas, pouca paciência.",
      contender: "Um elenco forte, uma diretoria exigente.",
      mid: "Espaço para crescer, uma diretoria justa.",
      underdog: "Menos dinheiro, mais tempo.",
      owners: "O seu próprio clube: os donos dão tempo.",
    } as Record<string, string>,
    packages: {
      title: "As metas da temporada",
      body: "Três planos para a temporada. A verba é paga quando você aceita; o objetivo vale até a revisão.",
      ownersBody: "Três planos para a temporada. Os donos pagam a verba quando você aceita; o objetivo vale até a revisão.",
      name: { cautious: "Cauteloso", expected: "Esperado", ambitious: "Ambicioso" } as Record<string, string>,
      band: (key: string) => BOARD_BANDS_PT[key] ?? key,
      budget: (amount: string) => `Verba ${amount}`,
      noBudget: "Sem verba",
      bonus: (amount: string) => `Bônus de ${amount} se cumprir`,
      swing: (hit: number, miss: number) => `Confiança +${hit} se cumprir, −${Math.abs(miss)} se perder`,
      accept: "Aceitar",
      acceptPlan: (name: string) => `Aceitar o plano ${name.toLowerCase()}`,
      recommended: "A proposta da diretoria",
      ownersRecommended: "A proposta dos donos",
      budgetLabel: "Orçamento",
      bonusLabel: "Bônus se cumprir",
      hitLabel: "se cumprir",
      missLabel: "se perder",
      confidenceLabel: "Confiança",
      plan: (name: string) => `Plano ${name.toLowerCase()}`,
    },
    confidence: "Confiança da diretoria",
    confidenceOf: (n: number) => `${n} / 100`,
    verdict: {
      title: "O veredito da diretoria",
      met: (goal: string) => `Objetivo cumprido: ${goal}.`,
      missed: (goal: string) => `Objetivo perdido: ${goal}.`,
      confidence: (n: number) => `A confiança da diretoria termina a temporada em ${n} / 100.`,
      tier: (up: boolean, tier: string) => (up ? `Prestígio: sobe para ${tier}.` : `Prestígio: cai para ${tier}.`),
      open: "Abrir a diretoria",
      confidenceLabel: "Confiança na revisão",
      tierUp: "Subiu de patamar",
      tierDown: "Caiu de patamar",
      tierNote: (up: boolean) =>
        up ? "A base do orçamento e o teto salarial sobem na próxima temporada, e a cobrança da diretoria também." : "A base do orçamento e o teto salarial caem na próxima temporada, e a diretoria alivia a cobrança.",
    },
    band: (n: number): string => (n >= 80 ? "Forte" : n >= 40 ? "Estável" : n >= 25 ? "Sob pressão" : "Crítica"),
    lines: (warn: number, ultimatum: number) => `Abaixo de ${warn} a diretoria avisa. Abaixo de ${ultimatum}, depois de um aviso, ela dá um ultimato.`,
    log: "Por que mudou",
    logEmpty: "Nenhuma mudança nesta temporada ainda.",
    // rc.6 (ORGMODE UI-B): a página da diretoria, o número da HQ.
    warnLine: (n: number) => `Aviso ${n}`,
    ultimatumLine: (n: number) => `Ultimato ${n}`,
    logWhen: (season: number, week: number) => `T${season} · S${week}`,
    outOf: "/ 100",
    progressOf: (done: number, target: number) => `${done} de ${target}`,
    bandStart: "No início",
    bandNowLabel: "Agora",
    bandSame: "Igual ao início",
    planTerms: (bonus: string, hit: number, miss: number) => `Bônus de ${bonus} se cumprir. Confiança +${hit} se cumprir, −${Math.abs(miss)} se perder.`,
    alsoAsked: "Também pedido",
    alsoNote: "Estas metas também mexem na confiança, com peso menor.",
    managerTitle: "O técnico",
    contractLabel: "Contrato até",
    contractValue: (season: number) => `Temporada ${season}`,
    reputationLabel: "Reputação",
    clubsLabel: "Clubes comandados",
    money: {
      title: "O dinheiro da temporada",
      allocation: "Orçamento da diretoria",
      ownersAllocation: "Orçamento dos donos",
      notYet: "Pago quando você escolhe o plano",
      wages: "Folha / semana",
      ceiling: (amount: string) => `Teto ${amount}`,
      over: "Acima do teto da diretoria",
      projected: "Saldo previsto",
      projectedNote: (amount: string) => `${amount} com o bônus`,
      open: "Abrir Finanças",
    },
    glance: {
      title: "Diretoria",
      ownersTitle: "Donos",
      progress: (done: number, target: number) => `Objetivo ${done} de ${target}`,
      pending: "Escolha as metas da temporada",
      ultimatum: "Ultimato em aberto",
      met: "Objetivo cumprido",
      missed: "Objetivo perdido",
    },
    reasons: {
      objectiveMet: "Objetivo da temporada cumprido",
      objectiveMissed: "Objetivo da temporada perdido",
      objectiveOut: "Objetivo da temporada fora de alcance",
      onTrack: "Revisão: no caminho",
      behind: "Revisão: atrasado",
      secondaryMet: "Objetivo secundário cumprido",
      secondaryMissed: "Objetivo secundário perdido",
      legacyMet: "Objetivo de legado cumprido",
      titleMajor: "Título de Major",
      titleWorlds: "Título mundial",
      debt: "Dívida profunda",
      ultimatumMet: "Ultimato respondido",
      newSeason: "Nova temporada: a diretoria alivia a avaliação",
      promoted: "Subiu de patamar",
    } as Record<string, string>,
    objectives: "Objetivos da temporada",
    sporting: "Objetivo da temporada",
    secondary: "Secundário",
    legacy: "Legado",
    legacyNote: "Sem punição se não cumprir.",
    secondaryLabel: (kind: string, value: string): string => {
      switch (kind) {
        case "balance":
          return "Terminar a temporada com saldo positivo";
        case "wages":
          return `Manter a folha abaixo de ${value} por semana`;
        case "youth":
          return `Ter um titular com menos de ${value} anos no fim da temporada`;
        case "homeCore":
          return `Chegar a um Major com ${value} titulares da região`;
        default:
          return "";
      }
    },
    bandWord: (key: string) => BOARD_BANDS_PT[key] ?? key,
    likely: (key: string) => `${BOARD_BANDS_PT[key] ?? key} no início da temporada`,
    bandNow: (key: string) => `Agora: ${(BOARD_BANDS_PT[key] ?? key).toLowerCase()}`,
    notChosen: "Escolha primeiro o pacote da temporada.",
    budgetLine: (mult: number) => `Verba da próxima temporada: ×${mult.toFixed(2)}`,
    contract: (season: number) => `Contrato até a temporada ${season}`,
    protectedUntil: (season: number) => `Proteção pelo título até a temporada ${season}: perdas pela metade, sem ultimato.`,
    freeze: "Contratações congeladas: nenhuma contratação nesta janela.",
    ultimatum: {
      title: "Ultimato",
      body: "A diretoria quer isto até o fim da temporada. Se não cumprir, você deixa o clube na revisão da temporada.",
      progress: (done: number, target: number) => `${done} de ${target}`,
      chance: (key: string) => `${BOARD_BANDS_PT[key] ?? key} quando foi dado.`,
      met: "Respondido. A diretoria volta a apoiar você.",
    },
    dismissed: {
      title: "Você foi demitido",
      body: (org: string) => `A ${org} encerra o seu contrato no fim da temporada. O seu histórico continua com você. Escolha o próximo emprego para continuar.`,
      offers: "Propostas de emprego",
      found: "Fundar um novo clube",
      foundBody: (name: string) => `Comece a ${name} na sua região com três agentes livres e a verba de fundação.`,
      accept: "Aceitar",
      accepted: (org: string) => `Você começa na ${org} na próxima temporada.`,
      orgsLabel: "Organizações que querem você",
      orLabel: "Ou recomece",
      rankLine: (rank: number) => `Elenco nº ${rank} da região`,
    },
    approach: {
      title: "Uma sondagem",
      body: (org: string) => `A ${org} quer você como técnico na próxima temporada. O seu clube atual continuaria sem você.`,
      accept: "Aceitar o cargo",
      decline: "Ficar",
    },
    offerLine: (stature: string, region: string, rank: number) => `${stature} · ${region} · elenco nº ${rank}`,
    managerRep: "Reputação do técnico",
    spells: "Carreira",
    spell: (org: string, from: number, to: string) => `${org}: temporada ${from + 1} a ${to}`,
    now: "agora",
    openBoard: "Abrir a diretoria",
    boardFreezeError: "A diretoria congelou as contratações nesta janela.",
    wageBill: "Folha / semana",
    budgetCovers: (weeks: number) => `A verba da temporada cobre ${weeks} semanas da folha. Prêmios e patrocínios pagam o resto.`,
    upgrade: {
      title: "A diretoria paga uma melhoria",
      body: "A confiança está alta, então a diretoria paga uma melhoria à sua escolha. É paga por inteiro; um cargo da equipe de apoio é pago por uma temporada.",
      pick: "Pagar",
      taken: (name: string) => `Paga pela diretoria: ${name}.`,
    },
    // rc.6 (ORGMODE E1/E2/E4): o Prestígio da org consolidada, o recado da diretoria e a aprovação dela.
    standing: {
      title: "Prestígio",
      tier: { elite: "Elite", contender: "Candidato", mid: "Meio de tabela", underdog: "Azarão" } as Record<string, string>,
      phrase: { elite: "uma org de elite", contender: "uma candidata", mid: "uma org de meio de tabela", underdog: "uma azarã" } as Record<string, string>,
      value: (n: number) => `Prestígio ${n}`,
      next: (tier: string, line: number) => `${tier} a partir de ${line}`,
      top: "O topo da cena",
      relegation: (line: number) => `Abaixo de ${line} na revisão, a org cai de patamar`,
    },
    brief: {
      heading: "O recado da diretoria",
      takeover: (p: { org: string; tier: string; goal?: string }) => `Você assume a ${p.org}, ${p.tier}. A diretoria monta esta primeira temporada sobre o elenco que você herda.`,
      met: (p: { org: string; tier: string; goal?: string }) => `O objetivo da última temporada foi cumprido${p.goal ? ` (${p.goal})` : ""}. A diretoria parte daí e espera que a ${p.org} mantenha esse nível.`,
      missed: (p: { org: string; tier: string; goal?: string }) => `O objetivo da última temporada foi perdido${p.goal ? ` (${p.goal})` : ""}. A diretoria quer recuperar esse terreno nesta temporada.`,
      title: (p: { org: string; tier: string; goal?: string }) => `Um título na última temporada elevou a régua na ${p.org}. A diretoria agora planeja como ${p.tier} que vence.`,
      promoted: (p: { org: string; tier: string; goal?: string }) => `A ${p.org} subiu de patamar na revisão e agora planeja como ${p.tier}. A cobrança sobe junto.`,
      relegated: (p: { org: string; tier: string; goal?: string }) => `A ${p.org} caiu de patamar na revisão e agora planeja como ${p.tier}. A diretoria refaz a cobrança para reconstruir.`,
      ultimatumSurvived: (p: { org: string; tier: string; goal?: string }) => `Você respondeu ao ultimato da diretoria na última temporada. A ${p.org} segue com você e pede progresso constante.`,
      lastRank: (n: number) => `Última temporada: #${n} na região.`,
      bestFinish: (tier: string, place: number) => `Melhor resultado na última temporada: ${place <= 1 ? "título" : `top ${place}`} ${tier === "worlds" ? "no Worlds" : tier === "major" ? "em um Major" : "em um regional"}.`,
    },
    // rc.6 (R172): a meta da temporada na HQ enquanto o plano da org consolidada espera.
    planPending: "O plano da temporada da diretoria espera a sua resposta. A meta da temporada é o plano que você aceitar.",
    planOpen: "Abrir o plano da temporada",
    // rc.6: um jogador acima do alcance de uma org consolidada.
    signCapLock: (cap: number) => `Acima do alcance da org: ela contrata até ${cap}`,
    approval: {
      boardApproval: (n: number) => `A diretoria não banca isso enquanto a confiança estiver abaixo de ${n}.`,
      boardFlagship: (n: number) => `A diretoria só banca o centro de performance com a confiança em ${n} ou mais.`,
      boardFrozen: "A diretoria congelou os investimentos nesta janela.",
      needs: (n: number) => `Precisa da aprovação da diretoria: confiança ${n}`,
    },
    mail: {
      tpl: {
        boardPackage: () => "A proposta da diretoria para a temporada",
        boardCheckpoint: (p: Record<string, string | number>) => `Revisão da diretoria após o split ${p.split}`,
        boardWarning: () => "Um aviso da diretoria",
        boardUltimatum: () => "Ultimato da diretoria",
        boardUltimatumMet: () => "A diretoria volta a apoiar você",
        boardDismissed: (p: Record<string, string | number>) => `A ${p.org} demite o técnico`,
        boardHighConfidence: () => "A diretoria renova o seu contrato",
        boardFreeze: () => "Contratações congeladas",
        boardVerdict: () => "O veredito da diretoria na temporada",
        boardApproach: (p: Record<string, string | number>) => `A ${p.org} faz uma sondagem`,
        boardNewJob: (p: Record<string, string | number>) => `Bem-vindo à ${p.org}`,
        boardUpgrade: () => "A diretoria vai pagar uma melhoria",
        boardTierUp: (p: Record<string, string | number>) => `A ${p.org} sobe de patamar`,
        boardTierDown: (p: Record<string, string | number>) => `A ${p.org} cai de patamar`,
        orgTierUp: (p: Record<string, string | number>) => `A ${p.org} sobe para o patamar ${({ elite: "elite", contender: "candidato", mid: "meio de tabela", underdog: "azarão" } as Record<string, string>)[String(p.to)] ?? p.to}`,
        orgTierDown: (p: Record<string, string | number>) => `A ${p.org} cai para o patamar ${({ elite: "elite", contender: "candidato", mid: "meio de tabela", underdog: "azarão" } as Record<string, string>)[String(p.to)] ?? p.to}`,
      } as Record<string, (p: Record<string, string | number>) => string>,
      body: {
        boardPackage: () => "Três pacotes estão na sua mesa: cauteloso, esperado e ambicioso. Mais ambição traz mais verba e um bônus maior, e custa mais confiança se o objetivo não for cumprido. O relógio espera a sua escolha.",
        boardCheckpoint: (p: Record<string, string | number>) =>
          `A diretoria revisou o split. A confiança ${Number(p.delta) >= 0 ? "subiu" : "caiu"} ${Math.abs(Number(p.delta))} e está em ${p.confidence}.${p.band ? ` O objetivo da temporada agora está na faixa "${BOARD_BANDS_PT[String(p.band)] ?? ""}".` : ""}`,
        boardWarning: (p: Record<string, string | number>) =>
          `A confiança da diretoria está em ${p.confidence}. Se cair abaixo de ${p.line}, a diretoria vai dar um ultimato com uma missão concreta.`,
        boardUltimatum: (p: Record<string, string | number>) =>
          `A diretoria definiu uma missão para o resto da temporada; ela está na página da Diretoria. A diretoria a classifica como "${BOARD_BANDS_PT[String(p.band)] ?? ""}". Se não for cumprida até a revisão da temporada, o seu contrato termina ali.`,
        boardUltimatumMet: (p: Record<string, string | number>) => `A missão foi cumprida. A confiança voltou a ${p.confidence}.`,
        boardDismissed: (p: Record<string, string | number>) =>
          `A ${p.org} não seguirá com você depois desta temporada. ${p.n} propostas esperam na revisão da temporada, uma delas um novo clube seu.`,
        boardHighConfidence: (p: Record<string, string | number>) =>
          `A confiança está em ${p.confidence}. A diretoria aumenta a verba da próxima temporada e renova o seu contrato até a temporada ${p.until}.`,
        boardFreeze: (p: Record<string, string | number>) => `Com a confiança em ${p.confidence}, a diretoria não permite contratações na primeira janela da próxima temporada.`,
        boardVerdict: (p: Record<string, string | number>) =>
          `O objetivo da temporada foi ${Number(p.met) ? "cumprido" : "perdido"}. A confiança da diretoria termina a temporada em ${p.confidence}.`,
        boardApproach: (p: Record<string, string | number>) =>
          `A ${p.org} (${p.region}) pergunta se você comandaria o time na próxima temporada. Responda na revisão da temporada.`,
        boardNewJob: (p: Record<string, string | number>) => `Você assume a ${p.org}. A ${p.left} segue na liga sem você.`,
        boardUpgrade: (p: Record<string, string | number>) => `Com a confiança em ${p.confidence}, a diretoria vai pagar uma melhoria. Escolha na página da Diretoria.`,
        boardTierUp: (p: Record<string, string | number>) =>
          `O prestígio leva a org ao patamar ${({ elite: "elite", contender: "candidato", mid: "meio de tabela", underdog: "azarão" } as Record<string, string>)[String(p.to)] ?? p.to}. A base do orçamento e o teto salarial sobem junto, e a cobrança da diretoria também.`,
        boardTierDown: (p: Record<string, string | number>) =>
          `O prestígio deixa a org no patamar ${({ elite: "elite", contender: "candidato", mid: "meio de tabela", underdog: "azarão" } as Record<string, string>)[String(p.to)] ?? p.to}. A base do orçamento e o teto salarial caem junto, e a diretoria alivia a cobrança.`,
        orgTierUp: (p: Record<string, string | number>) => `A ${p.org} sobe um patamar na cena depois da temporada.`,
        orgTierDown: (p: Record<string, string | number>) => `A ${p.org} cai um patamar na cena depois da temporada.`,
      } as Record<string, (p: Record<string, string | number>) => string>,
    },
  },
  /** v2.2 rc.6 (ORGMODE UI-A): a entrada. A porta, a escolha, o dossiê e a chegada. */
  takeover: {
    door: {
      title: "Comece uma carreira de técnico",
      kicker: "Funde um clube do zero ou assuma o comando de uma org que já existe.",
      found: {
        title: "Criar uma org nova",
        body: "Dê o nome, desenhe o escudo e contrate três desconhecidos. O caminho vai da cena amadora até o Worlds.",
        facts: [
          { label: "Você começa com", value: "Três desconhecidos" },
          { label: "Você busca", value: "Reputação" },
          { label: "O desafio", value: "Crescer" },
        ],
        action: "Fundar um clube",
      },
      takeover: {
        title: "Assumir uma org existente",
        body: "Um elenco real com contrato, um coach, um orçamento e uma diretoria com metas para cada temporada.",
        facts: [
          { label: "Você começa com", value: "Um elenco real" },
          { label: "Você busca", value: "As metas da diretoria" },
          { label: "O desafio", value: "Manter o cargo" },
        ],
        action: "Escolher uma org",
      },
      slotsFull: "Os três espaços de carreira estão ocupados. Apague um em Carreiras para começar outra.",
      openSaves: "Abrir Carreiras",
      savesHint: "Crie uma org nova ou assuma uma existente",
    },
    pick: {
      title: "Assumir uma org existente",
      kicker: "As orgs como estão na primeira temporada, por patamar. Escolha uma para ler o dossiê.",
      regions: "Região",
      orgs: "Organizações",
      tierCount: (n: number) => (n === 1 ? "1 organização" : `${n} organizações`),
      rank: (rank: number, teams: number) => `${rank}º de ${teams}`,
      rating: "Força do elenco",
      empty: "Nenhuma org desta região pode ser assumida na primeira temporada.",
      fewOrgs: (n: number) => (n === 1 ? "Só uma org desta região pode ser assumida." : `Só ${n} orgs desta região podem ser assumidas.`),
      none: "Escolha uma org na lista para ler o dossiê.",
      back: "Voltar",
      allOrgs: "Todas as orgs",
      go: (org: string) => `Assumir a ${org}`,
      goShort: "Assumir",
      /** v2.2 ORGMODE-2027: uma org que volta da sua última lineup para completar a região. */
      returning: (season: string) => `De volta, vista pela última vez em ${season}`,
      loading: "Lendo o dossiê",
    },
    dossier: {
      squad: "O elenco",
      coach: "Coach",
      noCoach: "Nenhum coach com contrato. Dá para contratar um desde o primeiro dia.",
      reserve: "Reserva",
      inherit: "O que você herda",
      cash: "Caixa",
      budget: "Orçamento da temporada",
      budgetNote: "A verba do plano esperado",
      wages: "Salários por semana",
      ceiling: (amount: string) => `Teto ${amount}`,
      overCeiling: "Acima do teto da diretoria",
      installations: "Instalações",
      noInstallations: "Nenhuma ainda",
      staff: "Staff contratada",
      noStaff: "Nenhuma",
      board: "O que a diretoria espera",
      boardNote: "No primeiro dia você escolhe entre três planos. Este é o que a diretoria propõe.",
      chance: (band: string) => `A diretoria avalia: ${band.toLowerCase()}.`,
      grace: (n: number) => (n <= 1 ? "Sem ultimato na primeira temporada" : `Sem ultimato por ${n} temporadas`),
      missLabel: "Confiança se não cumprir",
      hitLabel: "Confiança se cumprir",
      bonusLabel: "Bônus se cumprir",
      also: "Também pede",
      plans: "Os três planos",
      confidence: "Confiança da diretoria",
      noBoard: "A diretoria desta org define o plano no primeiro dia.",
      difficulty: "Dificuldade",
      manager: "Nome do manager",
      managerPlaceholder: "Seu nome",
    },
    splash: {
      kicker: "Primeiro dia no clube",
      title: (manager: string, org: string) => `${manager}, manager da ${org}`,
      ask: "O primeiro pedido da diretoria",
      squad: "Seu elenco",
      action: "Ir para o QG",
    },
  },
  orgmode: {
    standing: "Prestígio",
    budget: {
      title: "Orçamento da temporada",
      when: (season: string, mondays: number) =>
        mondays > 1 ? `${season} · faltam ${mondays} segundas` : mondays === 1 ? `${season} · falta a última segunda` : `${season} · nenhuma segunda a lançar`,
      allocation: "O orçamento da diretoria nesta temporada",
      bonus: (amount: string) => `Mais ${amount} se a meta for cumprida`,
      barLabel: "O dinheiro da temporada",
      barNote: "O caixa e as receitas já contratadas, contra o que está lançado até o fim da temporada.",
      spent: "Gasto",
      committed: "Comprometido",
      free: "Livre",
      short: "Falta",
      shortBy: (amount: string) => `Os compromissos passam ${amount} do dinheiro da temporada.`,
      pendingTitle: "Aguardando as metas da temporada",
      pendingBody: "A diretoria paga o orçamento quando você escolhe uma das três metas. Até lá, as contas correm com o caixa.",
      allocationProposed: "A proposta da diretoria, paga quando você escolher as metas",
      pendingLink: "Escolher as metas",
      projected: "No fim da temporada",
      projectedBasis: "Neste ritmo, antes de prêmios e vendas de jogadores",
      projectedIfMet: (amount: string) => `${amount} se a meta for cumprida`,
      projectedPending: (amount: string) => `Com os ${amount} das metas propostas`,
      wagesTitle: "Folha salarial",
      wagesUnit: "por semana, elenco e coach",
      ceiling: (amount: string) => `Teto da diretoria: ${amount} por semana`,
      room: (amount: string) => `${amount} por semana de folga`,
      over: (amount: string) => `${amount} por semana acima do teto`,
      noCeiling: "Os donos não fixam teto.",
      linesTitle: "Por departamento",
      colSpent: "Gasto",
      colCommitted: "A lançar",
      line: {
        wages: "Salários do elenco",
        coach: "Coach",
        staff: "Staff",
        facilities: "Instalações e manutenção",
        camps: "Bootcamps",
        transfers: "Transferências",
        loan: "Parcelas de empréstimo",
        other: "Outros",
      } as Record<string, string>,
      total: "Total",
      incomeTitle: "Receitas",
      colReceived: "Recebido",
      colContracted: "Contratado",
      income: { sponsor: "Patrocínio", prizes: "Premiações", fanbase: "Torcida", sales: "Vendas de jogadores" } as Record<string, string>,
      incomeNote: "Prêmios e vendas contam quando são lançados.",
      ledgerFrom: (week: number) => `Contado a partir da semana ${week}: o extrato guarda os lançamentos mais recentes.`,
      sponsorNone: "Nenhum patrocínio ainda. Novas ofertas chegam a esta mesa quando o próximo split abrir.",
    },
    ops: {
      title: "Operações",
      body: "O que a org mantém e o que pode acrescentar. O dinheiro decide; a diretoria aprova cada instalação.",
      running: "Custo fixo",
      perWeek: (amount: string) => `${amount} / semana`,
      dept: { facilities: "Instalações", staff: "Staff", camps: "Bootcamps" } as Record<string, string>,
      deptNote: {
        facilities: "Investimentos. Cada compra precisa do aval da diretoria.",
        staff: "Contratos pagos toda segunda. Contrate e dispense como achar melhor.",
        camps: "Um bootcamp por split, com a vantagem levada para a competição.",
      } as Record<string, string>,
      state: {
        owned: "Na org",
        retained: "Contratado",
        available: "Disponível",
        needsApproval: "Precisa de aval",
        frozen: "Congelado",
        cantAfford: "Sem dinheiro",
      } as Record<string, string>,
      needs: (need: number, now: number) => `A diretoria aprova com confiança ${need}. Ela está em ${now}.`,
      signs: "A diretoria aprova",
      frozen: "A diretoria congelou os investimentos nesta janela.",
      cantAfford: "Dinheiro insuficiente acima do piso.",
      upkeep: (amount: string) => `Manutenção de ${amount} por semana`,
      buy: "Comprar",
      hire: "Contratar",
      release: "Dispensar",
      run: "Fazer o bootcamp",
      saves: (split: string) => `Dispensar economiza ${split} por split`,
      releaseTitle: (name: string) => `Dispensar: ${name}`,
      releaseBody: (split: string, week: string) =>
        `O contrato para a partir da próxima segunda: a org economiza ${split} por split (${week} por semana). Dá para contratar a função de novo depois, pelo preço do momento.`,
      releaseConfirm: "Dispensar",
      keep: "Manter",
      campUsed: "Já feito neste split",
      campActive: (date: string) => `Em vigor até ${date}`,
      campReady: "Pronto para fazer",
      allOwned: "Todas as instalações estão prontas",
      next: "Próxima compra",
      open: "Abrir operações",
      facilitiesOwned: (owned: number, total: number) => `${owned} de ${total} na org`,
      staffNone: "Nenhum staff contratado",
      facilitiesNone: "Nenhuma instalação ainda",
      staffList: (names: string) => names,
    },
    club: {
      promotes: (pct: number, cap: number) =>
        `Uma promoção aumenta a base do orçamento e o teto da folha em ${pct}%, aumenta o que a diretoria espera e deixa a org contratar jogadores até ${cap}.`,
      top: (pct: number) => `No topo, a diretoria espera títulos. Uma queda corta a base do orçamento e o teto da folha em ${pct}%.`,
      opsTitle: "Operações",
      opsBody: "Instalações, staff e bootcamps. Compra e gestão ficam em Finanças.",
      opsOpen: "Abrir em Finanças",
    },
    words: {
      common: { rep: "Prestígio", reputation: "Prestígio" },
      goals: {
        reward: (n: number) => `+${n} de prestígio na revisão`,
        missCost: (n: number) => `Se falhar: −${n} de prestígio`,
        noCost: "Nenhum prestígio em jogo",
        repRisk: (n: number) => `O prestígio da org exige (−${n} se falhar)`,
      },
      inserts: { fx: { rep: (n: number) => `${n > 0 ? "+" : ""}${n} de prestígio`, repLabel: "Prestígio" } },
      event: { digestRep: "Prestígio" },
      hub: { edgesEmpty: "Nenhuma vantagem ainda: coach, instalações e staff se compram em Finanças." },
      market: {
        filterSignable: "Ao alcance desta org",
        lockedHint: "Jogadores acima deste nível não vêm para a org com o prestígio atual.",
        errors: {
          bankLimit: "Acima do que o banco oferece com o prestígio da org.",
          repGate: "Acima do alcance desta org: um jogador deste nível não vem.",
        },
      },
      finances: {
        bankHint: (weeks: number, pct: number) => `Crédito pelo prestígio da org: ${weeks} parcelas semanais, ${pct}% de juros.`,
        bankHintEnd: (weeks: number, pct: number) =>
          `Crédito pelo prestígio da org: ${weeks} parcelas semanais, ${pct}% de juros. Não resta empréstimo emergencial: furar o piso encerra a carreira.`,
        bankLockedRep: "O banco empresta quando o prestígio da org subir um pouco.",
        deal: { boldLocked: "Contratos ousados vêm com mais prestígio." },
      },
      news: {
        feed: { subject: { rep: "Prestígio" } },
        body: {
          unlock: (p: Record<string, string | number>) => `O prestígio da org traz um novo nível de patrocínio: ${p.name}.`,
          repDown: (p: Record<string, string | number>) => `As expectativas foram ditas e não cumpridas; o prestígio da ${p.org} sente o golpe. Os resultados o recuperam.`,
        },
      },
      mail: {
        body: {
          unlock: (p: Record<string, string | number>) => `O prestígio da org traz um novo nível de patrocínio: ${p.name}. As ofertas desse nível chegam à mesa de Finanças.`,
        },
      },
      tour: {
        hub: { progress: { title: "Operações", body: "Os resultados movem o prestígio da org. Instalações, staff e bootcamps estão disponíveis desde o primeiro dia: o dinheiro e a diretoria decidem." } },
        finances: { progress: { title: "Toque a org", body: "Instalações, staff e bootcamps fazem o elenco evoluir e jogar melhor. A diretoria aprova cada instalação." } },
      },
    },
  },
  proWorld: {
    title: "Carreira",
    tabs: { today: "Hoje", team: "Time", offers: "Propostas", inbox: "Caixa" } as Record<string, string>,
    date: (season: number, week: number, day: string) => `Temporada ${season}, semana ${week}, ${day}`,
    days: ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"],
    noTeam: "Ainda sem time. Seu rank e seu treino trazem o primeiro convite de um time amador.",
    prologue: (cups: string, rank: string, overall: number, need: number) => `Ainda sem time. Um time amador chama quando você chega a ${cups} no ranqueado ou a um overall de ${need}. Você está em ${rank}, com overall ${overall}.`,
    freeAgent: "Você é agente livre. Times amadores e orgs ainda podem chamar.",
    amateurTeam: (side: string) => `Você joga pelo ${side}, um time amador.`,
    orgTeam: (org: string, starts: boolean) => (starts ? `Você é titular da ${org}.` : `Você está no banco da ${org}.`),
    next: "Próximo do seu time",
    nextEvent: (name: string, weekday: string) => `${name}, ${weekday}`,
    nextNone: "Nenhum evento do seu time no calendário desta semana.",
    nextOrg: "Sua org joga os qualifiers e regionais da região. A súmula chega depois de cada um.",
    advance: "Continuar",
    advanceHint: "Avança dia a dia e para quando algo precisa de você: dia de jogo, súmula, proposta, fim da temporada.",
    oneDay: "Um dia",
    offerOpenHint: "Você tem uma proposta aberta. Ela fecha na data dela se você seguir sem responder.",
    playMatchday: (name: string) => `Jogar ${name}`,
    continueEvent: (name: string) => `Continuar ${name}`,
    seasonEnd: "A temporada acabou",
    seasonEndBody: "A linha da sua temporada entra no registro e os contratos são acertados. Depois o mundo passa para a próxima temporada.",
    startSeason: "Começar a próxima temporada",
    openWeek: "Planejar a semana",
    weekPlan: "Esta semana",
    block: ["Seg-Ter", "Qua-Qui", "Sex"],
    activity: { train: "Treino", ranked: "Ranqueado", scrim: "Scrim", content: "Conteúdo", rest: "Descanso" } as Record<string, string>,
    coachPlan: "Plano do técnico",
    yourPlan: "Seu plano",
    retire: {
      title: "Sua carreira",
      offerTitle: "Uma temporada sem time",
      offerBody: "Você pode encerrar aqui com seu cartão, ou continuar jogando e esperar o próximo convite.",
      keepGoing: "Continuar jogando",
      retire: "Aposentar",
      retireHint: "Aposentar encerra a carreira. Nada do que você conquistou é tirado.",
      lastSeason: (age: number) => `Esta é a sua última temporada: a carreira termina aos ${age + 1}, quando a temporada fechar.`,
      mayEnd: "A partir daqui a carreira pode terminar quando qualquer temporada fechar.",
      confirmTitle: "Se aposentar agora?",
      confirmBody: "A carreira termina aqui e o cartão fica final. Nada do que você conquistou é tirado.",
      confirm: "Sim, me aposentar",
      cancel: "Agora não",
      goodbyeTitle: (name: string) => `${name} se aposenta`,
      careerLine: (from: number, to: number, seasons: number, series: number, won: number) => `Dos ${from} aos ${to} anos, ${seasons} ${seasons === 1 ? "temporada" : "temporadas"}, ${series} séries jogadas e ${won} vencidas.`,
      peak: (_p: string) => "Overall de pico",
      orgs: "Orgs",
      titles: "Títulos",
      awards: "Prêmios",
      none: "Nenhum",
      nickname: (nick: string, why: string) => `Conhecido como ${nick}: ${why}`,
      retiredTitle: "Aposentado",
      retiredBody: "A carreira acabou. O cartão tem seu pico, suas orgs e seus títulos.",
      card: "Abrir seu cartão",
    },
    roles: { starter: "Titular", rotation: "Rotação", bench: "Banco", amateur: "Amador", none: "Sem time" } as Record<string, string>,
    live: {
      playGame: (n: number) => `Jogar o jogo ${n}`,
      yourCall: (call: string, ok: boolean) => (ok ? `${call}: deu certo. Um pequeno ganho na sua nota e nas chances do time neste jogo.` : `${call}: não deu certo. Um pequeno custo na sua nota e nas chances do time neste jogo.`),
      instinctCall: (call: string, ok: boolean) => (ok ? `No instinto você foi de ${call}: deu certo, um pequeno ganho neste jogo.` : `No instinto você foi de ${call}: não deu certo, um pequeno custo neste jogo.`),
      simSeries: "Simular o resto da série",
      simEvent: "Simular o resto do evento",
      simHint: "Simular joga cada lance restante no instinto, que em média nem ajuda nem atrapalha.",
      benched: "Você começa este evento no banco. A súmula chega quando ele acabar.",
    },
    stopped: {
      matchday: (name: string) => `A semana parou para o seu jogo: ${name}.`,
      event: (name: string) => `A semana parou no meio de ${name}. Continue pela central da carreira.`,
      offer: (n: number) => (n === 1 ? "A semana parou: uma proposta espera sua resposta." : `A semana parou: ${n} propostas esperam sua resposta.`),
      report: "A semana parou: uma súmula está pronta.",
      seasonEnd: "A semana parou: a temporada acabou.",
      retired: "Sua carreira acabou.",
      open: "Abrir a central da carreira",
      next: (what: string) => `Próximo: ${what}`,
    },
    weekStop: {
      title: "Planeje esta semana",
      body: "Escolha os três blocos da semana antes que ela comece. O plano do técnico descansa você quando está cansado.",
      coach: "Jogar o plano do técnico",
      repeat: "Jogar a semana passada de novo",
      own: "Planejar eu mesmo",
      continueWithPlan: "Aceitar o plano e continuar",
      auto: "Planejar cada semana por mim até algo acontecer",
      autoHint: "O Continuar então joga o seu plano salvo a cada semana, ou o do técnico quando o seu cansaria você. Ele ainda para em dias de jogo, propostas, energia, subida de rank, mecânica nova e fim de temporada, e pelo menos a cada 4 semanas.",
      autoOff: "Planejar semana a semana",
      autoOn: "O plano do técnico joga cada semana até algo acontecer.",
    },
    lastWeek: {
      title: "Semana passada",
      line: (growth: string, energy: number) => `Pontos de atributo ${growth}, energia ${energy} de 100.`,
      rank: (to: string) => `Novo rank: ${to}.`,
      see: "Ver a semana",
    },
    notices: {
      offerExpiring: (name: string, days: number) => (days <= 0 ? `A proposta da ${name} expira hoje.` : `A proposta da ${name} expira em ${days} ${days === 1 ? "dia" : "dias"}.`),
      burnoutWarning: (energy: number) => `Energia ${energy} de 100: mais uma semana assim pode acabar em burnout, que deixa você fora por uma ou duas semanas. Descanse nesta semana.`,
      digest: (weeks: number, o1: number, o2: number, m1: number, m2: number, energy: number) => `${weeks} semanas jogadas: overall de ${o1} para ${o2}, ${m2 - m1 >= 0 ? "+" : ""}${m2 - m1} MMR, energia ${energy}.`,
      rankUp: (rank: string) => `Você subiu para ${rank}.`,
      mechanic: (name: string) => `Nova mecânica desbloqueada: ${name}.`,
      burnedOut: (weeks: number) => `Burnout: você está fora por ${weeks} ${weeks === 1 ? "semana" : "semanas"}.`,
      contractEnding: (org: string, renewal: boolean) => (renewal ? `Seu contrato com a ${org} acaba nesta temporada. Eles ofereceram renovação.` : `Seu contrato com a ${org} acaba nesta temporada e eles não vão renovar.`),
      planFellBack: (energy: number) => `Seu plano deixaria você cansado (energia ${energy}), então esta semana segue o plano do técnico.`,
      rolePromoted: (org: string) => `A ${org} fez de você titular.`,
      roleKept: (org: string) => `A ${org} mantém você na rotação por enquanto.`,
    },
    report: {
      title: "Súmula",
      benched: "Você não jogou: o técnico foi com os titulares.",
      series: (opponent: string) => `contra ${opponent}`,
      game: (n: number) => `Jogo ${n}`,
      won: "Vitória",
      lost: "Derrota",
      ot: "Prorrogação",
      line: (goals: number, assists: number, saves: number) => `${goals} G, ${assists} A, ${saves} DEF`,
      rating: "Nota",
      mvp: "MVP",
      nextGame: "Próximo jogo",
      showAll: "Mostrar tudo",
      close: "Fechar a súmula",
      placement: { champion: "Campeões", final: "Perdeu a final", playoffs: "Caiu nos playoffs", out: "Caiu antes dos playoffs" } as Record<string, string>,
      avg: (r: string) => `Sua média: ${r}`,
      hidden: "Ainda não jogado",
    },
    team: {
      rotationShare: (every: number) => `Rotação: você é titular em cerca de um evento a cada ${every}.`,
      nextRotation: (n: number) => (n <= 1 ? "Você joga o próximo evento da org." : `Sua próxima chance: em ${n} eventos.`),
      review: (n: number) => `O técnico revisa seu papel em ${n} ${n === 1 ? "série" : "séries"}.`,
      title: "Seu time",
      none: "Você não tem time. Aceite um convite em Propostas.",
      starter: "Titular",
      bench: "Banco",
      you: "Você",
      trust: "Confiança do técnico",
      trustHint: "Notas boas e semanas sérias no banco sobem. Notas baixas e pedido de transferência descem. O técnico lê a confiança com seu overall e sua forma a cada split.",
      contract: (salary: string, end: number) => `${salary} por split, até o fim da temporada ${end}`,
      promised: (role: string) => `Papel prometido: ${role}`,
      requestTransfer: "Pedir transferência",
      requestHint: "Só do banco. Custa confiança do técnico e abre você a propostas na próxima janela.",
      requested: "Você pediu transferência. Propostas podem chegar na próxima janela.",
      sideLevel: (n: number) => `O time joga em torno de ${n}.`,
    },
    offers: {
      rotationMeans: (every: number) => `Rotação quer dizer que você é titular em cerca de um evento a cada ${every} e fica no banco nos outros. O técnico revisa o papel depois de algumas séries.`,
      starterMeans: "Titular quer dizer que você está na escalação, enquanto sua forma e a confiança do técnico se mantêm.",
      uncertain: "O futuro desta org é incerto: ela pode não ficar muito tempo na cena.",
      title: "Propostas",
      none: "Nenhuma proposta agora. Orgs chamam nas janelas de transferência; times amadores chamam quando você está pronto para eles.",
      amateur: "Time amador",
      org: "Proposta de org",
      renewal: "Renovação",
      role: { starter: "Titular", rotation: "Rotação" } as Record<string, string>,
      salary: (s: string) => `${s} por split`,
      seasons: (n: number) => (n === 1 ? "1 temporada" : `${n} temporadas`),
      level: (n: number) => `Nível do time ${n}`,
      sideBody: (level: number) => `Dois jogadores em torno de ${level}. Você jogaria todas as copas e o Open Qualifier com eles.`,
      expires: (season: number, week: number) => `Aberta até a temporada ${season}, semana ${week}`,
      leavesSide: (side: string) => `Aceitar significa sair de ${side}.`,
      accept: "Aceitar",
      counter: "Contraproposta",
      decline: "Recusar",
      counterRisk: (pct: number) => `A contraproposta pede mais dinheiro. Risco de desistirem: ${pct}%`,
      improved: "Eles melhoraram a proposta depois da sua contraproposta.",
      blocked: { matchday: "Termine o jogo de hoje antes.", orgGone: "Esta org não está mais na cena.", closed: "Esta proposta está fechada." } as Record<string, string>,
      reason: {
        form: (p: Record<string, string | number>) => `Nota média ${p.avg} nas suas últimas ${p.n} séries. Idade ${p.age}.`,
        results: (p: Record<string, string | number>) => `Seu time venceu ${p.won} das suas últimas ${p.n} séries. Overall ${p.overall} aos ${p.age} anos.`,
        youth: (p: Record<string, string | number>) => `Overall ${p.overall} aos ${p.age} anos. Eles contratam pensando nos próximos anos.`,
        level: (p: Record<string, string | number>) => `Overall ${p.overall} aos ${p.age} anos.`,
        renewal: (p: Record<string, string | number>) => `Confiança do técnico ${p.trust}. Overall ${p.overall} aos ${p.age} anos.`,
      } as Record<string, (p: Record<string, string | number>) => string>,
      history: "Propostas anteriores",
      status: { accepted: "Aceita", declined: "Recusada", expired: "Expirou", withdrawn: "Retirada" } as Record<string, string>,
    },
    inbox: {
      when: (season: number, week: number) => `T${season} · sem ${week}`,
      title: "Caixa de entrada",
      none: "Nada ainda.",
      scene: "Pela cena",
      champion: (org: string, event: string) => `${org} venceu ${event}.`,
      transfer: (player: string, to: string) => `${player} foi para ${to}.`,
      sceneNone: "Ainda sem resultados nesta temporada.",
    },
    seasonReview: {
      title: (n: number) => `Balanço da temporada ${n}`,
      open: "Balanço da temporada",
      roles: { starter: "Titular", rotation: "Rotação", bench: "Banco", amateur: "Time amador", none: "Sem time" } as Record<string, string>,
      teamLine: (team: string, role: string) => `${team} · ${role}`,
      line: (series: number, won: number, games: number, avg: string) => `${series} ${series === 1 ? "série" : "séries"}, ${won} vencidas, ${games} jogos, nota média ${avg}`,
      noSeries: "Nenhuma série jogada nesta temporada.",
      best: (r: string) => `Melhor nota numa série: ${r}`,
      overall: (a: number, b: number) => `Overall de ${a} para ${b}`,
      titles: "Títulos",
      growthTitle: "O que mexeu nos seus atributos",
      growthLine: (stat: string, delta: number, why: string) => `${stat} ${delta > 0 ? "+" : ""}${delta.toFixed(2)} (${why})`,
      sources: { training: "treino", ranked: "ranqueado", scrim: "scrims", match: "partidas", age: "idade" } as Record<string, string>,
      galaTitle: "A gala",
      galaNone: "Nenhum prêmio teve vencedor nesta temporada.",
      award: (scope: string, kind: string, names: string) => `${scope} ${kind}: ${names}`,
      youWon: "Você ganhou.",
      youNominee: "Você foi indicado.",
      close: "Continuar",
    },
    history: {
      games: (n: number) => `${n} jogos`,
      title: "Temporadas",
      line: (age: number, from: number, to: number) => `${age} anos: overall de ${from} para ${to}`,
      series: (n: number, won: number, avg: string) => n === 0 ? "Nenhuma série jogada" : `${n} ${n === 1 ? "série" : "séries"}, ${won} vencidas, nota média ${avg}`,
    },
    news: {
      rolePromoted: (p: Record<string, string | number>) => `O técnico da ${p.org} revisou seu papel: agora você é titular.`,
      roleKept: (p: Record<string, string | number>) => `O técnico da ${p.org} revisou seu papel: rotação por enquanto. A próxima revisão vem depois de mais séries.`,
      nicknameEarned: (p: Record<string, string | number>) => `A cena agora tem um apelido para você: ${p.name}.`,
      orgLeftScene: (p: Record<string, string | number>) => `A ${p.org} não está na cena nesta temporada, e seu contrato acaba com ela. Você é agente livre, e orgs vão chamar nesta janela.`,
      retiredAge: (p: Record<string, string | number>) => `Aos ${p.age} anos, chegou a hora: você se aposenta. Seu cartão está pronto.`,
      retireOffered: () => `Uma temporada sem contrato. Você pode se aposentar agora com seu cartão, ou seguir em frente.`,
      retiredChoice: () => `Você se aposentou. Seu cartão está pronto.`,
      amateurInvite: (p: Record<string, string | number>) => `O ${p.side} quer você na escalação.`,
      joinedSide: (p: Record<string, string | number>) => `Você entrou no ${p.side}.`,
      leftSide: (p: Record<string, string | number>) => `Você saiu do ${p.side}.`,
      orgOffer: (p: Record<string, string | number>) => `A ${p.org} fez uma proposta.`,
      renewalOffer: (p: Record<string, string | number>) => `A ${p.org} ofereceu um novo contrato.`,
      noRenewal: (p: Record<string, string | number>) => `A ${p.org} não vai renovar seu contrato.`,
      counterImproved: (p: Record<string, string | number>) => `A ${p.org} melhorou a proposta para ${p.salary} por split.`,
      counterWalked: (p: Record<string, string | number>) => `A ${p.org} retirou a proposta depois da sua contraproposta.`,
      signed: (p: Record<string, string | number>) => `Você assinou com a ${p.org}.`,
      transferred: (p: Record<string, string | number>) => `Você saiu da ${p.from} para a ${p.org}.`,
      displacedBench: (p: Record<string, string | number>) => `${p.player} vai para o banco da ${p.org} para abrir espaço para você.`,
      displacedFree: (p: Record<string, string | number>) => `${p.player} deixa a ${p.org} e vira agente livre.`,
      lineupStart: (p: Record<string, string | number>) => `O técnico da ${p.org} põe você como titular neste split.`,
      lineupBench: (p: Record<string, string | number>) => `O técnico da ${p.org} começa o split sem você.`,
      rotationStart: (p: Record<string, string | number>) => `Você é titular da ${p.org} nesta semana no lugar de ${p.player}.`,
      transferRequested: (p: Record<string, string | number>) => `Você pediu transferência à ${p.org}.`,
      renewed: (p: Record<string, string | number>) => `Você renovou com a ${p.org}.`,
      contractEnded: (p: Record<string, string | number>) => `Seu contrato com a ${p.org} acabou. Você é agente livre.`,
      orgGone: (p: Record<string, string | number>) => `A ${p.org} saiu da cena. Você é agente livre.`,
      seasonDone: (p: Record<string, string | number>) => Number(p.series) === 0 ? `A temporada ${p.season} acabou sem nenhuma série jogada.` : `A temporada ${p.season} acabou: ${p.series} séries jogadas, nota média ${p.avg}.`,
      sideTitle: (p: Record<string, string | number>) => `O ${p.side} venceu ${p.event}.`,
    } as Record<string, (p: Record<string, string | number>) => string>,
  },
  /** v2.2 ENDLESS: os textos da frente. */
  endless: {
    hosts: ENDLESS_HOSTS_PT as readonly string[],
    legendsNote: "Elencos históricos da RLCS no rating real do auge. Paga prêmio e reputação, sem Season Points.",
    /** A linha da ficha da org para um projeto rival (o kit da temporada). */
    projectKit: (season: number, kit: string) => `Projeto, temporada ${season}: ${kitPt(kit)}.`,
  },
  locker: CAREER_LOCKER_PT, // v2.3 LOCKER
};
