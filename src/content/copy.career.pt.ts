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
import { CAREER_MEDIA_PT } from "./copy.career.media.pt"; // v2.3 MEDIA

/** v2.2 ENDLESS: as cidades-sede que uma temporada sorteia para os Majors e o Worlds (o save guarda os índices). */
/** v2.2 board front: a board objective's chance, in words (CAREER_BOARD.bands sets the cut points). */
const swingPt = (hit: string | number | undefined, miss: string | number | undefined): string => (hit === undefined ? "" : ` (+${hit} / −${Math.abs(Number(miss))} de confiança)`);
const BOARD_BANDS_PT: Record<string, string> = { expected: "Provável", reach: "Ao alcance", stretch: "Um desafio", longShot: "Muito difícil" };
// rc9 org (R222): a carta do dono numa mudança de patamar, pelo patamar a que a org chega: onde ela está, depois o que muda.
const OWNER_UP_PT: Record<string, string> = {
  mid: "A gente deixou de ser o time que todo mundo espera vencer. Jogadores melhores vão atender as nossas ligações, e a diretoria vai querer a gente brigando nos regionais em todo split.",
  contender: "Na cena, já contam a gente entre os candidatos. Jogadores que nos recusaram um ano atrás agora escutam, e a diretoria vai olhar para os Majors, não só para os regionais.",
  elite: "Viramos uma das orgs com quem o resto da cena se compara. Qualquer jogador escuta a gente agora, e a diretoria vai julgar a temporada pelos títulos.",
};
const OWNER_DOWN_PT: Record<string, string> = {
  contender: "Não estamos mais no topo. Alguns nomes que a gente persegue vão esperar uma proposta maior, e a diretoria vai cobrar Majors em vez de títulos.",
  mid: "Voltamos para o meio do bolo. Os melhores agentes livres vão olhar outras propostas primeiro, e a diretoria aliviou o que pede da gente.",
  underdog: "Voltamos a ser o time que ninguém teme. O mercado vai ficar mais difícil, e a diretoria sabe disso: desta vez ela pede menos.",
};

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
    return `Se cair abaixo do piso de novo, o banco soma ao empréstimo e o prazo continua o mesmo${left > 0 ? ` (no máximo mais ${left === 1 ? "uma vez" : `${left} vezes`})` : ""}.`;
  }
  const term = Number(p.term) > 0 ? `, para quitar em até ${p.term} semanas` : "";
  const last = Number(p.loansLeft) === 1 ? ": o último que ele abre nesta carreira" : "";
  return Number(p.nextPartner)
    ? `Abaixo do piso numa segunda-feira, o banco abre um empréstimo emergencial${term}${last}, e um investidor reforça um pouco a receita${partnerRunPt(p.partnerRun)}.`
    : `Abaixo do piso numa segunda-feira, o banco abre um empréstimo emergencial${term}${last}.`;
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
  "Nessa segunda o banco cobra o que você deve. Se pagar deixar as contas abaixo do piso, a carreira acaba.";

/**
 * rc.34 review: o que fecha a diferença até o prazo — dinheiro novo (uma
 * venda, um prêmio: cada um paga a sua parte e o resto fica no caixa) ou um
 * gasto menor. Um pagamento parcial em Finanças só move dinheiro do saldo
 * para a dívida; "Quitar tudo" encerra o empréstimo no dia em que as contas
 * aguentarem.
 */
const gapWaysPt = (p: Record<string, string | number | undefined>): string =>
  `Para fechar a diferença: venda um jogador (${p.salePct}% da taxa paga o empréstimo), ganhe premiação (${p.garnishPct}% de cada uma paga a dívida) ou reduza a folha.`;

/** rc.34 review: a projeção que os e-mails e avisos do prazo citam ("neste ritmo"). */
const onPacePt = (p: Record<string, string | number | undefined>): string =>
  Number(p.covered)
    ? `A ${p.net} por semana você terá ${p.projected} na segunda do prazo, o bastante para pagar.`
    : `A ${p.net} por semana você terá ${p.projected} na segunda do prazo, ${p.gap} a menos.`;

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

/**
 * rc9 TRAIN-MARKET: o que o banco faz na próxima quebra, numa oração só para as linhas do aviso
 * de dinheiro (os e-mails seguem com `nextBreachPt`). Integração do rc.9: as notificações dizem "piso", como o e-mail e Finanças.
 */
const noticeNextPt = (p: Record<string, string | number | undefined>): string => {
  if (p.next === "restructure") return "";
  if (p.next === "insolvent") {
    if (Number(p.owing) && Number(p.topUpsLeft) === 0) return "O banco não soma mais nada ao empréstimo, então a carreira acaba";
    if (!Number(p.owing) && Number(p.loansLeft) === 0) return "O banco não abre outro empréstimo emergencial, então a carreira acaba";
    return "A carreira acaba";
  }
  if (Number(p.owing)) {
    const left = Number(p.topUpsLeft);
    return `O banco soma ao empréstimo e o prazo continua o mesmo${left > 0 ? ` (no máximo mais ${left === 1 ? "uma vez" : `${left} vezes`})` : ""}`;
  }
  const term = Number(p.term) > 0 ? `, para quitar em até ${p.term} semanas` : "";
  return `O banco abre um empréstimo emergencial${term}${Number(p.loansLeft) === 1 ? ": o último desta carreira" : ""}`;
};

/** rc9 TRAIN-MARKET: como fechar a diferença até o prazo do empréstimo, numa linha. */
const noticeWaysPt = (p: Record<string, string | number | undefined>): string =>
  `Venda um jogador (${p.salePct}% da taxa vai para o empréstimo), ganhe premiações (${p.garnishPct}% de cada) ou reduza a folha`;

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
    board: "Diretoria", // rc9 ORG-UI
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
    quickStartHint: "Preenche todas as etapas ao acaso",
    identityTitle: "Identidade",
    orgName: "Nome da organização",
    orgNamePlaceholder: "ex.: Horizon Esports",
    orgNameTaken: "Esse nome pertence a uma org existente",
    orgNameLength: "2 a 18 caracteres",
    abbrev: "Tag",
    abbrevHint: "2-4 letras, aparece nas tabelas e no escudo",
    managerName: "Nome do manager",
    managerNamePlaceholder: "Seu nome",
    country: "País",
    crestTitle: "Escudo & cores",
    crestLabel: "Formato",
    crestSymbol: "Símbolo",
    crestPattern: "Padrão",
    crestNone: "Nenhum",
    randomizeCrest: "Aleatorizar",
    kits: "Kits",
    kitsHint: "Define as duas cores. Ajuste qualquer uma",
    primaryColor: "Cor primária",
    secondaryColor: "Detalhe",
    // rc.36 (UX-04, R88): layouts, a cor livre e o aviso de contraste.
    crestLayout: "Layout",
    crestLayouts: { emblem: "Emblema", monogram: "Letras", stacked: "Emblema + letras", band: "Faixa" },
    playstyleHelp: {"offense":"Ajuda o time a criar chances e finalizar ataques.","defense":"Reforça o posicionamento e a proteção do gol.","mechanics":"Melhora a execução técnica e o controle de bola.","consistency":"Ajuda os jogadores a manter o nível durante a série.","experience":"Traz mais calma e decisões melhores nas partidas.","clutch":"Ajuda o time a render nos momentos decisivos."},
    colorNames: {
      "black": "Preto", "graphite": "Grafite", "navy-light": "Marinho claro", "royal-light": "Azul royal claro", "scarlet-light": "Escarlate claro", "burgundy-light": "Bordô claro", "forest-light": "Verde-floresta claro", "teal-light": "Verde-azulado claro", "plum-light": "Ameixa claro", "orange-light": "Laranja claro", "gold-light": "Dourado claro", "olive-light": "Oliva claro",
      navy: "Marinho", gold: "Dourado", burgundy: "Bordô", ivory: "Marfim", royal: "Azul royal", silver: "Prata",
      forest: "Verde-floresta", cream: "Creme", scarlet: "Escarlate", sky: "Celeste", charcoal: "Grafite", amber: "Âmbar",
      petrol: "Petróleo", white: "Branco", plum: "Ameixa", steel: "Aço", wine: "Vinho", olive: "Oliva",
      indigo: "Índigo", "burnt-orange": "Laranja queimado", teal: "Verde-azulado", slate: "Ardósia",
    } as Record<string, string>,
    identityBuff: "Identidade da org",
    identityBuffHint: "A especialidade da sua org: uma pequena vantagem coletiva",
    regionTitle: "Região-sede",
    regionKicker: "Define seus rivais e as vagas de Worlds",
    regionSlots: (n: number) => `${n} vagas no Worlds`,
    regionRivals: "Rivais da RLCS X",
    regionNote: "Mudar de região é desbloqueado mais adiante na carreira",
    rosterTitle: "Primeiras contratações",
    rosterKicker: "Escolha seus três primeiros jogadores",
    rosterProspects: "Promessas",
    rosterProspectsDesc: "Jovens, alto potencial, precisam de tempo",
    rosterJourneymen: "Rodados",
    rosterJourneymenDesc: "Veteranos: fortes agora, pouca evolução",
    rosterBalanced: "Equilibrado",
    rosterBalancedDesc: "Uma mistura de veteranos e promessas",
    recommended: "Recomendado",
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
    finalKicker: "A escolha vale para a carreira inteira",
    // rc.32 (BAL-02): os presets da carreira substituem a etapa de Estilo de gestão.
    presets: {
      easy: { label: "Fácil", promise: "Para aprender o jogo" },
      normal: { label: "Normal", promise: "O equilíbrio pensado para o jogo" },
      hard: { label: "Difícil", promise: "Para managers experientes" },
    } as Record<"easy" | "normal" | "hard", { label: string; promise: string }>,
    // Os tópicos (wizard/PresetEffects.tsx), lidos ao vivo de balance.ts.
    presetMatches: {
      easier: "As partidas pendem a seu favor",
      even: "Partidas equilibradas",
      harder: "Adversários mais fortes",
    } as Record<"easier" | "even" | "harder", string>,
    // rc.34 review: a regra de dinheiro inteira do preset (economy.moneyRuleFor) — os empréstimos
    // emergenciais da carreira (null = sem limite), as semanas para quitar cada um, ou sem prazo.
    presetMoney: (r: { loans: number | null; deadlineWeeks: number | null }): string => {
      const head = r.loans === null ? "o banco empresta" : r.loans === 1 ? "você tem um empréstimo do banco" : `você tem até ${countWordPt(r.loans)} empréstimos do banco`;
      if (r.deadlineWeeks === null) return `Se o dinheiro acabar, ${head}. Sem prazo: prêmios e vendas pagam`;
      return `Se o dinheiro acabar, ${head}. Pague em até ${r.deadlineWeeks} ${r.deadlineWeeks === 1 ? "semana" : "semanas"} ou a carreira acaba`;
    },
    // CAREER_LOAN.breachesToEnd 1: a primeira segunda abaixo do piso encerra a carreira — sem empréstimo.
    presetMoneyNoLoan: "Se o dinheiro acabar, a carreira acaba",
    // rc.34 review: a delegação do treino com que o preset começa (difficulty.presetTrainingModeOf,
    // CAREER_PLAN.modeByPreset) e se as copas são inscritas por você (as prefs do preset).
    presetHelp: (mode: "auto" | "recommend" | "manual", autoCups: boolean): string =>
      `${{ auto: "O melhor plano de treino vem marcado para você", recommend: "O melhor plano vem marcado e você escolhe", manual: "Você planeja os treinos, sem dicas" }[mode]}. ${autoCups ? "A inscrição nas copas é automática" : "Você escolhe cada copa"}`,
    summaryTitle: "Resumo",
    found: (org: string) => `Fundar ${org}`,
    founded: "EST. 2020",
  },

  hub: {
    title: "QG",
    continue: "Continuar",
    continueTo: (label: string) => `Avançar: ${label}`,
    advanceDay: "Avançar um dia",
    nowDecision: "Decisão pendente",
    week: (n: number) => `Semana ${n}`,
    matchdayIn: (n: number) => (n === 0 ? "Dia de jogo" : n === 1 ? "Jogo amanhã" : `Jogo em ${n} dias`),
    seasonGoal: "Meta da temporada",
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
    news: "O plantão",
    newsAll: "Feed completo",
    inboxTeaser: "Caixa de entrada",
    inboxAll: "Abrir caixa de entrada",
    trainingWeek: "Semana de treino: o elenco ganha reps extras",
    emptyStateBody: "O primeiro evento já está no calendário",
    // v0.3 avanço automático estilo FIFA
    play: "Avançar",
    pause: "Pausar",
    playHint: (label: string) => `Avançando, a seguir: ${label}`,
    skipToNext: "Pular adiante",
    // v0.3 painel do plantão de transferências
    transfersTitle: "Janela de transferências",
    transfersAll: "Todas as regiões",
    transfersEmpty: "Nenhuma troca registrada ainda: o plantão enche conforme a janela corre.",
    transfersFa: "Agente livre",
    transfersUser: "Sua movimentação",
    transfersShowAll: (n: number) => `Ver todas as ${n} trocas`,
    // v2.0 hub rebuild (R26)
    today: "Hoje",
    dayOf: (d: number, total: number) => `Dia ${d} de ${total}`,
    nextStop: (label: string, s: string) => `Próxima parada: ${label} · ${s}`,
    inviteTitle: (name: string) => `Convite: ${name}`,
    inviteBody: (day: string) => `Copa comunitária em ${day}. Aceite para jogar, ou passe e siga treinando.`,
    inviteAccept: "Aceitar convite",
    invitePass: "Passar",
    // RTW-05 (rc.33): elenco com menos de três — o relógio espera o terceiro jogador.
    squadShortKicker: "Elenco incompleto",
    squadShortTitle: "Contrate um jogador",
    squadShortBody: (n: number, event: string) =>
      `Só ${n} de 3 vagas preenchidas antes de ${event}. Um agente livre pode entrar hoje, com ou sem janela.`,
    // rc.39 F6 (R103): titular indisponível e sem reserva — a mesma pausa, com o texto certo.
    squadShortAbsentTitle: "Sem substituto",
    absenceReasons: { fatigue: "excesso de carga de treino", illness: "problemas de saúde", fitness: "falta de condições físicas", media: "um dia de mídia" }, // v2.3 MEDIA
    squadShortAbsentBody: (player: string, event: string, reason?: string) =>
      `${player} está fora de ${event} (${reason ?? "falta de condições físicas"}) e não há reserva. Contrate um numa janela de transferências ou fique fora deste evento.`,
    squadShortAbsentSkip: "Ficar fora deste evento",
    squadShortAbsentSkipHint: (event: string) => `${event}: sem inscrição, sem pontos, sem prêmio.`,
    squadShortMarket: "Ir ao Mercado",
    squadShortSquad: "Elenco",
    contractsExpiring: (n: number) => (n === 1 ? "1 contrato termina nesta temporada" : `${n} contratos terminam nesta temporada`),
    cashWarningCard: (weeks: number) => `O caixa dura cerca de ${weeks} semanas com os gastos atuais`,
    // ECO-02 (R46): o card cita a dívida que Finanças mostra.
    // rc.34: o empréstimo emergencial do banco e o prazo dele.
    backerOpen: (owed: string) => `Empréstimo emergencial: ${owed} em aberto`,
    loanDue: (date: string, weeks: number) =>
      weeks <= 0
        ? `Vence nesta segunda (${date}).`
        : weeks === 1
          ? `Vence na próxima segunda, ${date}.`
          : `Vence em ${date} (${weeks} semanas).`,
    // rc.32 (M4): a linha do QG abaixo dele — o que significa a próxima quebra (rc.34: nextBreachParamsOf do fluxo).
    backerNextBreach: (p: Record<string, string | number>) => nextBreachPt(p),
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
    trainingToday: "Sessão hoje",
    trainingRest: "Dia de descanso",
    trainingMatch: "Preparação de jogo",
    financesTitle: "Finanças",
    financesOpen: "Abrir finanças",
    // rc.34 (UX-01a, HQ-CONTRACT H1): uma decisão por vez; o "Depois" da 1-B para propostas e patrocínios.
    decisionCount: (i: number, n: number) => `${i} de ${n}`,
    later: "Depois",
    alsoDue: "Também",
    parked: "Para depois",
    dueBy: (date: string) => `até ${date}`,
    dueToday: "último dia",
    lastDay: "Último dia para responder. O relógio espera.",
    standsUntil: (date: string) => `Vale até ${date}`,
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
      post: "Post para a torcida", // rc9 STORIES
    },
    noticeTitle: "Um aviso precisa de você",
    // rc.36 (front S2, Miguel sobre a rc.35): a escolha do patrocínio é um pop-up; o bloco só a chama.
    sponsorSeeOffers: "Ver as ofertas",
    // rc.34 (Miguel, 31/10): um elenco incompleto pode ficar fora de uma regional.
    squadShortSkip: "Pular esta regional",
    squadShortSkipHint: (event: string) => `${event}: sem inscrição, sem pontos, sem prêmio.`,
    // rc.34 (UX-01b, HQ-CONTRACT H2): o elenco em cartas do Draft.
    cardStarter: "Titular",
    cardReserve: "Reserva",
    cardEmptySeat: "Vaga aberta",
    cardSignHint: "Contrate um jogador",
    cardUntil: (season: string) => `Até ${season}`,
    cardEndsIn: (weeks: number) => (weeks <= 0 ? "Sai na virada" : weeks === 1 ? "Termina em 1 semana" : `Termina em ${weeks} semanas`),
    cardFinalSeason: "Última temporada",
    // rc.35 (front C): o chip de treino do técnico.
    coachTrainingPct: (pct: number) => `${pct > 0 ? "+" : ""}${pct}% de treino`,
    // rc.34 (UX-01d, decisão 6-A): a pergunta da semana sobre a vaga.
    nextRegional: (ordinal: number, week: number) => `Próxima regional (R${ordinal}, semana ${week})`,
    // rc.34 (UX-01e, HQ-CONTRACT H5): o dinheiro, só o lançado ou comprometido.
    financePerWeek: (amount: string) => `${amount} por semana`,
    financePayroll: "Próxima folha",
    financeRunway: "Fôlego",
    // rc.36 (POL-02): o valor da linha de fôlego.
    financeRunwayWeeks: (weeks: number) => (weeks === 1 ? "1 semana de caixa" : `${weeks} semanas de caixa`),
    financeOverdraft: (floor: string) => `Usando crédito. Abaixo de ${floor} numa segunda, o banco empresta.`,
    financeRunwayOk: "No azul",
    // rc.34 review: o empréstimo emergencial (o "Backer" do rc.31–rc.33 saiu do produto).
    financeDebtBacker: (owed: string) => `Empréstimo emergencial ${owed}`,
    // rc9 HQ (#244): as estatísticas dos jogadores na temporada, no QG.
    statsAll: "Todas as estatísticas",
    statsBest: "Melhor nota",
    statsEmptyHint: "Os box scores do seu primeiro evento preenchem isto.",
  },

  // Caixa de entrada v0.2 — correio endereçado ao manager.
  mail: {
    greeting: "Olá,",
    signoff: "Atenciosamente,",
    title: "Caixa de entrada",
    unread: (n: number) => `${n} não lidas`,
    unreadLabel: "Não lidas",
    needsReply: "Aguarda resposta",
    back: "Caixa de entrada",
    markAllRead: "Marcar tudo como lido",
    empty: "Nenhum e-mail",
    emptyHint: "Propostas de transferência, patrocínios e avisos de contrato chegam aqui",
    open: "Abrir",
    from: {
      bank: "Banco Northline",
      accountant: "Contador da org",
      board: "A Diretoria",
      owner: "O Dono",
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
      blockbusterBid: (p: Record<string, string | number>) => `Proposta bomba: ${p.org} querem ${p.player}`,
      sponsorOffers: () => `Propostas de patrocínio à espera`,
      objectiveHit: (p: Record<string, string | number>) => `${p.name}: meta batida`,
      objectiveMissed: (p: Record<string, string | number>) => `${p.name}: meta perdida`,
      contractExpiring: (p: Record<string, string | number>) => `${p.player}: contrato na última temporada`,
      // rc.34 (UX-06b): os lembretes antes de um jogador poder sair.
      contractReminder: (p: Record<string, string | number>) => `Contratos: ${p.weeks} semanas para ${p.players}`,
      bankLoan: (p: Record<string, string | number>) => `Empréstimo aprovado: ${p.amount}`,
      // rc.37 F2: a oferta do banco antes do piso, e a proposta da venda de emergência.
      creditOffer: (p: Record<string, string | number>) => `O banco oferece um empréstimo de ${p.loanNet}`,
      emergencyBid: (p: Record<string, string | number>) => `Proposta de emergência por ${p.player}`,
      bankCleared: () => `Empréstimo bancário quitado`,
      cashWarning: (p: Record<string, string | number>) => `O caixa dura mais ${p.weeks} semanas`,
      qualifiedRegional: (p: Record<string, string | number>) => `Passou na qualificatória: o ${p.event} está marcado`,
      missedRegional: (p: Record<string, string | number>) => `Fora na qualificatória: o ${p.event} acontece sem você`,
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
      unavailable: (p: Record<string, string | number>) => `${p.player} fora do ${p.event}`,
      noReserve: () => `Elenco sem reserva`,
      debtCleared: () => `Empréstimo emergencial quitado`,
      // DEV-02 (R48): o aposentado do próprio elenco — para onde ele foi.
      retiredToCoach: (p: Record<string, string | number>) => `${p.player} se aposenta e vira treinador`,
      retiredLeaves: (p: Record<string, string | number>) => `${p.player} se aposenta das competições`,
      // v2.1 M1 (R139): o treinador do usuário envelhece e se aposenta.
      coachRetireAnnounce: (p: Record<string, string | number>) => `${p.coach} anuncia sua última temporada`,
      coachRetired: (p: Record<string, string | number>) => `${p.coach} se aposenta como treinador`,
      // rc.32 (ECONOMY-CONTRACT M3 / M4 / M8, provisório).
      foundingPartner: () => `Um parceiro fundador apoia a org`,
      foundingPartnerEnds: () => `O parceiro fundador se despede`,
      cashNotice: (p: Record<string, string | number>) => `O caixa dura mais ${p.weeks} semanas`,
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
        `${p.org} propõem ${p.fee} por ${p.player}. Responda em Mercado, Negociações, antes de a janela fechar.`,
      listingNoBuyer: (p: Record<string, string | number>) =>
        `Nenhuma org da região dele respondeu à sua listagem de ${p.player} por ${p.ask}. Retire-o ou liste de novo na próxima janela.`,
      listingTooDear: (p: Record<string, string | number>) =>
        `O mercado ignorou ${p.player} a ${p.ask}. Baixe o preço em Mercado, Negociações, ou retire-o.`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} pagam ${p.fee} por ${p.player}, o preço que você pediu. Responda em Mercado, Negociações, antes de a janela fechar.`,
      listingCounter: (p: Record<string, string | number>) =>
        `${p.org} oferecem ${p.fee} por ${p.player}, abaixo dos ${p.ask} pedidos. Responda em Mercado, Negociações, antes de a janela fechar.`,
      tradeRefusedFit: (p: Record<string, string | number>) =>
        `${p.org} não trocam ${p.take} por ${p.give}: enfraqueceria demais o elenco deles. A proposta foi encerrada.`,
      tradeRefusedValue: (p: Record<string, string | number>) =>
        `${p.org} avaliam ${p.take} bem acima de ${p.give}, e o dinheiro oferecido não fecha a diferença. A proposta foi encerrada.`,
      tradeAgreed: (p: Record<string, string | number>) =>
        `${p.org} aceitam enviar ${p.take} por ${p.give}, com ${p.cash} em dinheiro da sua parte. Responda em Mercado, Negociações, antes de a janela fechar.`,
      tradeCountered: (p: Record<string, string | number>) =>
        `${p.org} enviam ${p.take} por ${p.give} se você somar ${p.cash} em dinheiro. Responda em Mercado, Negociações, antes de a janela fechar.`,
      // rc.32 (Miguel, 30/10): o que é uma proposta Bomba, por que veio, o preço e o custo de recusar.
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} oferecem ${p.fee} por ${p.player}, ${p.mult === undefined ? "bem acima do" : `${Math.round((Number(p.mult) - 1) * 100)}% acima do`} valor de mercado dele. Se você recusar ou deixar expirar, ele fica, e a próxima pedida de renovação ${p.pct === undefined ? "pode subir" : `sobe ${p.pct}%`}.`,
      foundingPartner: (p: Record<string, string | number>) =>
        `Um parceiro local paga ${p.base} por split, toda segunda, para você disputar eventos. Ele fica até o seu primeiro contrato de patrocínio, e pelo menos até o fim de ${p.through}.`,
      foundingPartnerEnds: () =>
        `O ciclo do parceiro fundador acabou. A receita agora vem de patrocínios e premiação.`,
      cashNotice: (p: Record<string, string | number>) =>
        `Com ${p.burn} de gasto por semana, o caixa dura mais ${p.weeks} semanas, e as contas ficam abaixo do piso (${p.floor}) n${breachWhenPt(p)}. ${nextBreachPt(p)} Saídas: aceitar uma proposta por um jogador, ganhar premiação, segurar as próximas renovações${Number(p.backer) ? "" : " ou pegar um empréstimo no banco"}.`,
      // Histórico do rc.32 (ECO-08 / ECO-12): nada os envia desde o rc.33 — ficam para a caixa de um save antigo.
      restructured: () => `O Investidor reestruturou a org (save antigo).`,
      sponsorOffers: () =>
        `Marcas querem patrocinar a org. Veja as propostas em Finanças: a base é garantida e o bônus depende da meta.`,
      objectiveHit: (p: Record<string, string | number>) =>
        `Meta do patrocinador batida. O bônus de ${p.bonus} entra no próximo pagamento.`,
      objectiveMissed: (p: Record<string, string | number>) =>
        `Meta do patrocinador perdida. Falhas repetidas pioram a próxima proposta. Falhas até aqui: ${p.misses}.`,
      // rc.34 (ECO-04): os e-mails dos contratos.
      // rc.36 (front S2): duas ou três marcas (o acesso da escada), com preço pelo risco (rc.35), e a regra do prazo.
      sponsorDecision: (p: Record<string, string | number>) =>
        `Marcas oferecem à org um contrato ${Number(p.n) === 2 ? "Estável ou Equilibrado" : "Estável, Equilibrado ou Ousado"} (nível ${p.tier}). Contratos mais ousados pagam mais, com metas mais difíceis e multas maiores. Assine um até o domingo da semana ${p.byWeek}${Number(p.auto) ? "; depois disso o mais seguro é assinado por você" : "; nesse dia o relógio espera a sua escolha"}.${Number(p.demoted) ? " Três metas escaparam no último contrato Estável, então esta rodada vem um nível abaixo." : ""}`,
      sponsorLapsed: () =>
        `Ninguém assinou antes do prazo e as marcas seguiram em frente. Novas propostas chegam no próximo split.`,
      sponsorAutoSigned: (p: Record<string, string | number>) =>
        `Nenhum contrato foi escolhido até o prazo, então a org assinou o mais seguro: ${p.name}. Os termos estão em Finanças.`,
      sponsorGoalHit: (p: Record<string, string | number>) =>
        `${goalOfParamsPt(p)}: feito. O bônus de ${p.bonus} entra hoje${positive(p.milestone) ? `, com o pagamento do marco de ${p.milestone}` : ""}.`,
      sponsorGoalMissed: (p: Record<string, string | number>) =>
        `${goalOfParamsPt(p)}: ${p.done} de ${p.target}. ${
          positive(p.fine)
            ? `A multa é de ${p.fine}, em parcelas de ${p.perMonday} nas próximas ${p.mondays} segundas.`
            : Number(p.steady)
              ? `Contrato Estável não tem multa. Depois de ${p.patience} metas perdidas as próximas propostas pioram (${p.misses} até aqui).`
              : "Sem multa."
        }`,
      sponsorGoalSet: (p: Record<string, string | number>) =>
        `Nova meta: ${goalOfParamsPt(p)} (${SPONSOR_WORD_PT[String(p.word)] ?? p.word}). Paga ${p.bonus}${positive(p.fine) ? `; perder custa até ${p.fine}` : ""}.`,
      sponsorEnded: (p: Record<string, string | number>) =>
        `O contrato acabou: ${p.hits} de ${p.goals} metas batidas. Novas propostas estão na sua mesa.${Number(p.demoted) ? " Depois de três metas perdidas num contrato Estável, elas vêm num nível menor." : ""}`,
      foundingHandover: (p: Record<string, string | number>) =>
        `O parceiro reduz o apoio: ${p.first}% do valor até ${stepWhenPt(p.stepWeek, p.stepNextSeason)}, ${p.second}% até ${stepWhenPt(p.endWeek, p.endNextSeason)}, e então encerra.`,
      contractExpiring: (p: Record<string, string | number>) =>
        `${p.player} está na última temporada de contrato. Você pode renovar até o fim do Split 3; depois disso, ele sai de graça.`,
      contractReminder: (p: Record<string, string | number>) =>
        `${p.players}: sem contrato depois desta temporada, faltam ${p.weeks} semanas. Renove em Elenco ou eles saem como agentes livres.`,
      bankLoan: (p: Record<string, string | number>) =>
        `O banco depositou ${p.amount}. Parcelas de ${p.weekly} saem toda segunda até quitar ${p.total}.`,
      // rc.37 F2 (pacote 2): o empréstimo comum do banco, oferecido na segunda em que o fôlego chega ao nível de alerta.
      creditOffer: (p: Record<string, string | number>) =>
        `${Number(p.weeks) > 0 ? `Com ${p.burn} de gasto por semana, o caixa dura mais ${p.weeks} semanas` : `O saldo está em ${p.balance}, com ${p.burn} de gasto por semana`}, e as contas ficam abaixo do piso (${p.floor}) n${breachWhenPt(p)}. O banco oferece ${p.loanNet} agora, pagos em ${p.loanWeekly} por semana durante ${p.loanTerm} semanas (${p.loanTotal} no total, ${p.loanPct}% de juros). O empréstimo emergencial custa ${p.emergencyPct}%${Number(p.emergencyTerm) > 0 ? `, a quitar em até ${p.emergencyTerm} semanas` : ""}. Em Finanças você escolhe outro valor.`,
      // rc.37 F2 (pacote 3): uma proposta de venda de emergência — abaixo do valor de mercado, com o caixa no vermelho.
      emergencyBid: (p: Record<string, string | number>) =>
        `${p.org} oferecem ${p.fee} por ${p.player}, ${p.pct}% do valor de mercado dele, com as contas no vermelho (${p.balance}). A oferta vale por ${p.days} dias ou até a janela fechar, e aceitar vende o jogador na hora. Detalhes em Mercado, Negociações.`,
      bankCleared: () =>
        `Última parcela paga. O banco volta a emprestar se você precisar.`,
      // rc.32 (M4, provisório): toda segunda com ≤ 4 semanas — a quebra projetada e a saída.
      cashWarning: (p: Record<string, string | number>) =>
        p.breachWeek === undefined
          ? `A ${p.net} por semana, o caixa dura mais ${p.weeks} semanas. Corte salários, ganhe premiação ou pegue um empréstimo antes de romper o piso.`
          : `Com ${p.burn} de gasto por semana, o caixa dura mais ${p.weeks} semanas, e as contas ficam abaixo do piso (${p.floor}) n${breachWhenPt(p)}. ${nextBreachPt(p)} Saídas: aceitar uma proposta por um jogador, ganhar premiação, enxugar a folha na renovação${Number(p.backer) ? "" : " ou pegar um empréstimo no banco"}.`,
      qualifiedRegional: (p: Record<string, string | number>) =>
        `A org terminou o Swiss de sábado entre os oito que avançam. O ${p.event} é no domingo.`,
      missedRegional: (p: Record<string, string | number>) =>
        `Três derrotas no Swiss de sábado: a org está fora do ${p.event}, no domingo. Uma nova semana de treino começa na segunda.`,
      // HISTÓRICO (rc.32–rc.33): o e-mail de resgate do Investidor, como saiu (o rc.34 envia emergencyLoan).
      backerIn: () => `Aporte de emergência acertado (save antigo).`,
      // rc.34 (Miguel, 31/10): o empréstimo emergencial do banco — por quê, quanto, como se paga,
      // até quando, o investidor se veio junto, e o que encerra a carreira.
      emergencyLoan: (p: Record<string, string | number>) =>
        `O saldo caiu abaixo do piso (${p.floor}), então o banco emprestou ${p.lent}. Você deve ${p.owed}, juros incluídos${p.dlWeek !== undefined ? `, com prazo para ${mondayWhenPt(p.dlWeek, p.dlAhead)}` : ""}. Premiações (${p.garnishPct}%) e vendas (${p.salePct}%) abatem a dívida sozinhas.${positive(p.partnerWeekly) ? ` O investidor ${p.partnerName} soma ${p.partnerWeekly} por semana durante ${p.partnerWeeks} semanas.` : ""}${Number(p.lock) ? " Enquanto houver dívida, taxas de transferência, equipamentos e novos compromissos ficam suspensos." : ""} ${nextBreachPt(p)} Termos completos em Finanças.`,
      emergencyTopUp: (p: Record<string, string | number>) =>
        `O saldo caiu abaixo do piso de novo, então o banco emprestou mais ${p.lent}. A dívida agora é de ${p.owed}${p.dlWeek !== undefined ? `, e o prazo não muda: ${mondayWhenPt(p.dlWeek, p.dlAhead)}` : ""}. ${nextBreachPt(p)}`,
      // rc.34 review: as contas projetadas até o prazo (um e-mail antigo sem a projeção lê o saldo de hoje).
      loanDeadline: (p: Record<string, string | number>) =>
        `${Number(p.weeksLeft) === 1 ? "Falta uma semana" : `Faltam ${p.weeksLeft} semanas`} para o prazo do empréstimo emergencial, ${mondayWhenPt(p.dlWeek, p.dlAhead)}. Você deve ${p.owed} e o saldo está em ${p.balance}. ${p.projected === undefined ? (Number(p.covered) ? "O saldo cobre a dívida." : "O saldo não cobre a dívida.") : onPacePt(p)}${Number(p.covered) ? "" : ` ${gapWaysPt(p)}`}`,
      loanCollected: (p: Record<string, string | number>) =>
        `O empréstimo emergencial venceu e o banco cobrou ${p.collected}. O saldo está em ${p.balance}. ${p.next === undefined ? "Cair abaixo do piso de novo abre outro empréstimo." : nextBreachPt(p)}`,
      loanSlipped: (p: Record<string, string | number>) =>
        `${Number(p.weeksLeft) === 1 ? "A uma semana" : `A ${p.weeksLeft} semanas`} do prazo, ${mondayWhenPt(p.dlWeek, p.dlAhead)}, as contas deixaram de cobrir os ${p.owed} devidos: a ${p.net} por semana o saldo estaria em ${p.projected} nessa segunda, ${p.gap} abaixo do necessário. ${gapWaysPt(p)}`,
      loanTakenOver: () => `O banco assumiu a dívida do Investidor (save antigo).`,
      unlock: (p: Record<string, string | number>) =>
        `${p.name} já está disponível.`,
      windowReport: (p: Record<string, string | number>) =>
        `${p.n} trocas em todas as regiões. Taxas de destaque: ${p.p1} (${p.f1})${p.p2 ? ` · ${p.p2} (${p.f2})` : ""}${p.p3 ? ` · ${p.p3} (${p.f3})` : ""}.`,
      unavailable: (p: Record<string, string | number>) =>
        `${p.player} não joga o ${p.event}. O reserva assume a vaga com a química dele.`,
      unavailableNoReserve: (p: Record<string, string | number>) =>
        `${p.player} está fora do ${p.event} e não há reserva. Reserva só assina na janela de transferências: sem uma aberta antes do evento, o time não joga.`,
      noReserve: () =>
        `Um titular pode ficar fora de um evento oficial. Um reserva entra no lugar; sem ele, o time não joga. Reserva só assina na janela de transferências.`,
      // rc.34 review: com o que a próxima quebra faz (o último empréstimo da carreira quitado: o fim) — um e-mail antigo lê como saiu.
      debtCleared: (p: Record<string, string | number> = {}) =>
        `O empréstimo emergencial está quitado e o prazo deixou de existir. ${p.next === undefined ? "O banco volta a emprestar se você precisar." : nextBreachPt(p)}`,
      retiredToCoach: (p: Record<string, string | number>) =>
        `${p.player} se aposenta e passa a treinar. Ele está no grupo de treinadores.`,
      retiredLeaves: (p: Record<string, string | number>) =>
        `${p.player} se aposenta. A vaga dele está aberta.`,
      coachRetireAnnounce: (p: Record<string, string | number>) =>
        `${p.coach} se aposenta no fim desta temporada. Contrate um sucessor antes do primeiro evento da próxima.`,
      coachRetired: (p: Record<string, string | number>) =>
        `${p.coach} se aposenta. O banco está vazio: contrate um treinador no mercado antes do primeiro evento.`,
      // v2.0 (C1)
      sponsorBootcamp: (p: Record<string, string | number>) =>
        `O patrocinador paga o bootcamp deste split. Ele já começou e a vantagem vale até o fim do split. ${
          Number(p.left) > 0
            ? `Restam ${p.left} nesta temporada.`
            : `Essa é a cota desta temporada (${p.perSeason}).`
        }`,
      coachContractExpiring: (p: Record<string, string | number>) =>
        `O contrato de ${p.coach} termina nesta temporada. Ele pede ${p.wage} por semana (hoje ${p.old}). Renove na página de Treinadores ou ele sai na virada, sem multa.`,
      coachRenewed: (p: Record<string, string | number>) =>
        Number(p.raised)
          ? `${p.coach} assinou por mais ${p.seasons} temporadas a ${p.wage} por semana, antes ${p.old}.`
          : `${p.coach} assinou por mais ${p.seasons} temporadas a ${p.wage} por semana.`,
      coachLeft: (p: Record<string, string | number>) =>
        `O contrato de ${p.coach} acabou sem renovação. Não há multa. O elenco treina sem treinador até você contratar outro.`,
    },
  },

  // Scrims v0.2 — blocos de dia útil entre eventos. v0.3: agendáveis, escolha
  // de adversário, resultados visíveis.
  // rc9 MATCHDAY (auditoria de texto): as chaves da antiga tela de agendamento saíram.
  scrim: {
    live: "Scrim ao vivo",
    title: "Scrim",
    vs: (opp: string) => `contra ${opp}`,
    won: (opp: string, a: number, b: number) => `Vitória por ${a}-${b} contra ${opp}`,
    lost: (opp: string, a: number, b: number) => `Derrota por ${a}-${b} contra ${opp}`,
    cancel: "Cancelar",
    noResults: "Nenhuma scrim nesta temporada ainda.",
    gameLine: (scores: string) => `Jogos: ${scores}`,
  },

  calendar: {
    previousMonth: "Mês anterior",
    nextMonth: "Próximo mês",
    title: "Calendário",
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
    done: "Encerrado",
    stakes: "Em jogo",
    prizePool: "Premiação",
    points: "Pontos da Temporada",
    field: "Chave",
    fieldQuality: "Nível do campo",
    enter: "Entrar",
    skip: "Passar",
    skipHint: "Passe para treinar nessa semana (+25%).",
    offerTitle: "Convite de torneio",
    // Visão por dia (v0.2)
    nextForYou: "Próximos para você",
    later: "Depois disso", // rc9 HQ
    matchday: "Dia de jogo",
    payday: "Pagamento",
    trainingDay: "Treino",
    restDay: "Descanso",
    scrimDay: "Scrim",
    legend: "Legenda",
    advanceDay: "Avançar um dia",
    advanceToStop: (label: string) => `Continuar: ${label}`,
    seasonEnd: "Fim da temporada",
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
    // rc9 DS: os contratos e a linha de estabilidade do Elenco, refeitos.
    colPlayer: "Jogador",
    colEnds: "Contrato",
    colWage: "Salário",
    colMood: "Humor",
    contractsEnding: (n: number) =>
      n === 1 ? "1 termina nesta temporada" : `${n} terminam nesta temporada`,
    contractsSettled: "Nenhum termina nesta temporada",
    stabilityLine: (used: number, max: number) => `Estabilidade do elenco: ${used} de ${max} caras novas neste split`,
    openMood: (name: string) => `Por que ${name} está assim`,
    roleStarter: "Titular",
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
    phase: { growing: "Em evolução", prime: "No auge", declining: "Em declínio", unknown: "Sem relatório" },
    phaseUnknownHint: "Um relatório de scout mostra se ele está em evolução, no auge ou em declínio",
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
      offense: "Pressão e chances de gol em cada jogo",
      defense: "Segura o adversário em cada jogo",
      mechanics: "A chance de uma jogada grande que decide o jogo",
      consistency: "Ameniza um jogo ruim, sem eliminá-lo",
      experience: "Controle quando o time chega aos playoffs",
      clutch: "Rating no jogo decisivo da série",
    } as Record<string, string>,
    weekScrims: "Scrims da semana",
    weekScrimsEmpty: "Nenhuma scrim registrada nesta semana ainda.",
    title: "Treinos",
    // rc9 TRAIN-MARKET: títulos e estados da própria tela.
    coachTitle: "Coach",
    noCoachTitle: "Sem coach",
    growthEmpty: "Ainda não há jogadores no elenco",
    effectsOpen: "Mostrar",
    effectsClose: "Ocultar",
    facilityEffect: (pct: number) => `Equipamentos: +${pct}% no treino`,
    matchXpHint: "Jogar contra campos fortes desenvolve mais que treinar",
    perWeekOverall: (v: string) => `+${v} OVR por semana`,
    sessionToday: "Hoje",
    noSessionToday: "Hoje não",
    // rc.34 (DEV-03 §4b): o motor treina a semana comprometida com meia carga (matchPrepShare).
    matchPrepWeek: "Semana de jogo: meia carga, e o evento dá XP de partida",
    drills: {
      "mechanics-lab": "Laboratório de mecânica",
      rotations: "Rotações",
      "set-plays": "Jogadas ensaiadas",
      "film-room": "Sala de vídeo",
      "clutch-sets": "Séries de clutch",
    } as Record<string, string>,
    growth: "Evolução",
    nextPoint: (ovr: number) => `Próximo: ${ovr} OVR`,
    etaDays: (days: number) => (days === 1 ? "cerca de 1 dia de treino" : `cerca de ${days} dias de treino`),
    etaNone: "Parado: no teto do período ou no potencial",
    etaAtPotential: "No potencial",
    etaAtPeak: "No auge, segurando esse nível",
    declineLine: (perWeek: string) => `Passou do auge: cerca de −${perWeek} OVR por semana`,
    effectsTitle: "O que seus atributos fazem",
    effectBaseline: (n: number) => `Abaixo de ${n}, o atributo atrapalha o time. O overall pesa mais`,
    effectWhen: {
      always: "todo jogo",
      deciding: "jogos decisivos",
      playoffs: "jogos de playoff",
      badRolls: "ameniza jogos ruins",
      proc: "chance de uma jogada grande",
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
      controllerCoach: (name: string) => `${name} planeja e inicia cada ciclo. Você pode ajustar`,
      // rc.36 (front T2): um coach contratado que não planeja mais — ele só recomenda.
      controllerCoachOff: (name: string) => `Você inicia cada ciclo. O plano de ${name} vem marcado como Recomendado`,
      controller: {
        auto: "O melhor plano vem marcado como Recomendado",
        recommend: "A melhor opção de cada etapa vem marcada como Recomendada",
        manual: "Você escolhe tudo",
      } as Record<string, string>,
      steps: { objective: "Objetivo", focus: "Foco", intensity: "Intensidade", scrims: "Scrims" } as Record<string, string>,
      // rc.36 (front T2, Miguel): Evoluir / Entrosar / Recuperar.
      objectives: { development: "Evoluir", preparation: "Entrosar", recovery: "Recuperar" } as Record<string, string>,
      objectiveEffect: {
        development: "Evolução mais rápida rumo ao auge de cada jogador",
        preparation: "Os scrims entrosam o elenco mais rápido, com um pouco de evolução",
        recovery: "Menos desgaste. Veteranos seguram o nível por mais tempo",
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
      focusBalanced: "Só evolução geral",
      focusEffect: (stats: string, perWeek: string) => `+${perWeek} de ${stats} por semana para todos`,
      focusHint: "O atributo que todos afiam, sem custo na evolução geral",
      intensities: { light: "Leve", normal: "Normal", heavy: "Pesada" } as Record<string, string>,
      intensityEffect: {
        light: "Evolução mais lenta, menos desgaste",
        normal: "Evolução padrão, sem risco extra",
        heavy: "Evolução mais rápida, com pequena chance de um titular faltar a um evento",
      } as Record<string, string>,
      scrimChoices: { off: "Nenhum", easy: "Fácil", even: "Parelho", hard: "Difícil" } as Record<string, string>,
      scrimEffect: {
        off: "Sem scrims, sem desgaste de scrim",
        easy: "Dá confiança, pouco desgaste",
        even: "O maior entrosamento",
        hard: "O maior aprendizado, com pequena chance de um titular faltar a um evento",
      } as Record<string, string>,
      // rc.36 (front T2): nada roda até um plano ser escolhido e iniciado.
      pickTitle: "Escolha o plano deste ciclo",
      idle: "Nenhum plano rodando",
      idleLine: "Todos evoluem no ritmo base. Um plano acelera",
      // rc9 TRAIN-MARKET: nada a planejar enquanto a temporada não está rodando.
      paused: "O treino roda durante a temporada. Volte quando ela começar",
      choosePlan: "Escolher um plano",
      start: "Iniciar treino",
      applyChanges: "Aplicar mudanças",
      pickAll: "Escolha uma opção em cada etapa",
      useRecommended: "Usar o plano recomendado",
      runsTo: (date: string, days: number) => `Vai até ${date} · ${days === 1 ? "1 dia" : `${days} dias`}`,
      fromTomorrow: "O treino de hoje já rolou: começa amanhã",
      startsTomorrow: "Começa amanhã",
      promisedUnit: "OVR até o fim",
      gainOf: (total: string) => `de +${total} OVR`,
      promiseTitle: "Ganho do ciclo",
      onCompletion: (v: string) => `+${v} chegam quando o ciclo terminar`,
      legend: { paid: "Conquistado", toCome: "A caminho", completion: "Na conclusão" } as Record<string, string>,
      adjustHint: "Mudar o plano mantém o que você já conquistou",
      facts: { session: "Sessão", risk: "Risco" },
      coachPlans: (name: string) => `${name} planeja cada ciclo`,
      coachPlansHint: "Desligado: você inicia cada ciclo, e o plano dele vem marcado como Recomendado",
      riskLine: (pts: string) => `+${pts}% de chance de um titular faltar a um evento`,
      scrimsAWeek: (n: number) => `${n} por semana, só treino`,
      recommended: "Recomendado",
      expectedGain: (v: string) => `+${v} OVR`,
      risk: (pts: string) => `+${pts}% de chance de um titular faltar a um evento`,
      noRisk: "Sem risco extra de desfalque",
      adjust: "Ajustar plano",
      useBase: "Usar a base",
      cancel: "Cancelar",
      scrimsDone: (done: number, planned: number) => `${done} de ${planned} scrims`,
      record: (w: number, l: number) => `${w}–${l}`,
      lastCycle: "Último ciclo",
      noCoach: "O treino rende pela metade",
      hireCoach: "Contratar coach",
      coachBoost: (pct: number) => `+${pct}% do seu coach`,
      scrims: "Scrims",
      chemistry: "Entrosamento",
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
        dontShowAgain: "Parar de mostrar este relatório",
        showAutomatic: "Mostrar relatórios de ciclo",
        coachNext: (name: string) => `${name} já iniciou o próximo ciclo`,
        joined: "Entrou no meio do ciclo",
        players: "Jogador por jogador",
      },
      coach: {
        quality: "Qualidade",
        experience: "Experiência",
        specialty: "Especialidade",
        qualityEffect: (pct: number) => `Os planos chegam a ${pct}% do efeito total`,
        experienceEffect: (seasons: number) => (seasons === 1 ? "1 temporada" : `${seasons} temporadas`),
        experienceHint: (pct: number, wear: number) => `Sozinho, o plano dele chega a ${pct}%${wear > 0 ? ` · ${wear}% menos desgaste` : ""}`,
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
      base: "Crescimento base",
      rest: "Descanso",
      proposalTitle: (name: string) => `O plano de ${name} para este período`,
      approve: "Aprovar",
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
    scoutingOpen: "A observação segue aberta entre janelas",
    // RTW-05 (rc.33): um elenco com menos de três contrata um agente livre para a vaga vazia, com ou sem janela.
    emptySeatOpen: "Seu elenco tem menos de três: um agente livre pode ocupar a vaga vazia hoje",
    emptySeatCheapest: (name: string, wage: string) =>
      `Sem dinheiro? ${name} (${wage} / semana) é o agente livre mais barato para a vaga`,
    // rc9 TRAIN-MARKET: os títulos do quadro de candidatos e o que um candidato muda no time.
    feeLine: (fee: string) => `Taxa ${fee}`,
    teamUp: (n: number, name: string) => `+${n} sobre ${name}`,
    teamSub: "Entra como reserva",
    teamSeat: "Ocupa a vaga vazia",
    clearFilters: "Limpar filtros",
    noResultsEmpty: "Volte quando a próxima janela abrir",
    cons: { balance: "Saldo depois", wages: "Salários por semana", runway: "O caixa dura" },
    wageBillTo: (now: string, after: string) => `${now} para ${after}`,
    runwayValue: (weeks: number | null) => (weeks === null ? "Segue no azul" : weeks === 1 ? "1 semana" : `${weeks} semanas`),
    fee: "Taxa de transferência",
    signingBonus: "Luvas",
    freeAgentTag: "Agente livre",
    ask: "Pedida",
    whyPrice: "Por que esse preço",
    // Os efeitos no salário mantêm a unidade: por split (a linha semanal os arredonda).
    whyPriceWages: "Efeitos no salário, por split",
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
    signed: (name: string) => `${name} assina com a org`,
    rejected: (name: string) => `${name} recusou os termos`,
    affordable: "Cabe no caixa",
    incomingBid: "Proposta recebida",
    bidFrom: (org: string) => `Proposta de ${org}`,
    accept: "Aceitar",
    decline: "Recusar",
    blockbuster: "Bombástica",
    // rc.33 (UX-07): a Bombástica explicada numa frase, só numa proposta Bombástica
    // (com o custo de recusar — CAREER_SALARY.blockbusterRefusalRenewalMult).
    blockbusterWhat: (org: string, mult: string, pct: number) =>
      `${org} oferece ${Math.round((Number(mult) - 1) * 100)}% acima do valor dele. Se você recusar, ele fica, mas pede ${pct}% a mais na próxima renovação`,
    consequences: "Depois deste negócio",
    balanceAfter: (s: string) => `Saldo após: ${s}`,
    // rc.32 (M4, provisório): o fôlego que a contratação deixa.
    runwayAfter: (weeks: number | null) =>
      weeks === null
        ? "O caixa segue no azul depois deste negócio"
        : `O caixa dura ${weeks === 1 ? "1 semana" : `${weeks} semanas`} depois deste negócio`,
    // rc.37 F2 (pacote 3): a venda de emergência — o selo da proposta, o que ela é, e o que a venda deixa.
    emergencyBadge: "Proposta de emergência",
    emergencyWhat: (days: number) =>
      `As contas estão no vermelho, então este comprador oferece abaixo do mercado. Vale por ${days} dias ou até a janela fechar`,
    // rc.37 F2 (Miguel, 05/11): o selo de valor de mercado nas propostas de emergência e bombásticas.
    belowValue: (pct: number | null) => (pct === null ? "Abaixo do valor de mercado" : `Abaixo do valor de mercado · ${pct}%`),
    aboveValue: (pct: number | null) => (pct === null ? "Acima do valor de mercado" : `Acima do valor de mercado · ${pct}%`),
    // rc9 TRAIN-MARKET: o que aceitar uma proposta lança, em linhas (SaleConsequences).
    sale: {
      leavesFor: "Vai para",
      squadAfter: "Elenco depois",
      players: (n: number) => (n === 1 ? "1 jogador" : `${n} jogadores`),
      lands: "Entra depois da parte do banco",
      loanShare: "Vai para o empréstimo emergencial",
    },
    saleShortSeat: "Uma vaga de titular aberta: um agente livre pode ocupá-la em qualquer dia, pelo Mercado",
    // ECO-03 (R47): a vaga é definida depois da contratação e nunca muda o preço.
    slotStarter: "Assume uma vaga aberta no trio titular",
    slotReserve: "Entra como reserva. Promova-o quando quiser no Elenco, com o mesmo contrato",
    // rc.33 (UX-07): elenco cheio só avisa e leva ao Elenco; a contratação espera uma vaga livre.
    squadFullWarn: (cap: number) =>
      `Seu elenco está cheio (${cap} de ${cap}). Dispense ou venda um jogador na tela de Elenco e depois contrate.`,
    toSquad: "Ir para o Elenco",
    // DEV-02 (R48): uma contratação cuja temporada atual tem de ser a última.
    finalSeasonDeal: "Última temporada: ele se aposenta ao fim desta temporada, só contrato de 1 temporada.",
    payrollWeek: (now: string, after: string) => `Folha: ${now} → ${after} / semana`,
    coachEffects: "O que este coach faz",
    // rc.34 (DEV-03 T4): o efeito dele chega pelo pacote do período — sem pacote = a base, com ou sem coach.
    coachTraining: (pct: number) => `+${pct}% de evolução no treino`,
    coachRating: (n: number) => `+${n} de rating do time em toda série`,
    coachNoneEffects: () => "Sem coach: o treino rende pela metade",
    // rc.34 (DEV-03 T4): o card de contratação.
    coachQuality: (q: number) => `Qualidade ${q}`,
    coachBestCard: (card: number) => `Melhor carta como jogador: ${card}`,
    coachCompare: "Comparar",
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
    filterSignableCount: (n: number) => `${n} ${n === 1 ? "jogador" : "jogadores"} ao alcance`,
    /** rc.35 (front C): uma org o contratou nesta janela. */
    justSignedTag: "Recém-contratado",
    viewSheet: "Ver ficha",
    noResults: "Nenhum jogador com esses filtros",
    dealsEmpty: "Nenhuma proposta na mesa. Os lances pelos seus jogadores chegam nas janelas de transferência",
    // v0.3 contratações travadas por reputação (cadeado visível)
    lockedAtRep: (rep: number) => `Assina com ${rep} de reputação`,
    lockedHint: "Precisa de mais reputação",
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
      groupPosition: "O ponto de vista dele",
      length: "Duração",
      worthTitle: "Como ele vê a sua oferta",
      sureFrom: (wage: string) => `Assina com certeza a partir de ${wage}`,
      askMark: (wage: string) => `Pedida ${wage}`,
      effectsTitle: "O que move a resposta dele",
      effectShare: (pts: number) => `Parte ${pts > 0 ? "+" : "−"}${Math.abs(pts)} pt${Math.abs(pts) === 1 ? "" : "s"}`,
      effectBonus: (delta: string) => `Luvas ${delta}`,
      effectLength: (seasons: number) => `Contrato de ${seasons} temporada${seasons === 1 ? "" : "s"}`,
      effectRefusals: (n: number) => (n === 1 ? "1 oferta recusada" : `${n} ofertas recusadas`),
      effectWeekly: (amount: string) => `${amount} / sem.`,
      send: "Enviar oferta",
      sendHint: "Ele responde quando você enviar. Uma recusa aumenta o que ele exige",
      refused: (wage: string) => `Ele recusou ${wage} / semana`,
      nowWants: (wage: string) => `Agora ele assina com certeza a partir de ${wage} / semana`,
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
      bankBacker: "O banco não abre outro empréstimo enquanto o emergencial estiver em aberto: quite esse primeiro.",
      bankNegative: "O seu caixa está baixo demais para um empréstimo do banco. Só o emergencial está disponível.",
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
      empty: "Defina um preço pedido. Uma org da região dele responde em poucos dias. Ninguém sai sem o seu aceite",
      listPlayer: "Listar um jogador",
      listForSale: "Listar para venda",
      listedTag: "Listado",
      changePrice: "Mudar preço",
      withdraw: "Retirar",
      waiting: (date: string) => `Resposta esperada até ${date}`,
      offered: "Proposta na mesa, veja acima",
      noBuyer: "Nenhuma org da região dele está comprando agora",
      tooDear: "O preço pedido foi alto demais",
      offerTag: "Resposta à sua listagem",
      counterLine: (ask: string) => `Contraproposta: você pediu ${ask}`,
      sheetTitle: "Listar um jogador",
      repriceTitle: "Mudar o preço pedido",
      pickTitle: "Escolha um jogador",
      value: "Valor de mercado",
      askLabel: "Preço pedido",
      askPct: (pct: number) => `${pct}% do valor de mercado dele`,
      guidance: (minDays: number, maxDays: number) =>
        `Um preço justo é pago por inteiro. Um preço alto pode render uma contraproposta menor ou nada. Resposta em ${minDays} a ${maxDays} dias`,
      confirm: "Listar",
      confirmReprice: "Atualizar preço",
      shortTenure: (pct: number) => `Ele chegou há menos de uma temporada: os clubes pagam cerca de ${pct}% do valor por enquanto`,
    },
    /** R135 (ECO-06): trocas de jogador por jogador. */
    trade: {
      title: "Trocas",
      empty: "Para propor uma troca, abra a oferta de um jogador sob contrato. Trocas só rolam na janela de transferências",
      proposeCta: "Propor uma troca",
      proposeHint: "Ofereça um dos seus jogadores por ele em vez de pagar a multa",
      row: (give: string, take: string, org: string) => `${give} por ${take} (${org})`,
      cashLine: (money: string) => `mais ${money} em dinheiro`,
      waiting: (date: string) => `Resposta esperada até ${date}`,
      agreed: "Acordada, aguardando o seu sim ou não",
      countered: (money: string) => `Eles pedem ${money} em dinheiro`,
      nowTitle: "Proposta de troca",
      withdraw: "Retirar",
      confirmTitle: "Confirmar a troca",
      leaves: "Sai",
      arrives: "Chega",
      cash: "Dinheiro que você paga",
      noCash: "Sem dinheiro",
      wageLine: (wage: string, share: string) => `${wage} · ${share}`,
      lengthLine: (n: number) => (n === 1 ? "1 temporada" : `${n} temporadas`),
      irreversible: "Isso não pode ser desfeito",
      sheetTitle: (name: string) => `Troca por ${name}`,
      target: "Quem chega",
      pickGive: "Escolha quem vai para a org dele",
      length: "Duração do contrato",
      cashLabel: "Dinheiro adicional",
      cashHint: "Opcional, cobre uma diferença de valor",
      summary: "O contrato dele",
      wage: "Salário",
      share: "Parte do prêmio",
      outlook: {
        likely: "Devem aceitar",
        close: "Está perto: podem pedir dinheiro",
        unlikely: "Improvável por esse preço",
        noFit: "Não vão enfraquecer tanto o elenco",
      },
      rules: (minDays: number, maxDays: number) =>
        `A org nunca paga a diferença: qualquer lacuna fica por sua conta, em dinheiro. Ela responde em ${minDays} a ${maxDays} dias`,
      send: "Enviar proposta",
    },
  },

  finances: {
    title: "Finanças",
    balance: "Saldo",
    net: "Líquido / semana",
    projected: "Projeção após segunda-feira",
    weeklyStatement: "Extrato semanal",
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
      mediaDay: "Dia de mídia", // v2.3 MEDIA
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
      word: SPONSOR_WORD_PT,
      rowLength: "Duração",
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
      boldLocked: "Contratos ousados liberam conforme a reputação cresce.",
      globalSponsor: "Global",
      nextPay: "Próximo pagamento",
      noNextPay: "Último já pago",
      finesNone: "Nenhuma multa devida",
      finesShort: (mondays: number) => `em ${mondays} segundas`,
      seasonFineCap: (s: string) => `Multas: no máximo ${s} por temporada`,
      dealRun: (paid: number, total: number) => `${paid} de ${total} segundas pagas`,
      total: (sure: string, upTo: string) => `${sure} garantido · até ${upTo}`,
      length: (splits: number, date: string) =>
        `${splits === 1 ? "Um split" : splits === 3 ? "Uma temporada" : splits === 6 ? "Duas temporadas" : `${splits} splits`} · termina ${date}`,
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
      // rc9 ORG-UI (#273): sem o número de tier da marca.
      levelScaled: (tier: number, pct: number) =>
        tier >= 4
          ? `Estas marcas pagam ${pct}% hoje. O valor cheio pede um elenco que brigue pelo Worlds.`
          : tier === 3
            ? `Estas marcas pagam ${pct}% hoje. O valor cheio pede um elenco de nível de Major.`
            : `Estas marcas pagam ${pct}% hoje. O valor cheio pede um elenco de top 8 regional.`,
      handover: (first: number, second: number) =>
        `Seu parceiro fundador sai aos poucos quando este contrato começar: ${first}%, depois ${second}% do valor, um split cada.`,
      // rc.34 review (S6): antes da temporada de índice 2, assinar não inicia a transição — o parceiro paga integralmente até o fim do prazo.
      handoverLater: (season: string, first: number, second: number) =>
        `Seu parceiro fundador paga o valor cheio até o fim de ${season}, assine o que assinar; depois sai aos poucos: ${first}%, depois ${second}% do valor, um split cada.`,
      handoverNet: (delta: string, date: string) => `Variação semanal líquida na transição (${date}): ${delta}`,
      activeTitle: "Contrato atual",
      // rc9 ORG-UI
      rowMost: "O máximo que paga",
      signedForYou: "Assinado automaticamente no prazo",
      dealPays: "Paga por semana",
      dealEnds: "Termina",
      dealGoing: "Como está indo",
      endsOn: (date: string) => `Termina ${date}`,
      milestonePending: (s: string) => `${s} no dia da primeira meta batida`,
      milestonePaid: (s: string) => `Marco de ${s} pago`,
      thisGoal: "Meta deste split",
      nextGoal: (date: string) => `A próxima meta sai em ${date}`,
      progress: (done: number, target: number) => `${done} de ${target}`,
      goalReached: "Batida",
      goalMissed: "Perdida",
      goalOpen: "Em aberto",
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
    majorLine: "Linha do Major",
    worldsLine: "Linha do Worlds",
    ptsShort: "pts",
    maxAvailable: (n: number) => `${n} pts ainda em disputa`,
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
      archiveNote: "História real da RLCS",
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
    },
    brand: {
      wire: { name: "O plantão", kicker: "PLANTÃO", credit: "" },
      fiftyFifty: { name: "50/50", kicker: "50/50", credit: "Notícias de Rocket League oferecidas pelo 50/50" },
    } as Record<string, { name: string; kicker: string; credit: string }>,
    digest: (n: number) => `Giro pela liga: mais ${n} movimentações`,
    tpl: {
      transfer: (p: Record<string, string | number>) => `${p.player} assina com a ${p.to}`,
      transferFee: (p: Record<string, string | number>) => `${p.to} tira ${p.player} da ${p.from} (${p.fee})`,
      transferFa: (p: Record<string, string | number>) => `${p.player} encontra casa na ${p.to}`,
      userSigned: (p: Record<string, string | number>) => `Oficial: ${p.player} chega à ${p.org}`,
      userSold: (p: Record<string, string | number>) => `${p.player} deixa ${p.org} rumo à ${p.to}`,
      userTraded: (p: Record<string, string | number>) => `${p.club} trocam ${p.give} por ${p.take} com a ${p.org}`,
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
      qualifiedMajor: () => `Classificou para o Major`,
      missedMajor: () => `Ficou fora do Major neste split`,
      qualifiedWorlds: () => `Classificou para o Worlds`,
      missedWorlds: () => `Fora da corrida pelo Worlds nesta temporada`,
      stability: (p: Record<string, string | number>) => `Reformulação do elenco custa ${p.points} Pontos da Temporada`,
      contractExpiring: (p: Record<string, string | number>) => `O contrato de ${p.player} está na última temporada`,
      contractReminder: (p: Record<string, string | number>) => `Relógio dos contratos: ${p.players}, ${p.weeks} semanas`,
      // rc.34 (Miguel, 31/10): um elenco incompleto ficou fora de uma regional.
      regionalSkipped: (p: Record<string, string | number>) => `${p.org} fica fora do ${p.event}`,
      eventMissedNoReserve: (p: Record<string, string | number>) => `${p.org} perde o ${p.event}: sem reserva`,
      playerLeft: (p: Record<string, string | number>) => `${p.player} sai como agente livre`,
      retirementAnnounce: (p: Record<string, string | number>) => `${p.player} anuncia sua última temporada`,
      retired: (p: Record<string, string | number>) => `${p.player} se aposenta`,
      // DEV-02 (R48): o aposentado do próprio elenco — banco ou fora do jogo.
      retiredToCoach: (p: Record<string, string | number>) => `${p.player} se aposenta e entra no grupo de treinadores`,
      retiredLeaves: (p: Record<string, string | number>) => `${p.player} se aposenta e deixa a cena`,
      insertResolved: (p: Record<string, string | number>) => `Decisão tomada: ${p.insert}`,
      orgEnters: (p: Record<string, string | number>) => `${p.org} entra na cena de ${p.region}`,
      // rc.33 (RTW-03): uma org cuja história acabou cede a vaga a quem entra.
      orgLeaves: (p: Record<string, string | number>) => `${p.org} deixa a cena de ${p.region}`,
      // v2.1 M1 (R139): o mundo se renova.
      orgNewcomer: (p: Record<string, string | number>) => `${p.org} assume a vaga da ${p.old} em ${p.region}`,
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
      windowOpen: () => `Janela de transferências aberta`,
      windowClose: () => `Janela de transferências fechada`,
      windowClosing: (p: Record<string, string | number>) => `A janela de transferências fecha em ${p.n} dias`, // v2.3 SKIP
      windowReport: (p: Record<string, string | number>) => `Relatório da janela: ${p.n} trocas pelas regiões`,
      debtCleared: () => `Empréstimo emergencial quitado`,
      sponsorSigned: (p: Record<string, string | number>) => `${p.org} anuncia parceria com ${p.name}`,
      // rc.34 (ECO-04): um contrato que chegou ao fim (termina numa virada de split).
      sponsorEnded: (p: Record<string, string | number>) => `${p.name}: contrato de patrocínio concluído`,
      repUp: (p: Record<string, string | number>) => `Reputação em alta: ${p.org}`,
      repDown: (p: Record<string, string | number>) => `Reputação em queda: ${p.org}`,
      starUp: (p: Record<string, string | number>) => `${p.org} alcança o status de ${p.n} estrelas`,
      unlock: (p: Record<string, string | number>) => `Desbloqueado: ${p.name}`,
      // rc.30 (A4): a limpeza única de uma carreira criada antes da rc.29.
      registryRepair: (p: Record<string, string | number>) =>
        `Registro da liga atualizado: ${p.n} ajustes de elenco e gamertag`,
      unavailable: (p: Record<string, string | number>) => `${p.player} está fora do ${p.event}`,
      standIn: (p: Record<string, string | number>) => `Substituto de emergência entra no ${p.event}`,
      bankLoan: (p: Record<string, string | number>) => `A org pega um empréstimo de ${p.amount}`,
      // rc.37 F2 (pacote 3): chega uma proposta de venda de emergência.
      emergencyBid: (p: Record<string, string | number>) => `${p.org} fazem uma proposta de emergência por ${p.player}`,
      bankCleared: () => `A org quita o empréstimo bancário`,
      cashWarning: (p: Record<string, string | number>) => `O caixa dura mais ${p.weeks} semanas`,
      // Histórico (rc.31–rc.33); o rc.34 publica emergencyLoan / emergencyTopUp / loanCollected.
      backerIn: () => `Um investidor de emergência estabiliza as contas`,
      emergencyLoan: () => `O banco entra com um empréstimo emergencial`,
      emergencyTopUp: () => `O banco aumenta o empréstimo emergencial da org`,
      loanCollected: () => `A org quita o empréstimo emergencial no prazo`,
      insolvency: () => `A org fecha: as contas caíram abaixo do piso`,
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
      flavor4: () => `Reclamações de ping se acumulam`,
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
          `Janela fechada na América do Sul: ${p.player} na ${p.to} é o destaque`,
          `${p.to} contrata ${p.player} no fechamento da janela sul-americana`,
        ][Number(p.v ?? 0) % 3],
    },
    // v0.2 — corpo de texto por template (mesmos params; o feed do QG renderiza). Uma notícia
    // cujo título já traz o fato não tem corpo (rc9 CLUB-NEWS).
    body: {
      userReleased: (p: Record<string, string | number>) =>
        `${p.org} pagou a rescisão. ${p.player} entra no mercado de agentes livres.`,
      resultUserQualified: (p: Record<string, string | number>) =>
        `Três vitórias no Swiss do ${p.event} garantem a vaga da org no regional. Os Pontos da Temporada são disputados no domingo.`,
      resultUserEliminated: (p: Record<string, string | number>) =>
        `Três derrotas encerraram o ${p.event} da org no Swiss. A premiação entra mesmo assim.`,
      qualifiedMajor: () =>
        `Acima da linha quando a classificação travou. O Major tem chave inter-regional e pontos em dobro.`,
      missedMajor: () =>
        `Abaixo da linha quando a classificação travou. O próximo split zera a corrida, e os pontos de Worlds já garantidos continuam valendo.`,
      qualifiedWorlds: () =>
        `Uma temporada inteira de pontos garantiu a vaga. O Worlds tem a maior chave do jogo.`,
      missedWorlds: () =>
        `Os pontos da temporada não bastaram. A org assiste ao Worlds de casa.`,
      stability: (p: Record<string, string | number>) =>
        `Um jogador novo no meio do split custou ${p.points} Pontos da Temporada. Reformule na pré-temporada.`,
      contractExpiring: () =>
        `Você pode renovar até o fim do Split 3.`,
      contractReminder: () =>
        `Renove antes da virada ou eles saem como agentes livres.`,
      regionalSkipped: (p: Record<string, string | number>) =>
        `Só ${p.n} de 3 vagas estão preenchidas, então o elenco não é inscrito no ${p.event}: sem pontos, sem prêmio.`,
      eventMissedNoReserve: (p: Record<string, string | number>) =>
        `Um titular ficou indisponível e não havia reserva, então o elenco não é inscrito no ${p.event}: sem pontos, sem prêmio. Um reserva assina na próxima janela de transferências.`,
      playerLeft: (p: Record<string, string | number>) =>
        `A renovação não veio e ${p.player} saiu de graça. As próximas negociações serão mais difíceis.`,
      orgLeaves: (p: Record<string, string | number>) =>
        `${p.org} não monta line nesta temporada. A vaga fica com um nome novo e os jogadores procuram outro time.`,
      orgNewcomer: (p: Record<string, string | number>) =>
        `Depois de duas temporadas no fundo da tabela de ${p.region}, ${p.old} vendeu a vaga. ${p.org} entra com os mesmos jogadores.`,
      prospectScouted: () =>
        `Ele vira titular quando for melhor que um dos titulares.`,
      prodigyRises: (p: Record<string, string | number>) =>
        `${p.player} tem teto entre os melhores do mundo.`,
      // v2.2 ENDLESS: só o que o save mostra (as contratações e o rating antes e depois).
      endlessProject: (p: Record<string, string | number>) =>
        `${p.org} (${p.region}) contrata ${listPt(p)} para a nova temporada${p.kit ? ` e soma ${kitPt(p.kit)}` : ""}. O rating do time vai de ${p.before} para ${p.after}.`,
      endlessProjectGrows: (p: Record<string, string | number>) =>
        `${p.org} (${p.region}) mantém a base${p.p1 ? `, contrata ${p.p1}` : ""}${p.kit ? ` e soma ${kitPt(p.kit)}` : ""}. O rating do time é ${p.after}.`,
      endlessHosts: (p: Record<string, string | number>) =>
        `Majors em ${hostPt(p.h1)}, ${hostPt(p.h2)} e ${hostPt(p.h3)}, e o Mundial em ${hostPt(p.h4)}.`,
      windowOpen: () =>
        `Os negócios se resolvem com o passar dos dias.`,
      windowClosing: () => `Propostas sem resposta e jogadores no mercado caducam quando a janela fechar.`, // v2.3 SKIP
      sponsorSigned: (p: Record<string, string | number>) =>
        `${p.org} e ${p.name} assinaram uma parceria: pagamento semanal e um bônus por meta batida. Os termos estão em Finanças.`,
      registryRepair: () =>
        `Jogadores listados por duas orgs agora ficam em um só elenco, e gamertags repetidas foram renomeadas. Seu elenco, seus contratos e seus resultados não mudaram.`,
      unavailable: () =>
        `O reserva assume a vaga com a química dele.`,
      standIn: (p: Record<string, string | number>) =>
        `Um substituto mantém a org no ${p.event}: escalação completa, sem química.`,
      emergencyBid: (p: Record<string, string | number>) =>
        `${p.org} oferecem abaixo do valor dele com as suas contas no vermelho. Responda em Mercado, Negociações.`,
      cashWarning: () =>
        `Os custos estão passando a receita.`,
      emergencyLoan: () =>
        `Premiações e vendas abatem parte dele, e ele tem prazo. As condições estão na caixa de entrada.`,
      emergencyTopUp: () =>
        `O prazo não mudou.`,
      incomingBid: (p: Record<string, string | number>) =>
        `${p.org} propõem por ${p.player}. Responda em Mercado, Negociações.`,
      gearBought: () =>
        `A eficiência de treino sobe.`,
      bootcampRun: () =>
        `A química sobe e o elenco chega mais afiado ao próximo evento oficial.`,
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} propõem por ${p.player}. Responda em Mercado, Negociações.`,
      // Histórico do rc.32 (ECO-08 / ECO-12): nada os envia desde o rc.33 — ficam para o feed de um save antigo.
      restructured: (p: Record<string, string | number>) =>
        `A org fechou de novo abaixo do piso e o Investidor forçou a mão${p.player ? `: ${p.player} vai para ${p.org}` : ""} (save antigo). ${legacyNextBreachPt(p.next)}`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} responderam à sua listagem com uma proposta formal por ${p.player}. Aceite antes de a janela fechar, ou fique com ele.`,
      listed: () =>
        `Uma proposta de um time que o escalaria pode chegar em poucos dias de janela.`,
      // v2.0 (C1)
      orgRelocates: (p: Record<string, string | number>) =>
        Number(p.withRoster)
          ? `${p.org} deixa ${p.from} e se inscreve em ${p.to} para a nova temporada com o mesmo elenco.`
          : `${p.org} troca ${p.from} por ${p.to} e recomeça lá com um elenco novo. Os jogadores que ficam para trás estão livres no mercado.`,
      worldsCancelled: () =>
        `A liga cancelou o Mundial desta temporada por causa da pandemia. O Split 3 e o seu Major seguem e a temporada termina depois deles. Nenhum título mundial neste ano.`,
      // Season 1 (R133): a redação da Rocket Street — América do Sul. `v` escolhe a linha (0–2).
      rsCupPreview: (p: Record<string, string | number>) =>
        [
          `A Rocket Street abre a chave neste sábado: times da América do Sul, eliminação simples, tudo em um dia. ${p.org} está convidada; a inscrição está no calendário.`,
          `O campeonato da comunidade da região é disputado no sábado, do começo ao fim em um dia. ${p.org} tem um convite no calendário.`,
          `Uma chave, um dia: o ${p.event} é neste sábado. ${p.org} recebeu o convite; a inscrição está no calendário.`,
        ][Number(p.v ?? 0) % 3],
      rsCupRecap: (p: Record<string, string | number>) =>
        Number(p.won)
          ? `${p.champion} venceu ${p.runnerUp} na final e leva o troféu da comunidade para casa.`
          : `${p.champion} venceu ${p.runnerUp} na final da chave da Rocket Street.${p.org && p.org !== p.runnerUp ? ` ${p.org} terminou: ${p.placement}.` : ""}`,
      rsRegionalRecap: (p: Record<string, string | number>) =>
        [
          `${p.champion} venceu ${p.runnerUp} na grande final do ${p.event}. Os Pontos da Temporada entram na tabela da América do Sul.`,
          `O Split ${p.split} tem mais um vencedor: ${p.champion} venceu ${p.runnerUp} na grande final do ${p.event}.`,
          `${p.runnerUp} chegou à grande final do ${p.event}, e ${p.champion} saiu com o título e a maior fatia dos pontos.`,
        ][Number(p.v ?? 0) % 3],
      rsBerths: (p: Record<string, string | number>) => {
        const sides = p.t2 ? `${p.t1} e ${p.t2}` : `${p.t1}`;
        return [
          `Os participantes do ${p.event} estão definidos. ${sides} ${p.t2 ? "representam" : "representa"} a América do Sul.`,
          `As vagas da América do Sul no ${p.event} estão decididas: ${sides}.`,
          `${sides} ${p.t2 ? "levam" : "leva"} a região ao ${p.event}.`,
        ][Number(p.v ?? 0) % 3];
      },
      rsWindowWrap: (p: Record<string, string | number>) => {
        const one = Number(p.n) === 1;
        return [
          `A América do Sul registrou ${p.n} ${one ? "troca" : "trocas"} antes de a janela fechar. O destaque: ${p.player} na ${p.to}${Number(p.paid) ? ` por ${p.fee}` : ", que estava livre no mercado"}.`,
          `A janela fechou na América do Sul. A chegada de ${p.player} à ${p.to}${Number(p.paid) ? ` por ${p.fee}` : " sem custo de transferência"} foi o negócio da janela, entre ${p.n} ${one ? "troca" : "trocas"}.`,
          `Elencos travados até a próxima janela. ${p.to} fez a maior contratação da região com ${p.player}${Number(p.paid) ? ` (${p.fee})` : ""}, entre ${p.n} ${one ? "troca" : "trocas"}.`,
        ][Number(p.v ?? 0) % 3];
      },
    },
  },

  achievements: {
    title: "Conquistas da carreira",
    hint: "Valem em todos os saves e após o reset de season. Cada uma paga Season XP uma vez",
    // rc.6 (R171): uma org consolidada não ganha nenhuma; elas são do caminho do clube fundado.
    foundedOnly: "Conquistadas com um clube fundado por você. Temporadas numa organização consolidada não contam",
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
    honorsEmpty: "Ainda não há títulos registrados nesta competição",
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
    trophyEmpty: "Nenhum troféu ainda",
    worldsPedestal: "Troféu do Worlds",
    records: "Recordes",
    recordPrize: "Premiação total",
    recordSeries: "Retrospecto em séries",
    recordBiggestFee: "Maior contratação",
    recordTitles: "Títulos",
    seasonHistory: "Histórico de temporadas",
    progression: "Progressão",
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
    settings: "Opções da carreira",
    // v2.1 Matchday fatia 3: o rótulo da opção e suas escolhas (a tela vem na fatia 5).
    // rc9 MATCHDAY (R245): a única configuração, na tela de treino.
    matchdayMode: {
      label: "Dia de jogo",
      beta: "Beta",
      betaNote: "Em beta: o plano e o jogo ao vivo ainda podem mudar.",
      levels: { result: "Só o resultado", watch: "Assistir", manage: "Comandar" },
      notes: {
        result: "O evento vai direto para o resultado.",
        watch: "Suas séries passam ao vivo. O técnico monta o plano.",
        manage: "Antes de cada série você escolhe o plano, depois ela passa ao vivo.",
      },
    },
    abandonCareer: "Abandonar carreira",
    abandonConfirm: "Isto apaga o save permanentemente",
  },

  event: {
    placementLabel: "Colocação",
    rewardsTable: "Premiação por colocação",
    communityLineup: (n: number) => `Seu elenco para o ${n}v${n}`,
    communitySeat: (n: number) => `Jogador ${n}`,
    lobbyTitle: "Lobby do evento",
    format: "Formato",
    formatSwiss: "Swiss de 16 times → top-8 em eliminação dupla",
    formatSingle: "Mata-mata de 8 times",
    /** v2.2 formatos de evento (FORMATS-SPEC.md): Major / Worlds no formato da temporada. */
    formats: {
      /** O título do sábado, por fase. */
      stage: { swiss: "Fase Swiss", groups4: "Fase de grupos", gsl8: "Fase de grupos", none: "Rodadas iniciais" },
      stageShort: {
        swiss: "Swiss de 16 times",
        groups4: "4 grupos de 4",
        gsl8: "2 grupos de 8 em eliminação dupla",
        none: "Eliminação dupla de 16 times",
      },
      bracketShort: {
        double8: "top-8 em eliminação dupla",
        single8: "mata-mata de 8",
        hybrid8: "chave híbrida de 8",
        hybrid12: "chave híbrida de 12",
        single12: "mata-mata de 12",
        double16: "os oito finais no domingo",
      },
      /** A linha do sábado na faixa do fim de semana. */
      stageSub: {
        swiss: (teams: number, wins: number) => `Swiss de ${teams} times · ${wins} vitórias para avançar`,
        groups4: "4 grupos de 4 · todos contra todos no grupo",
        gsl8: "2 grupos de 8 · 2 vitórias classificam, 2 derrotas eliminam",
        none: "Eliminação dupla de 16 times · até sobrarem oito",
      },
      /** A linha do domingo na faixa do fim de semana. */
      bracketSub: {
        double8: "Top-8 em eliminação dupla",
        single8: "Mata-mata de 8",
        hybrid8: "Chave híbrida de 8",
        hybrid12: "Chave híbrida de 12",
        single12: "Mata-mata de 12",
        double16: "Os oito finais da eliminação dupla",
      },
      /** Como a fase classifica (o lobby). */
      stageRule: {
        swiss: "Três vitórias classificam e três derrotas eliminam.",
        groups4: "Todos jogam contra todos dentro do grupo. Os desempates são pela tabela.",
        gsl8: "Duas vitórias classificam e duas derrotas eliminam. Avançam quatro por grupo.",
        none: "Todos começam na chave superior. Duas derrotas e você está fora.",
      },
      /** Como a chave é jogada (o lobby). */
      bracketRule: {
        double8: "Eliminação dupla com disputa de terceiro lugar.",
        single8: "Perdeu, está fora. A grande final é uma única série.",
        hybrid8: "Quem vence na chave superior vai à semifinal, quem perde vai às quartas. A chave inferior é mata-mata.",
        hybrid12: "O primeiro de cada grupo começa na chave superior. O segundo e o terceiro jogam a chave inferior, com uma rodada de mata-mata a mais.",
        single12: "O primeiro de cada grupo vai direto às quartas. O segundo e o terceiro disputam a primeira rodada.",
        double16: "A grande final é uma única série.",
      },
      /** Quem começa onde na chave híbrida, pela fase que a preenche. */
      hybridEntry: {
        swiss: "Os quatro melhores do Swiss começam na chave superior; os outros quatro, na inferior.",
        groups4: "O primeiro de cada grupo começa na chave superior; o segundo, na inferior.",
        gsl8: "Quem se classifica com 2–0 começa na chave superior; quem se classifica com 2–1, na inferior.",
        none: "",
      },
      stageComplete: { swiss: "Fase Swiss encerrada", groups4: "Fase de grupos encerrada", gsl8: "Fase de grupos encerrada", none: "Sábado encerrado" },
      eliminatedIn: { swiss: "Eliminado no Swiss", groups4: "Eliminado nos grupos", gsl8: "Eliminado nos grupos", none: "Eliminado no sábado" },
      /** O nome da colocação 13º–16º, por fase. */
      stageExit: { swiss: "Eliminado no Swiss", groups4: "Eliminado nos grupos", gsl8: "Eliminado nos grupos", none: "Eliminado na rodada 1 da inferior" },
      simStage: { swiss: "Simular o Swiss", groups4: "Simular os grupos", gsl8: "Simular os grupos", none: "Simular o sábado" },
      sundayField: (n: number): string => (n === 12 ? "Os doze dos playoffs" : "Os oito dos playoffs"),
      lastEight: "Os oito finais",
      side: { upper: "Chave superior", lower: "Chave inferior", bye: "Direto às quartas", round1: "Primeira rodada" },
      group: (letter: string) => `Grupo ${letter}`,
      groupStandings: "Classificação dos grupos",
    },
    yourSeed: (n: number) => `Seed nº ${n}`,
    watch: "Jogar a série",
    instant: "Resultado instantâneo",
    simToEnd: "Simular até o fim",
    skipSeries: "Pular série",
    lineupLocked: "Escalação travada para o evento",
    roundLabel: (n: number) => `Rodada ${n}`,
    swissStage: "Fase Swiss",
    playoffs: "Playoffs",
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
    sweep: "Sem perder um jogo",
    reverseSweep: "REVERSE SWEEP",
    eliminated: "Fora do evento",
    advancing: "Avança para a próxima rodada",
    champion: (name: string) => `${name}: CAMPEÕES`,
    earned: "Conquistado",
    unavailableNotice: (player: string) => `${player} não joga este evento. Um reserva entra no lugar.`,
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
    tomorrow: "Amanhã",
    qualifiedLine: "Classificado pela qualificatória de sábado",
    seedLine: (seed: number, record: string) => `Seed nº ${seed} · Swiss ${record}`,
    openerLabel: "Sua estreia",
    fieldLabel: "Quem joga no domingo",
    briefingTitle: "Preleção do técnico",
    briefingHint: "Preleção e bootcamp somados: no máximo +2 de rating",
    championshipBriefing: { keep: "Preparação equilibrada", recover: "Pico na grande final", prepare: "Força nas primeiras rodadas" },
    effectChampionship: (q: number, s: number, o: number, f: number) => `Quartas ${q > 0 ? "+" : ""}${String(q).replace(".", ",")}; semis ${s > 0 ? "+" : ""}${String(s).replace(".", ",")}; demais rodadas ${o > 0 ? "+" : ""}${String(o).replace(".", ",")}; grande final ${f > 0 ? "+" : ""}${String(f).replace(".", ",")}.`,
    briefing: {
      keep: "Continuidade",
      recover: "Recuperar",
      prepare: "Estudar o Swiss",
    },
    effectContinuity: (n: number) => `+${String(n).replace(".", ",")} de rating em todas as séries; sem risco extra.`,
    effectTradeoff: (first: number, later: number) => `${first > 0 ? "+" : ""}${String(first).replace(".", ",")} no Swiss; ${later > 0 ? "+" : ""}${String(later).replace(".", ",")} nos playoffs.`,
    start: "Começar o domingo",
    startHint: "Avança um dia. Domingo não tem treino nem pagamento.",
    fromHqHint: "O domingo começa no QG, com a preleção do técnico se você quiser.",
    briefingChip: (label: string) => `Preleção · ${label}`,
    outTitle: "Championship Sunday sem você",
    outLine: (record: string) => `Fora no Swiss (${record}). Os oito dos playoffs disputam a taça.`,
    watch: "Assistir ao domingo",
    withoutYouTitle: (event: string) => `${event} sem você`,
    withoutYouLine: "Fora na qualificatória de sábado.",
    whoQualified: "Classificados na qualificatória de sábado",
    resultsInTitle: (event: string) => `${event}: saíram os resultados`,
    resultsInLine: "Você não estava nele.",
  },

  // rc.36 (SUN-03, R88) — /career/follow: um evento sem você.
  follow: {
    swissStandings: "Classificação do Swiss",
    kicker: "Da arquibancada",
    reasonEliminated: "Fora na qualificatória",
    reasonNotQualified: "Fora do evento",
    field: "Quem está no evento",
    swissRound: (n: number) => `Rodada ${n} do Swiss`,
    results: "Resultado final",
    champion: "Campeão",
    nextRound: "Próxima rodada",
    pause: "Pausar",
    play: "Continuar",
    skipToResults: "Pular para os resultados",
    backToHq: "Voltar ao QG",
    nothing: "Nenhum evento para acompanhar",
    nothingWhy: "Um evento de que você está fora aparece aqui",
    progress: (n: number, total: number) => `Rodada ${n} de ${total}`,
    teams: (n: number) => `${n} times`,
  },

  ceremonies: {
    seasonReview: "Balanço da temporada",
    seasonGrade: (g: string) => `Nota da temporada: ${g}`,
    grade: "Nota", // rc9 HQ
    devRecap: "Evolução do elenco",
    nextSeason: "Antes da próxima temporada", // rc9 HQ
    rank: "Na região",
    results: "Pódios",
    otherEvents: (n: number) => (n === 1 ? "Mais 1 evento disputado" : `Mais ${n} eventos disputados`),
    noPodium: "Nenhum pódio na temporada",
    prize: "Prêmios",
    rolloverCta: "Iniciar a temporada",
    worldsChampion: (name: string) => `Campeões mundiais: ${name}`,
    yourTitle: "Campeões mundiais",
    finalWhistle: "Apito final",
    finalWhistleBody: "A temporada 2026 termina aqui. Você pode seguir jogando na era infinita.",
    insolvencyTitle: "Insolvência",
    insolvencyBody: "As contas ficaram abaixo do piso vezes demais.",
    // rc.34 (end.moneyCause "deadline"): o empréstimo emergencial sem pagar no prazo.
    insolvencyBodyDeadline: "O empréstimo emergencial venceu e o saldo não cobria a dívida.",
    legacyTitle: "Legado da carreira",
    legacyGrade: { legend: "Lenda", contender: "Contendor", challenger: "Desafiante", journeyman: "Batalhador" },
    retire: "Aposentar",
    retireDesc: "A carreira é arquivada: troféus e histórico continuam visíveis.",
    infinite: "Era infinita",
    infiniteDesc: "A história passa a ser gerada a partir de agora.",
    infiniteExplainer: "A partir de 2027 o mundo é gerado: surgem novatos, veteranos se aposentam.",
    defendTitle: "Defender o título",
  },

  // v2.2: o cartão de compartilhamento da carreira (components/career/share).
  share: {
    button: "Compartilhar carreira",
    buttonTitle: "Compartilhar o título",
    sheetTitle: "Compartilhe a sua carreira",
    kicker: "Road to Worlds",
    manager: (name: string) => `Manager ${name}`,
    meta: (region: string, season: string) => `${region} · ${season}`,
    headlineWorlds: (n: number) => (n > 1 ? `${n}× campeões mundiais` : "Campeões mundiais"),
    headlineMajors: (n: number) => (n > 1 ? `${n}× campeões de Major` : "Campeões de Major"),
    headlineRegionals: (n: number) => (n > 1 ? `${n} títulos regionais` : "Campeões regionais"),
    headlineTitles: (n: number) => (n > 1 ? `${n} títulos` : "O primeiro troféu"),
    // rc9 SHARE (#258 revisada): um clube sem título abre com a temporada; o retrospecto vira número.
    headlineSeason: (n: number) => `Temporada ${n}`,
    shelfWorlds: "Mundiais",
    shelfMajors: "Majors",
    shelfRegionals: "Regionais",
    shelfOther: "Outros títulos",
    figSeries: "Séries",
    figPrize: "Premiação",
    textWorlds: (org: string, n: number) =>
      `${org} ${n > 1 ? `já ganhou o Mundial ${n} vezes` : "é campeã mundial"} no Road to Worlds, o modo carreira da RLCS do Rocket Draft. Monte a sua org do zero:`,
    textTitles: (org: string, n: number) =>
      `${org}: ${n} ${n === 1 ? "título" : "títulos"} até aqui no Road to Worlds, o modo carreira da RLCS do Rocket Draft. Comande a sua org:`,
    textNone: (org: string) =>
      `Estou comandando a ${org} no Road to Worlds, o modo carreira da RLCS do Rocket Draft. Monte a sua org e me encontre no Mundial:`,
    hint: "O link abre o Road to Worlds. O seu save fica neste aparelho.",
  },

  cloud: {
    synced: (when: string) => `Salvo na sua conta · ${when}`,
    pending: "Aguardando para salvar na sua conta",
    syncing: "Salvando na sua conta…",
    conflict: "Duas cópias desta carreira",
    choose: "Escolher",
    newer: "A cópia na sua conta é de uma versão mais nova do jogo. Recarregue para atualizar",
    error: "Não foi possível acessar a sua conta. Tentando de novo",
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
    deleteAlso: "A cópia na sua conta também é apagada",
    helpActive: "As carreiras também ficam salvas na sua conta. Exporte um arquivo para ter um backup seu",
    helpLocal: "As carreiras ficam salvas neste navegador. Exporte um arquivo para levar uma para outro aparelho ou guardar um backup",
    helpSignIn: "Entre para manter uma cópia na sua conta",
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
      updated: (org: string) => `${org}: atualizada pela sua conta`,
      restored: (org: string) => `${org}: restaurada da sua conta`,
    },
  },

  saves: {
    title: "Carreiras",
    empty: "Fundar uma nova org",
    resume: "Retomar",
    archived: "Arquivada",
    champion: "Campeões",
    delete: "Apagar",
    deleteConfirm: (org: string, n: number) =>
      `Apagar ${org}? ${n} temporada${n === 1 ? "" : "s"} de história somem. Isto não pode ser desfeito.`,
    lastPlayed: "Jogado por último",
    newCareer: "Nova carreira",
    emptySlot: "Espaço vazio",
    slotsFull: "Os três espaços estão ocupados",
  },

  // v2.0.31: o convite da pesquisa com jogadores na revisão da temporada.
  savesNotice: {
    title: "Suas carreiras em qualquer aparelho",
    body: "Até três carreiras ao mesmo tempo. Com a conta conectada, cada uma fica guardada nela e abre em qualquer aparelho.",
    open: "Ver minhas carreiras",
    dismiss: "Entendi",
  },

  research: {
    title: "Ajude a moldar o Road to Worlds",
    body: "Um formulário curto sobre o que funciona, o que não funciona e o que falta.",
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

  // rc9 HQ: o grupo `explainers` (dicas da primeira visita) saiu: nenhum componente o lia desde o tour guiado (rc.54).

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
    // rc9 TRAIN-MARKET: cada regra uma vez, onde ela é necessária.
    received: "Crédito na conta",
    repayTotal: "Total a pagar",
    weeklyPayment: "Por semana",
    termWeeks: "Semanas",
    ok: "Entendi",
    toFinances: "Abrir Finanças",
    loanOpened: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O banco entrou em cena",
      lead: `Seu saldo ficou abaixo do piso (${p.floor}), então o banco emprestou ${p.lent}.`,
      rows: noticeRows(
        ["Você deve", `${p.owed}, com ${p.repayPct}% de juros`],
        p.dlDate !== undefined && ["Quitar até", `${p.dlDate} (${p.dlWeeks} semanas)`],
        p.dlDate !== undefined && ["No prazo", "O banco cobra. Se isso deixar você abaixo do piso, a carreira acaba"],
        ["Como se paga", `${p.garnishPct}% de cada premiação e ${p.salePct}% de cada venda vão para o banco. O resto você paga em Finanças`],
        positive(p.partnerWeekly) && [
          "Investidor",
          `${p.partnerName} entra com este empréstimo: ${p.partnerWeekly} por semana durante ${p.partnerWeeks} semanas, sem nunca cobrar de volta`,
        ],
        noticeNextPt(p) !== "" && ["Se acontecer de novo", noticeNextPt(p)],
      ),
      foot: Number(p.lock) ? "Enquanto você deve: sem taxas de transferência e sem equipamento" : undefined,
    }),
    loanTopUp: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O banco aumentou seu empréstimo",
      lead: `Seu saldo ficou abaixo do piso de novo, então o banco emprestou mais ${p.lent}.`,
      rows: noticeRows(
        ["Você deve", `${p.owed} no total`],
        p.dlDate !== undefined && ["Quitar até", `${p.dlDate}, o prazo não muda`],
        noticeNextPt(p) !== "" && ["Se acontecer de novo", noticeNextPt(p)],
      ),
    }),
    deadlineWarning: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: Number(p.weeksLeft) === 1 ? "Uma semana para pagar o banco" : `${p.weeksLeft} semanas para pagar o banco`,
      lead: `O empréstimo emergencial vence em ${p.dlDate}. A dívida é de ${p.owed}; o saldo está em ${p.balance}.`,
      rows: noticeRows(
        // rc.34 review: as contas projetadas até o prazo (com o gasto semanal), não o saldo de hoje.
        ["Neste ritmo", onPacePt(p)],
        !Number(p.covered) && ["Como fechar a diferença", noticeWaysPt(p)],
        !Number(p.covered) && ["No prazo", "O banco cobra. Se isso deixar você abaixo do piso, a carreira acaba"],
        // rc.9 integração: como pagar antes; um pagamento parcial não fecha nada.
        ["Pagar antes", "Quitar tudo, em Finanças, encerra a dívida em qualquer dia em que o saldo fique acima do piso depois de pagar"],
      ),
    }),
    // rc.34 review: nas últimas semanas a projeção deixou de cobrir a dívida (uma taxa, uma compra, um prêmio perdido).
    deadlineSlipped: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O empréstimo deixou de estar coberto",
      lead: `${Number(p.weeksLeft) === 1 ? "Falta uma semana" : `Faltam ${p.weeksLeft} semanas`} para o prazo (${p.dlDate}). Neste ritmo, faltam ${p.gap} para os ${p.owed} devidos.`,
      rows: noticeRows(["Como fechar a diferença", noticeWaysPt(p)]),
    }),
    deadlineCollected: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "Empréstimo quitado",
      lead: `O prazo chegou e as contas aguentaram: o banco cobrou ${p.collected}. O saldo agora é de ${p.balance}.`,
      rows: noticeRows([
        "E agora",
        p.next === undefined ? "Cair de novo abaixo do piso abre outro empréstimo, com prazo novo" : noticeNextPt(p),
      ]),
    }),
    careerEnded: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "A carreira termina aqui",
      lead:
        p.cause === "deadline"
          ? `O empréstimo emergencial venceu com ${p.owed} de dívida e ${p.balance} em caixa. Pagar deixaria você abaixo do piso, então a org fechou as portas.`
          : !positive(p.owed) && Number(p.maxLoans) >= 0 && Number(p.loans) >= Number(p.maxLoans)
            ? `Seu saldo ficou abaixo do piso de novo e o banco não abriria outro empréstimo emergencial depois ${Number(p.loans) === 1 ? "do que já emprestou" : `dos ${p.loans} que já emprestou`}. A org fechou as portas.`
            : `Seu saldo ficou abaixo do piso de novo e o banco não quis emprestar mais${Number(p.topUps) > 0 ? ` depois de ${p.topUps} acréscimos` : ""}. A org fechou as portas.`,
      rows: noticeRows(["O que fica", "A revisão da temporada, o arquivo e os troféus"]),
    }),
    loanTakenOver: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O banco assumiu a sua dívida",
      lead: `O Investidor de emergência saiu de cena. Os ${p.owed} que você devia a ele agora são um empréstimo emergencial com o banco.`,
      rows: noticeRows(
        p.dlDate !== undefined && ["Quitar até", `${p.dlDate} (${p.dlWeeks} semanas)`],
        ["Como se paga", `${p.garnishPct}% de cada premiação e ${p.salePct}% de cada venda vão para o banco. O resto você paga em Finanças`],
      ),
    }),
    // rc.37 F2 (pacote 2): o empréstimo comum do banco, oferecido antes do piso (careerFlow.offerCreditOnRunway).
    notNow: "Agora não",
    takeLoan: (amount: string) => `Pegar ${amount}`,
    creditOffer: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O banco oferece um empréstimo",
      lead:
        Number(p.weeks) > 0
          ? `Gastando ${p.burn} por semana, seu caixa dura mais ou menos ${p.weeks} segundas-feiras. Antes de chegar ao piso (${p.floor}), o banco oferece um empréstimo.`
          : `Você está no vermelho (${p.balance}) e perde ${p.burn} por semana. Antes de chegar ao piso (${p.floor}), o banco oferece um empréstimo.`,
      rows: noticeRows(
        ["Você recebe", `${p.loanNet} agora`],
        ["Você paga", `${p.loanTotal} no total, com ${p.loanPct}% de juros`],
        ["Prazo", `${p.loanTerm} semanas, ${p.loanWeekly} toda segunda`],
        ["Sem ele", `Neste ritmo você passa do piso n${breachWhenPt(p)}`],
      ),
      foot: `O empréstimo emergencial custa mais: ${p.emergencyPct}%${Number(p.emergencyTerm) > 0 ? `, quitado em até ${p.emergencyTerm} semanas` : ""}`,
    }),
    // rc.37 F2 (pacote 4): um gasto único trouxe o piso para perto (careerFlow.spendAlertFlow).
    spendRisk: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: Number(p.mondays) === 1 ? "A próxima segunda passa do piso" : "Isso deixa você perto do piso",
      lead: positive(p.burn)
        ? `Depois de ${p.spent}, sobram ${p.balance}. Gastando ${p.burn} por semana, você passa do piso (${p.floor}) n${breachWhenPt(p)}.`
        : `Depois de ${p.spent}, sobram ${p.balance}, abaixo do piso (${p.floor}) mesmo com a receita da semana: ${breachWhenPt(p)} passa dele.`,
      rows: noticeRows(
        noticeNextPt(p) !== "" && ["Nessa segunda", noticeNextPt(p)],
        Number(p.offer) > 0 && [
          "A oferta do banco",
          `${p.loanNet} agora, ${p.loanTotal} no total, ${p.loanWeekly} toda segunda por ${p.loanTerm} semanas`,
        ],
        ["Outras saídas", "Premiação antes dessa segunda, uma boa proposta por um jogador ou uma folha mais leve"],
      ),
    }),
  },

  // rc9 MATCHDAY (R240-R246): a série do usuário quando você comanda. O plano
  // antes da série (três diretrizes), os jogos ao vivo, a única chamada no
  // intervalo, o fim com o que o plano fez.
  seriesDesk: {
    planTitle: "Seu plano",
    favourite: (gap: number) => `Vocês são os favoritos, com ${gap} ${gap === 1 ? "ponto" : "pontos"} de rating a mais`,
    underdog: (gap: number) => `Eles são os favoritos, com ${gap} ${gap === 1 ? "ponto" : "pontos"} de rating a mais`,
    even: "Confronto equilibrado",
    read: (theirs: string, answer: string) => `Eles jogam no estilo ${theirs}. ${answer} vence esse estilo.`,
    readPlain: (theirs: string) => `Eles jogam no estilo ${theirs}.`,
    approach: "Abordagem",
    ourGame: (style: string) => `Nosso jogo: ${style}`,
    answer: (style: string) => `Responder com ${style}`,
    ourGameEdge: (theirs: string) => `Já vence o estilo ${theirs} deles.`,
    ourGameAgainst: (theirs: string) => `O estilo ${theirs} deles leva vantagem sobre ele.`,
    ourGameNeutral: "O estilo em que o time mais encaixa. Sem vantagem para ninguém.",
    answerNote: (theirs: string, fit: number, own: number) => `Vence o estilo ${theirs} deles, mas o time encaixa só ${fit}% nele (${own}% no próprio estilo).`,
    switchTo: (style: string) => `Mudar para ${style}`,
    switchNote: (theirs: string, fit: number) => `Tira a vantagem do estilo ${theirs} deles. O time encaixa ${fit}% nele.`,
    risk: "Risco",
    risks: { safe: "Controlado", standard: "Normal", aggressive: "Tudo ou nada" },
    riskNote: {
      safe: "Menos oscilação em cada jogo. Bom para o favorito.",
      standard: "Os jogos oscilam como sempre.",
      aggressive: "Mais oscilação em cada jogo. Bom para o azarão.",
    },
    shutDown: "Anular",
    free: "Ninguém",
    mark: (name: string) => `Marcar ${name}`,
    freeNote: "Cada um mantém a sua função.",
    markNote: (name: string) => `Corta as jogadas especiais de ${name}, e prende parte da sua defesa.`,
    coachPick: "Técnico",
    captainPick: "Capitão",
    play: "Jogar a série",
    skip: "Ir para o resultado",
    pause: "Pausar",
    resume: "Continuar",
    speed: "Velocidade",
    skipGame: "Pular jogo",
    skipSeries: "Pular série",
    gameOf: (n: number, bo: number) => `Jogo ${n} · Melhor de ${bo}`,
    series: (a: number, b: number) => `Série ${a}-${b}`,
    // O botão de tempo técnico: pedido para o próximo intervalo, um por série.
    timeout: "Pedir tempo",
    timeoutLeft: "resta 1",
    timeoutCalled: "Tempo pedido",
    timeoutUsed: "Tempo usado",
    seriesWon: "Série vencida",
    seriesLost: "Série perdida",
    continue: "Continuar",
    noGoalsYet: "Nenhum gol ainda.",
    final: "Fim",
    goalLine: (scorer: string, a: number, b: number) => `Gol de ${scorer}, ${a}-${b}`,
    clock: "Relógio do jogo",
    strip: { shots: "Chutes", saves: "Defesas", assists: "Assistências", demos: "Demolições", score: "Pontos" },
    styles: {
      pressure: "Pressão",
      possession: "Posse",
      counter: "Contra-ataque",
      individual: "Individual",
      teamplay: "Jogo coletivo",
    },
    // O que o plano fez, a partir do registro da série no motor (planLine.ts).
    games: (list: string) => (list.includes(" ") ? `nos jogos ${list}` : `no jogo ${list}`),
    and: "e",
    lineEdge: (style: string, theirs: string, games: string, won: number) =>
      `O estilo ${style} levou vantagem sobre o ${theirs} deles ${games}, e vocês venceram ${won}.`,
    lineEdgeLost: (style: string, theirs: string, games: string) =>
      `O estilo ${style} levou vantagem sobre o ${theirs} deles ${games}, mas esses jogos ficaram com eles.`,
    lineEdgeAll: (style: string, theirs: string, won: number, n: number) =>
      `O estilo ${style} levou vantagem sobre o ${theirs} deles em todos os jogos. Vocês venceram ${won} de ${n}.`,
    lineSwitch: (style: string, theirs: string, games: string, to: string) =>
      `O estilo ${style} levou vantagem sobre o ${theirs} deles ${games}, até eles mudarem para ${to}.`,
    lineAgainst: (theirs: string, style: string, games: string) => `O estilo ${theirs} deles levou vantagem sobre o seu ${style} ${games}.`,
    lineNeutral: "Nenhum estilo levou vantagem sobre o outro.",
    lineTimeout: (game: number) => `O tempo técnico antes do jogo ${game} cortou o embalo deles.`,
    lineTimeoutEmpty: (game: number) => `O tempo técnico antes do jogo ${game} não tinha embalo para cortar.`,
  },

  // rc9 MATCHDAY (STORIES): os números dos seus jogadores na tela do evento.
  eventStats: {
    title: "Seus jogadores",
    event: "Neste evento",
    last: "Última série",
    empty: "Os números aparecem depois da sua primeira série.",
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
    // rc9 MATCHDAY: seasonSub cortado (auditoria de texto); os jogos de cada jogador sob o nome.
    gamesPlayed: (n: number) => (n === 1 ? "1 jogo" : `${n} jogos`),
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
      top12: "Top 12",
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
      body: "O modo carreira já dá para jogar do primeiro qualificatório ao Mundial. Balanceamento e preços ainda vão mudar.",
      feedback: "Conte no Discord o que pareceu estranho.",
      discord: "Entrar no Discord",
      close: "Começar minha carreira",
    },
    hub: {
      welcome: {
        title: "Bem-vindo ao Road to Worlds",
        body: "Você comanda uma org do primeiro elenco até o Mundial.",
        points: [
          { label: "Elenco", text: "Contrate, treine e renove" },
          { label: "Caixa", text: "Os salários saem toda segunda" },
          { label: "Pontos da Temporada", text: "Levam aos Majors e ao Worlds" },
        ],
      },
      tabs: {
        title: "Cada aba, uma área do clube",
        body: "",
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
          board: "As metas da diretoria", // rc9 HQ
        } as Record<string, string>,
      },
      advance: {
        title: "O relógio é seu",
        body: "O tempo só passa quando você avança. O jogo para quando algo precisa de você.",
        points: [
          { label: "Avançar", text: "Dia a dia, até a próxima parada" },
          { label: "Pular adiante", text: "Direto para a próxima parada" },
        ],
      },
      day: {
        title: "O cartão do dia",
        body: "O que pede decisão hoje aparece aqui: uma proposta, um patrocínio, um evento.",
      },
      inbox: {
        title: "Caixa de entrada",
        body: "Propostas, avisos do banco e convites chegam por e-mail. Abra os que pedem resposta.",
      },
      finances: {
        title: "De olho no caixa",
        body: "Prêmios e patrocínio entram, salários saem toda segunda. Se o saldo afundar demais, o banco empresta, com prazo.",
      },
      progress: {
        title: "Progressão",
        body: "Resultados aumentam a reputação. A reputação libera o coach, patrocinadores melhores e nova estrutura.",
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
        title: "O seu dinheiro num olhar",
        body: "O saldo ao longo do tempo e o que entra e sai a cada segunda.",
      },
      sponsor: {
        title: "Patrocínio",
        body: "O contrato paga uma base garantida e um bônus por meta batida. Os mais seguros pagam menos; os ousados multam a meta perdida.",
      },
      loans: {
        title: "Empréstimos e o piso",
        body: "Pegue crédito quando quiser. Abaixo do piso numa segunda, o banco empresta com prazo; perder o prazo encerra a carreira.",
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
    locked: "Ainda não desbloqueada",
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
    // rc.6 (ORGMODE UI-B): um clube fundado responde aos donos pelas mesmas peças.
    ownersTitle: "Donos",
    ownersConfidence: "Confiança dos donos",
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
      body: "Escolha um dos três planos. A verba entra quando você aceita.",
      ownersBody: "Escolha um dos três planos. Os donos pagam a verba quando você aceita.",
      name: { cautious: "Cauteloso", expected: "Esperado", ambitious: "Ambicioso" } as Record<string, string>,
      band: (key: string) => BOARD_BANDS_PT[key] ?? key,
      budget: (amount: string) => `Verba ${amount}`,
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
      notYetMandate: "Pago quando você lê o mandato",
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
      pendingMandate: "Leia o mandato da diretoria",
      ultimatum: "Ultimato em aberto",
      met: "Objetivo cumprido",
      missed: "Objetivo perdido",
    },
    reasons: {
      managerPost: "Seu post para a torcida", // rc9 STORIES
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
      mandateMoneyMet: "Meta de dinheiro cumprida",
      mandateMoneyMissed: "Meta de dinheiro perdida",
      mandateSquadMet: "Meta de elenco cumprida",
      mandateSquadMissed: "Meta de elenco perdida",
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
    managerRep: "Reputação do técnico",
    spells: "Carreira",
    spell: (org: string, from: number, to: string) => `${org}: temporada ${from + 1} a ${to}`,
    now: "agora",
    openBoard: "Abrir a diretoria",
    boardFreezeError: "A diretoria congelou as contratações nesta janela.",
    wageBill: "Folha / semana",
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
    // v2.2 MANDATE (ORGMODE 2027 etapa 2): o mandato da temporada de uma org consolidada, os problemas da casa, o nível de exigência.
    mandate: {
      title: "O mandato da diretoria",
      season: (season: string) => `${season} · definido pela diretoria`,
      body: "A diretoria define três metas para a temporada.",
      goalLabel: "Meta", // rc9 ORG-UI: the goal table's first column
      demandLabel: "Exigência",
      demand: { low: "Baixa", medium: "Média", high: "Alta" } as Record<string, string>,
      demandNote: {
        low: "A diretoria dá tempo para construir.",
        medium: "A diretoria espera progresso constante.",
        high: "A diretoria espera vencer, e logo.",
      } as Record<string, string>,
      demandLine: (level: string) => `Exigência ${(({ low: "baixa", medium: "média", high: "alta" } as Record<string, string>)[level] ?? level)}`,
      area: { classification: "Classificação", money: "Dinheiro", squad: "Elenco" } as Record<string, string>,
      weighsMost: "Pesa mais",
      gainLabel: "Se cumprir",
      lossLabel: "Se não cumprir",
      confidenceUnit: "de confiança",
      budgetUnit: "no orçamento seguinte",
      bonusUnit: "de bônus",
      noChange: "Nada muda",
      money: (kind: string, amount: string, week: number): string => {
        switch (kind) {
          case "cashFloor":
            return `Termine a temporada com pelo menos ${amount} em caixa`;
          case "wagesUnder":
            return `Baixe a folha para ${amount} por semana até a semana ${week}`;
          case "netSpend":
            return `Mantenha o gasto líquido em transferências dentro de ${amount}`;
          case "sales":
            return `Arrecade ${amount} em vendas de jogadores`;
          default:
            return "";
        }
      },
      squad: (kind: string, value: number, names: string[]): string => {
        switch (kind) {
          case "signStarter":
            return `Contrate um titular de ${value} ou mais`;
          case "renew":
            return `Renove o contrato de ${names[0] ?? "o titular"}`;
          case "ageUnder":
            return `Baixe a média de idade dos titulares para ${value} ou menos`;
          case "youthEvents":
            return `Escale ${names[0] ?? "a promessa"} como titular em ${value} eventos oficiais`;
          case "keepCore":
            return `Mantenha ${joinPt(names)} até o fim da temporada`;
          default:
            return "";
        }
      },
      moneyNow: (kind: string, now: string): string =>
        kind === "cashFloor" ? `${now} em caixa agora` : kind === "wagesUnder" ? `${now} por semana agora` : kind === "netSpend" ? `${now} gastos (líquido) até agora` : `${now} arrecadados até agora`,
      squadNow: (kind: string, now: number, target: number): string => {
        switch (kind) {
          case "signStarter":
            return now > 0 ? `Melhor titular novo: ${now}` : "Nenhum titular novo ainda";
          case "renew":
            return now > 0 ? "Renovado" : "Ainda não renovado";
          case "ageUnder":
            return `Média de ${now} agora`;
          case "youthEvents":
            return `${now} de ${target} eventos`;
          case "keepCore":
            return `${now} de ${target} seguem no clube`;
          default:
            return "";
        }
      },
      because: (issue: string) => `Motivo: ${issue.toLowerCase()}`,
      onTrack: "No caminho",
      behind: "Atrasado",
      issuesNow: "O que precisa de conserto",
      noIssues: "Nada urgente: a casa está em ordem.",
      issue: {
        dealsEnding: "Um contrato acaba",
        wageBill: "Folha no teto",
        shortCash: "Pouco caixa",
        weakLink: "Um elo fraco",
        agingCore: "Um núcleo envelhecido",
        lowChemistry: "Sem entrosamento",
        noCoach: "Sem técnico",
        costlyBench: "Um banco caro",
        noReserve: "Sem reserva",
        sponsorEnding: "O patrocínio acaba",
        prospectBenched: "Uma promessa no banco",
        noSponsor: "Sem patrocinador",
        dealsSoon: "Contratos acabam na próxima",
        wageRoom: "Pouca margem na folha",
      } as Record<string, string>,
      issueLine: (kind: string, value: number, name?: string): string => {
        switch (kind) {
          case "dealsEnding":
            return `O contrato de ${name ?? "um titular"} termina nesta temporada${value > 1 ? `, e mais ${value - 1}` : ""}.`;
          case "wageBill":
            return `A folha está em ${value}% do teto da diretoria.`;
          case "shortCash":
            return `O caixa cobre ${value} semanas de custos.`;
          case "weakLink":
            return `${name ?? "Um titular"} está ${value} pontos abaixo dos outros dois titulares.`;
          case "agingCore":
            return `Os titulares têm média de ${value} anos.`;
          case "lowChemistry":
            return `O trio titular está com ${value}% de entrosamento.`;
          case "noCoach":
            return "Ninguém comanda os treinos do elenco.";
          case "costlyBench":
            return `${name ?? "O reserva"} recebe ${value}% do salário de um titular no banco.`;
          case "noReserve":
            return "Ninguém no banco: um titular ausente deixa uma vaga vazia.";
          case "sponsorEnding":
            return "O contrato do patrocinador termina nesta temporada.";
          case "prospectBenched":
            return `${name ?? "Uma promessa"} (${value}) está fora do trio titular.`;
          case "noSponsor":
            return "Nenhum patrocinador sob contrato ainda.";
          case "dealsSoon":
            return `O contrato de ${name ?? "um titular"} termina na próxima temporada${value > 1 ? `, e mais ${value - 1}` : ""}.`;
          case "wageRoom":
            return `A folha está em ${value}% do teto.`;
          default:
            return "";
        }
      },
      lastTitle: "Última temporada",
      demandUp: "A exigência subiu com o patamar da org.",
      demandDown: "A exigência diminuiu com o patamar da org.",
      accept: "Começar a temporada",
      reread: "Ler o mandato",
      keptNote: "O mandato fica na página da Diretoria e na caixa de entrada.",
      pending: "O mandato da diretoria está na sua mesa: leia para começar a temporada.",
      metOf: (n: number, total: number) => `${n} de ${total} cumpridas`,
      dossierTitle: "O que a diretoria vai pedir",
      dossierNote: "Definido na chegada, a partir da org como ela está. Você não escolhe.",
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
        boardWelcome: (p: Record<string, string | number>) => `Bem-vindo à ${p.org}`,
        boardMandate: (p: Record<string, string | number>) => `O mandato da diretoria para a temporada ${p.season}`,
        boardMandateReport: (p: Record<string, string | number>) => `Relatório da diretoria após o split ${p.split}`,
        boardMandateVerdict: () => "O veredito da diretoria sobre o mandato",
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
        // rc9 org (R222, R221): a carta do dono numa mudança de patamar; o contrato em vigor no dia da chegada.
        ownerTierUp: () => "Onde estamos agora",
        ownerTierDown: () => "Onde estamos agora",
        sponsorInherited: (p: Record<string, string | number>) => `${p.name}: o contrato que você herda`,
        orgTierUp: (p: Record<string, string | number>) => `A ${p.org} sobe para o patamar ${({ elite: "elite", contender: "candidato", mid: "meio de tabela", underdog: "azarão" } as Record<string, string>)[String(p.to)] ?? p.to}`,
        orgTierDown: (p: Record<string, string | number>) => `A ${p.org} cai para o patamar ${({ elite: "elite", contender: "candidato", mid: "meio de tabela", underdog: "azarão" } as Record<string, string>)[String(p.to)] ?? p.to}`,
      } as Record<string, (p: Record<string, string | number>) => string>,
      body: {
        boardPackage: () => "Três pacotes estão na sua mesa: cauteloso, esperado e ambicioso. Mais ambição traz mais verba e um bônus maior, e custa mais confiança se o objetivo não for cumprido.",
        boardWelcome: (p: Record<string, string | number>) =>
          `${p.manager}, bem-vindo à ${p.org}.${Number(p.seasons) === 1 ? ` A org é nova na RLCS: o primeiro elenco dela é da ${p.since}.` : ""}${Number(p.seasons) > 1 ? ` A org disputou ${p.seasons} temporadas da RLCS, a primeira na ${p.since}${Number(p.top) > 0 ? `, ${p.top} delas entre os times mais fortes da região` : ""}.` : ""} Você assume ${({ elite: "uma org de elite", contender: "uma candidata", mid: "uma org de meio de tabela", underdog: "uma azarã" } as Record<string, string>)[String(p.tier)] ?? "a org"}. O mandato da diretoria para a temporada está na sua mesa.`,
        boardMandate: (p: Record<string, string | number>) =>
          `${p.demandWord}. Classificação: ${p.cls}${swingPt(p.clsHit, p.clsMiss)}. Dinheiro: ${p.money}${swingPt(p.moneyHit, p.moneyMiss)}. Elenco: ${p.squad}${swingPt(p.squadHit, p.squadMiss)}. Os passos de orçamento e os bônus estão na página da Diretoria.`,
        boardMandateReport: (p: Record<string, string | number>) =>
          `Classificação: ${p.cls}, ${p.clsDone} de ${p.clsTarget} (${Number(p.clsOk) === 1 ? "cumprida" : Number(p.clsOk) === 0 ? "fora de alcance" : "em aberto"}). Dinheiro: ${p.money} (${Number(p.moneyOk) ? "no caminho" : "atrasada"}). Elenco: ${p.squad} (${Number(p.squadOk) ? "no caminho" : "atrasada"}). A confiança da diretoria ${Number(p.delta) > 0 ? `subiu ${p.delta} e foi a` : Number(p.delta) < 0 ? `caiu ${Math.abs(Number(p.delta))} e foi a` : "segue em"} ${p.confidence}.`,
        boardMandateVerdict: (p: Record<string, string | number>) =>
          `Classificação ${Number(p.clsMet) ? "cumprida" : "perdida"}: ${p.cls}. Dinheiro ${Number(p.moneyMet) ? "cumprida" : "perdida"}: ${p.money}. Elenco ${Number(p.squadMet) ? "cumprida" : "perdida"}: ${p.squad}. A confiança da diretoria termina a temporada em ${p.confidence}.`,
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
        ownerTierUp: (p: Record<string, string | number>) =>
          `${p.manager}, acabei de sair da revisão da temporada. ${OWNER_UP_PT[String(p.to)] ?? ""} Aproveite hoje, porque amanhã a gente começa de novo.`,
        ownerTierDown: (p: Record<string, string | number>) =>
          `${p.manager}, a revisão terminou e não vou dourar a pílula. ${OWNER_DOWN_PT[String(p.to)] ?? ""} Você continua com o meu apoio. Me mostre na próxima temporada do que esse elenco é capaz.`,
        sponsorInherited: (p: Record<string, string | number>) =>
          `A ${p.org} já joga com um contrato com a marca ${p.name}. Ele foi assinado antes da sua chegada e vale até a semana ${p.endWeek} da temporada ${p.endSeason}. Paga ${p.base} toda segunda${p.bonus ? `, e mais ${p.bonus} se a meta for cumprida` : ""}.${Number(p.fines) ? " Se a meta não sair, a marca cobra multa." : ""} A meta está na mesa de Finanças. Quando o contrato acabar, a ${p.name} vai conversar com você sobre a renovação.`,
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
        action: "Fundar um clube",
      },
      takeover: {
        title: "Assumir uma org existente",
        body: "Um elenco real com contrato, um coach, um orçamento e uma diretoria com metas para cada temporada.",
        action: "Escolher uma org",
      },
      slotsFull: "Os três espaços de carreira estão ocupados. Apague um em Carreiras para começar outra.",
      openSaves: "Abrir Carreiras",
      savesHint: "Crie uma org nova ou assuma uma existente",
    },
    pick: {
      title: "Assumir uma org existente",
      kicker: (season: string) => `As orgs como estão na ${season}. Escolha uma para ler o dossiê.`,
      regions: "Região",
      orgs: "Organizações",
      rank: (rank: number, teams: number) => `${rank}º de ${teams}`,
      empty: (season: string) => `Nenhuma org desta região pode ser assumida na ${season}.`,
      fewOrgs: (n: number) => (n === 1 ? "Só uma org desta região pode ser assumida." : `Só ${n} orgs desta região podem ser assumidas.`),
      none: "Escolha uma org na lista para ler o dossiê.",
      back: "Voltar",
      allOrgs: "Todas as orgs",
      go: (org: string) => `Assumir a ${org}`,
      goShort: "Assumir",
      /** v2.2 ORGMODE-2027: uma org que volta da sua última lineup para completar a região. */
      returning: (season: string) => `De volta, vista pela última vez na ${season}`,
      // rc9 ORG-UI
      ask: {
        elite: "A diretoria cobra Majors e o Worlds",
        contender: "A diretoria cobra Majors e uma campanha no Worlds",
        mid: "A diretoria cobra a briga no regional",
        underdog: "A diretoria cobra crescimento nos regionais",
      } as Record<string, string>,
      problemNone: "Nada urgente",
      squadLabel: "Elenco",
    },
    dossier: {
      squad: "O elenco",
      coach: "Coach",
      noCoach: "Nenhum coach com contrato. Dá para contratar um desde o primeiro dia.",
      inherit: "O que você herda",
      cash: "Caixa",
      budget: "Orçamento da temporada",
      wages: "Salários por semana",
      ceiling: (amount: string) => `Teto ${amount}`,
      overCeiling: "Acima do teto da diretoria",
      grace: (n: number) => (n <= 1 ? "Sem ultimato na primeira temporada" : `Sem ultimato por ${n} temporadas`),
      noBoard: "A diretoria desta org define o plano no primeiro dia.",
      difficulty: "Dificuldade",
      manager: "Seu nome",
      // rc9 ORG-UI: o nome usado se o campo ficar em branco.
      managerHint: (name: string) => `Em branco, você começa como ${name}.`,
      // rc9 ORG-UI
      structure: "Estrutura",
      departments: "Departamentos",
      noDepartments: "Nenhum com equipe",
      sponsor: "Patrocínio em vigor",
      sponsorTerms: (weekly: string, ends: string) => `${weekly} por semana até ${ends}`,
      noSponsor: "Nenhum patrocinador com contrato",
    },
    splash: {
      kicker: "Primeiro dia no clube",
      title: (manager: string, org: string) => `${manager}, manager da ${org}`,
      ask: "O primeiro pedido da diretoria",
      action: "Ir para o QG",
    },
  },
  orgmode: {
    standing: "Prestígio",
    // rc9 ORG-UI (#272)
    budget: {
      when: (season: string, mondays: number) =>
        mondays > 1 ? `${season} · faltam ${mondays} segundas` : mondays === 1 ? `${season} · falta a última segunda` : `${season} · nenhuma segunda a lançar`,
      wagesTitle: "Folha salarial",
      wagesUnit: "por semana, elenco e coach",
      ceiling: (amount: string) => `Teto da diretoria: ${amount} por semana`,
      room: (amount: string) => `${amount} por semana de folga`,
      over: (amount: string) => `${amount} por semana acima do teto`,
      noCeiling: "Os donos não fixam teto.",
      sponsorNone: "Nenhum patrocínio ainda. Novas ofertas chegam a esta mesa quando o próximo split abrir.",
    },
    ops: {
      title: "Operações",
      // rc9 org (R220): estruturas que você amplia, departamentos com gente, o bootcamp de evento.
      running: "Custo fixo",
      perWeek: (amount: string) => `${amount} / semana`,
      dept: { facilities: "Estruturas", staff: "Departamentos", camps: "Bootcamp de evento" } as Record<string, string>,
      deptNote: {
        facilities: "Cada nível novo passa pela diretoria.",
        staff: "Recebem toda segunda. Monte ou feche cada um.",
        camps: "Um por split.",
      } as Record<string, string>,
      needs: (need: number, now: number) => `Pede confiança ${need} da diretoria (hoje ${now}).`,
      signs: "A diretoria aprova",
      frozen: "A diretoria congelou os investimentos nesta janela.",
      cantAfford: "Dinheiro insuficiente acima do piso.",
      upkeep: (amount: string) => `Manutenção de ${amount} por semana`,
      buy: "Ampliar",
      hire: "Montar equipe",
      release: "Fechar",
      run: "Fazer o bootcamp",
      saves: (split: string) => `Fechar economiza ${split} por split`,
      releaseTitle: (name: string) => `Fechar: ${name}`,
      releaseBody: (split: string, week: string) =>
        `A folha do departamento para a partir da próxima segunda: a org economiza ${split} por split (${week} por semana). Dá para montar a equipe de novo depois, pelo preço do momento.`,
      releaseConfirm: "Fechar",
      keep: "Manter",
      campUsed: "Já feito neste split",
      campActive: (date: string) => `Em vigor até ${date}`,
      campReady: "Pronto para fazer",
      allOwned: "Todas as estruturas estão completas",
      next: "Próxima ampliação",
      open: "Abrir operações",
      staffNone: "Nenhum departamento com equipe",
      // rc9 ORG-UI (#274)
      addsUpkeep: (amount: string) => `+${amount} por semana de manutenção`,
      weekly: "por semana",
    },
    club: {
      promotes: (pct: number, cap: number) =>
        `Uma promoção aumenta a base do orçamento e o teto da folha em ${pct}%, aumenta o que a diretoria espera e deixa a org contratar jogadores até ${cap}.`,
      top: (pct: number) => `No topo, a diretoria espera títulos. Uma queda corta a base do orçamento e o teto da folha em ${pct}%.`,
      opsTitle: "Operações",
    },
    words: {
      common: { rep: "Prestígio", reputation: "Prestígio" },
      // rc9 org (R222): o prestígio se sente, não se conta: nenhum número nas linhas de uma org estabelecida.
      goals: {
        reward: (n: number) => (n > 0 ? "Aumenta o prestígio da org na revisão" : "Nenhum prestígio em jogo"),
        missCost: (n: number) => (n > 0 ? "Se falhar, o prestígio da org cai" : "Nenhum prestígio em jogo"),
        noCost: "Nenhum prestígio em jogo",
        repRisk: (n: number) => (n > 0 ? "O prestígio da org exige, e cai se falhar" : "O prestígio da org exige"),
      },
      inserts: { fx: { rep: (n: number) => (n > 0 ? "O prestígio sobe" : n < 0 ? "O prestígio cai" : "O prestígio se mantém"), repLabel: "Prestígio" } },
      event: { digestRep: "Prestígio" },
      // rc9 org (R220): os nomes da prateleira do clube fundado, como o catálogo da org os chama.
      club: {
        unlockables: {
          peripherals: "Centro de treinamento, nível 1",
          monitors: "Centro de treinamento, nível 2",
          pcs: "Centro de treinamento, nível 3",
          perfCenter: "Centro de performance",
          bootcamp1: "Bootcamp de evento",
          bootcamp2: "Bootcamp de evento",
          psychologist: "Psicologia do esporte",
          assistant: "Desenvolvimento de jogadores",
          analyst: "Departamento de análise",
          physio: "Saúde e preparação física",
          brand: "Departamento comercial",
        },
      },
      ladder: {
        rung: {
          peripherals: "Centro de treinamento, nível 1",
          monitors: "Centro de treinamento, nível 2",
          pcs: "Centro de treinamento, nível 3",
          perfCenter: "Centro de performance",
          bootcamp1: "Bootcamp de evento",
          bootcamp2: "Bootcamp de evento",
          psychologist: "Psicologia do esporte",
          assistant: "Desenvolvimento de jogadores",
          analyst: "Departamento de análise",
          physio: "Saúde e preparação física",
          brand: "Departamento comercial",
        },
        hint: {
          peripherals: "Treino rende mais",
          monitors: "Treino rende mais",
          pcs: "Treino e buff de time",
          perfCenter: "O melhor treino e buff de time",
          bootcamp1: "Química e vantagem de rating",
          bootcamp2: "Química e vantagem de rating",
          psychologist: "+5 de Clutch, +5 de Consistência",
          assistant: "Reservas aprendem mais nos eventos",
          analyst: "Vantagem de rating nos playoffs",
          physio: "Menos risco de desgaste antes dos eventos",
          brand: "Propostas de patrocínio valem mais",
        },
      },
      toolbox: {
        refusal: { maxed: "Todas as estruturas estão completas.", locked: "Não está disponível nesta org." },
      },
      market: {
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
        // rc9 org (R220): as instalações e funções do clube fundado, com os nomes do catálogo da org.
        gear: { peripherals: "Centro de treinamento, nível 1", monitors: "Centro de treinamento, nível 2", pcs: "Centro de treinamento, nível 3", perfCenter: "Centro de performance" },
        gearDesc: {
          peripherals: "As salas de treino e a estrutura de scrims da org. +5% de treino.",
          monitors: "Uma segunda sala de treino e agenda de scrims em tempo integral. +5% de treino.",
          pcs: "O centro de treinamento completo, com servidores próprios. +10% de treino e vantagem para o time.",
          perfCenter: "Sala de análise, academia e sala de review no mesmo lugar. +15% de treino, a maior vantagem para o time.",
        },
        psychologist: "Psicologia do esporte",
        staff: {
          assistant: { title: "Desenvolvimento de jogadores", desc: "Treina os reservas: um reserva ganha 80% da experiência de série do time, em vez de 60%." },
          analyst: { title: "Departamento de análise", desc: "Estuda cada adversário de playoff: +0,75 de rating do time em toda rodada de playoff." },
          physio: { title: "Saúde e preparação física", desc: "Controla a carga de treino: um quarto a menos de risco de um jogador perder um evento por desgaste." },
          brand: { title: "Departamento comercial", desc: "Vende a org para as marcas: as novas propostas de patrocínio valem 15% a mais." },
        },
        bootcampT1: "Bootcamp de evento",
        bootcampT2: "Bootcamp de evento",
        line: { psychologist: "Psicologia do esporte", staff: "Departamentos" },
      },
      news: {
        feed: { subject: { rep: "Prestígio" } },
        // rc9 org (R220): a ampliação de uma estrutura e o bootcamp de evento, com as palavras da org.
        tpl: {
          gearBought: (p: Record<string, string | number>) => `${p.name}: ampliação concluída`,
          bootcampRun: () => "Bootcamp de evento concluído",
        },
        body: {
          gearBought: (p: Record<string, string | number>) => `${p.name} já está funcionando. Os jogadores treinam lá a partir desta semana.`,
        },
      },
      mail: {
        body: {
          unlock: (p: Record<string, string | number>) => `O prestígio da org traz um novo nível de patrocínio: ${p.name}. As ofertas desse nível chegam à mesa de Finanças.`,
        },
      },
      tour: {
        hub: { progress: { title: "Operações", body: "A org chega com as estruturas e os departamentos do patamar dela. Amplie uma estrutura ou monte um departamento quando o dinheiro e a diretoria permitirem." } },
        finances: { progress: { title: "Toque a org", body: "Estruturas e departamentos fazem o elenco evoluir e jogar melhor. A diretoria aprova cada ampliação." } },
      },
    },
    // rc9 org (R220): o catálogo da org (engine/career/orgCatalogue.ts), com nomes e explicações.
    org: {
      name: {
        trainingCentre: "Centro de treinamento",
        performanceCentre: "Centro de performance",
        deptDevelopment: "Desenvolvimento de jogadores",
        deptAnalysis: "Departamento de análise",
        deptPsychology: "Psicologia do esporte",
        deptHealth: "Saúde e preparação física",
        deptCommercial: "Departamento comercial",
        eventCamp: "Bootcamp de evento",
      } as Record<string, string>,
      about: {
        trainingCentre: "Onde o elenco treina todo dia: salas, estrutura de scrims e servidores.",
        performanceCentre: "Análise, academia e sala de review no mesmo prédio. O projeto mais caro da diretoria.",
        deptDevelopment: "Treinadores que trabalham com os reservas entre um evento e outro.",
        deptAnalysis: "Analistas que destrincham cada adversário de playoff.",
        deptPsychology: "Um psicólogo que prepara os jogadores para os jogos decisivos.",
        deptHealth: "Uma equipe que cuida da carga de treino e da saúde dos jogadores.",
        deptCommercial: "Gente que vende a org para as marcas.",
        eventCamp: "O elenco reunido no mesmo lugar antes de uma sequência de eventos.",
      } as Record<string, string>,
      /** O que cada departamento faz no jogo, com os números do motor. */
      deptEffect: {
        deptDevelopment: (pct: number) => `Um reserva ganha ${pct}% da experiência de série do time`,
        deptAnalysis: (rating: number) => `+${String(rating).replace(".", ",")} de rating do time em toda rodada de playoff`,
        deptPsychology: (clutch: number, consistency: number) => `+${clutch} de Clutch e +${consistency} de Consistência`,
        deptHealth: (pct: number) => `${pct}% a menos de risco de um jogador perder um evento por desgaste`,
        deptCommercial: (pct: number) => `As novas propostas de patrocínio valem ${pct}% a mais`,
      },
      levelEffect: (training: number, buff: number, rating: number) =>
        [training > 0 ? `+${training}% de treino` : "", buff > 0 ? `+${buff} ${buff === 1 ? "nível" : "níveis"} de buff do time` : "", rating > 0 ? `+${String(rating).replace(".", ",")} de rating do time` : ""].filter(Boolean).join(", "),
      level: (n: number, max: number) => `Nível ${n} de ${max}`,
      levelName: (name: string, n: number) => `${name}, nível ${n}`,
      notBuilt: "Ainda não existe",
      standard: "Já estava aqui quando você chegou",
      aboveStandard: "Feito na sua gestão",
      upgradeTo: (n: number) => `Ampliar para o nível ${n}`,
      // rc9 ORG-UI (#274)
      nextLine: (n: number, effect: string) => `O nível ${n} soma ${effect}`,
      complete: "Completo",
      staffed: "Com equipe",
      vacant: "Sem ninguém",
      staffIt: "Montar a equipe",
      closeIt: "Fechar o departamento",
      perWeek: (amount: string) => `${amount} por semana`,
      campFree: "Pago pelo patrocinador",
      boardSigns: (need: number) => `A diretoria aprova com confiança ${need}`,
    },
    // rc9 org (R222): o prestígio como palavra e o que ele muda, nunca um número.
    sense: {
      drift: {
        rising: "A cena vê a org acima do patamar dela. Uma temporada que cumpra o objetivo da diretoria leva a org a subir na revisão.",
        steady: "A org mantém o seu lugar na cena.",
        slipping: "A org está caindo abaixo do patamar dela. Mais uma temporada fraca e ela desce na revisão.",
      } as Record<string, string>,
      pull: (cap: number) => `Jogadores com rating até ${cap} aceitam vir`,
      expects: {
        elite: "A diretoria julga a temporada pelos Majors e pelo Mundial.",
        contender: "A diretoria espera Majors e uma briga pela vaga no Mundial.",
        mid: "A diretoria espera a briga nos regionais e um Major quando der.",
        underdog: "A diretoria espera ver a org crescer nos regionais.",
      } as Record<string, string>,
      patience: {
        demanding: "Uma meta perdida custa muita confiança da diretoria.",
        measured: "A diretoria pesa uma meta perdida contra a temporada inteira.",
        forgiving: "A diretoria dá tempo ao projeto.",
      } as Record<string, string>,
    },
    // rc9 org (R223): um resumo do dinheiro cujos números fecham (budget.orgMoneyOf).
    money: {
      title: "O dinheiro da temporada",
      cash: "Caixa hoje",
      commitments: "Ainda a pagar nesta temporada",
      payroll: "Salários do elenco",
      coach: "Coach",
      retainers: "Departamentos",
      upkeep: "Manutenção das estruturas",
      loan: "Parcelas de empréstimo",
      incomeToCome: "Receita ainda contratada",
      sponsor: "Patrocínio",
      fanbase: "Torcida",
      projectedEnd: "No fim da temporada",
      projectedNote: "Neste ritmo, sem contar prêmios e vendas de jogadores",
      // rc9 ORG-UI (#272): o valor fica na sua coluna; o rótulo não o repete.
      keepBack: {
        cashFloor: () => "Guardado em caixa pelo mandato da diretoria",
        transferCap: () => "Fora de alcance pelo limite de transferências da diretoria",
        none: () => "O plano da diretoria não fixa um piso de caixa",
      } as Record<string, (amount: string) => string>,
      freeToSpend: "Livre para gastar",
      short: "Abaixo do mandato",
      readMandate: "Ler o mandato",
      bonusIfMet: (amount: string) => `+${amount} se a meta for cumprida`,
      // rc9 ORG-UI (#272), segunda passada
      budgetLabel: "O orçamento da diretoria",
      pool: "Caixa e receitas ainda por vir",
      kept: "Guardado pelo mandato",
      budgetPaid: "A verba da diretoria, já no caixa",
      budgetProposed: "A verba da diretoria, paga quando você ler o mandato",
      gap: {
        pending: (budget: string) => `A diretoria deposita os ${budget} no caixa quando você ler o mandato.`,
        carried: (budget: string, opening: string) => `O caixa tem os ${budget} da diretoria e os ${opening} que a org já tinha.`,
        carriedAndSpent: (budget: string, opening: string, net: string) =>
          `O caixa tem os ${budget} da diretoria e os ${opening} que a org já tinha, menos ${net} gastos desde então.`,
        carriedAndEarned: (budget: string, opening: string, net: string) =>
          `O caixa tem os ${budget} da diretoria e os ${opening} que a org já tinha, mais ${net} que entraram desde então.`,
        spent: (budget: string, _opening: string, net: string) => `O caixa são os ${budget} da diretoria, menos ${net} gastos desde então.`,
        earned: (budget: string, _opening: string, net: string) => `O caixa são os ${budget} da diretoria, mais ${net} que entraram desde então.`,
        same: (budget: string) => `O caixa são os ${budget} da diretoria, intocados até agora.`,
        unknown: () => "A diretoria depositou a verba no caixa no começo da temporada. Desde então o caixa acompanha as receitas e os gastos.",
      } as Record<string, (budget: string, opening: string, net: string) => string>,
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
      peak: "Overall de pico",
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
  media: CAREER_MEDIA_PT, // v2.3 MEDIA
};
