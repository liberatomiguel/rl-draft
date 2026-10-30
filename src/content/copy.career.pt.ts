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
        ? `Abaixo do piso numa segunda-feira, o Investidor de emergência entra — e um parceiro de resgate reforça a receita${partnerRunPt(partnerWeeks)}.`
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
    return `Abaixo do piso de novo antes de quitar, o banco soma ao empréstimo — o prazo continua o mesmo${left > 0 ? ` (ele faz isso mais ${left === 1 ? "uma vez" : `${left} vezes`})` : ""}.`;
  }
  const term = Number(p.term) > 0 ? `, para quitar em até ${p.term} semanas` : "";
  const last = Number(p.loansLeft) === 1 ? " — o último que ele abre nesta carreira" : "";
  return Number(p.nextPartner)
    ? `Abaixo do piso numa segunda-feira, o banco abre um empréstimo emergencial${term}${last} — e um investidor reforça um pouco a receita${partnerRunPt(p.partnerRun)}.`
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
    ? `Neste ritmo (${p.net} por semana) as contas cobrem a dívida no dia — o saldo estaria em ${p.projected} na segunda do prazo. Mantenha assim, ou encerre agora com "Quitar tudo" em Finanças.`
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

export const CAREER_PT: CareerCopy = {
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
    title: "Funde sua organização",
    step: (n: number, total: number) => `Etapa ${n} de ${total}`,
    quickStart: "Início rápido",
    quickStartHint: "Aleatoriza tudo — dá para re-tintar as cores depois.",
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
    kitsHint: "Pares curados que sempre funcionam num escudo. Toque em um, ou monte o seu abaixo.",
    customColors: "Montar minhas cores",
    customColorsHide: "Esconder cores personalizadas",
    contrastHint: "Tons próximos demais da cor principal ficam desativados — um escudo precisa de contraste.",
    primaryColor: "Cor primária",
    secondaryColor: "Detalhe",
    identityBuff: "Identidade da org",
    identityBuffHint: "A especialidade da sua org — uma pequena vantagem coletiva.",
    regionTitle: "Região-sede",
    regionKicker: "Onde você joga define quem enfrenta — e quantas vagas de Worlds existem.",
    regionStrength: "Força do campo",
    regionSlots: (n: number) => `${n} vagas no Worlds`,
    regionRivals: "Rivais de peso",
    regionNote: "Mudar de região é desbloqueado mais adiante na carreira.",
    strengthDeep: "Campo profundo — o caminho difícil",
    strengthStrong: "Campo forte",
    strengthDeveloping: "Campo em formação — um caminho mais suave",
    rosterTitle: "Primeiras contratações",
    rosterKicker: "Três jogadores sem org. Um deles diz sim para a sua.",
    rosterProspects: "Promessas",
    rosterProspectsDesc: "Adolescentes com teto altíssimo. Exige paciência.",
    rosterJourneymen: "Rodados",
    rosterJourneymenDesc: "Os veteranos da cena. Prontos agora, sem margem de evolução.",
    rosterBalanced: "Equilibrado",
    rosterBalancedDesc: "Um pouco de agora, um pouco de depois.",
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
      if (r.deadlineWeeks === null) return `Sem dinheiro? ${head} — sem prazo: prêmios e vendas pagam.`;
      return `Sem dinheiro? ${head} — pague em até ${r.deadlineWeeks} ${r.deadlineWeeks === 1 ? "semana" : "semanas"} ou a carreira acaba.`;
    },
    // CAREER_LOAN.breachesToEnd 1: a primeira segunda abaixo do piso encerra a carreira — sem empréstimo.
    presetMoneyNoLoan: "Sem dinheiro, a carreira acaba.",
    // rc.34 review: a delegação do treino com que o preset começa (difficulty.presetTrainingModeOf,
    // CAREER_PLAN.modeByPreset) e se as copas são inscritas por você (as prefs do preset).
    presetHelp: (mode: "coach" | "approve" | "manual", autoCups: boolean): string =>
      `${{ coach: "Seu técnico cuida dos treinos.", approve: "Seu técnico propõe os treinos; você aprova.", manual: "Você planeja os treinos." }[mode]} ${autoCups ? "A inscrição nas copas é automática." : "Você escolhe cada copa."}`,
    summaryTitle: "A papelada",
    found: (org: string) => `Fundar ${org}`,
    founded: "EST. 2020",
    foundedSplash: "Um novo nome entra na cena.",
  },

  hub: {
    title: "QG",
    continue: "Continuar",
    continueTo: (label: string) => `Avançar — ${label}`,
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
    trainingWeek: "Semana de treino — o elenco ganha reps extras",
    thisWeek: "Esta semana",
    comingUp: "Vem por aí",
    quickActions: "Hoje no escritório",
    scrimCta: (opp: string) => `Scrim vs ${opp}`,
    scrimsLeft: (n: number) => (n === 1 ? "1 bloco de scrim restante na semana" : `${n} blocos de scrim restantes na semana`),
    scrimUnavailable: "Sem bloco de scrim disponível hoje",
    restDay: "Dia de descanso — o elenco recarrega",
    progression: "Próximo desbloqueio",
    emptyStateTitle: "Bem-vindo à bancada",
    emptyStateBody: "Seu primeiro torneio já está no calendário. Aperte Continuar quando estiver pronto.",
    // v0.3 avanço automático estilo FIFA
    play: "Avançar",
    pause: "Pausar",
    playHint: (label: string) => `Avançando — a seguir: ${label}`,
    skipToNext: "Pular adiante",
    // v0.3 painel do plantão de transferências
    transfersTitle: "Janela de transferências",
    transfersWire: "Plantão de transferências",
    transfersAll: "Todas as regiões",
    transfersEmpty: "Nenhuma troca registrada ainda — o plantão enche conforme a janela corre.",
    transfersFa: "Agente livre",
    transfersUser: "Sua movimentação",
    transfersShowAll: (n: number) => `Ver todas as ${n} trocas`,
    // v2.0 hub rebuild (R26)
    today: "Hoje",
    dayOf: (d: number, total: number) => `Dia ${d} de ${total}`,
    nextStop: (label: string, s: string) => `Próxima parada: ${label} · ${s}`,
    needsYou: "Precisa de você",
    nothingNeeded: "Nada pede decisão hoje — avance quando quiser.",
    canDo: "O que você pode fazer hoje",
    inviteTitle: (name: string) => `Convite: ${name}`,
    inviteBody: (day: string) => `Circuito comunitário, joga ${day}. Aceite para comprometer o elenco, ou passe e siga treinando.`,
    inviteAccept: "Aceitar convite",
    invitePass: "Passar",
    // RTW-05 (rc.33): elenco com menos de três — o relógio espera o terceiro jogador.
    squadShortKicker: "Elenco incompleto",
    squadShortTitle: "Contrate um jogador",
    squadShortBody: (n: number, event: string) =>
      `Só ${n} de 3 vagas estão preenchidas, e nenhum evento é disputado com time incompleto. O relógio espera antes de ${event} até um terceiro jogador assinar — um agente livre pode ocupar a vaga hoje, com ou sem janela.`,
    squadShortMarket: "Ir ao Mercado",
    squadShortSquad: "Elenco",
    contractsExpiring: (n: number) => (n === 1 ? "1 contrato termina nesta temporada — renove ou deixe vencer." : `${n} contratos terminam nesta temporada — renove ou deixe vencer.`),
    cashWarningCard: (weeks: number) => `O caixa acaba em cerca de ${weeks} semanas nesse ritmo.`,
    // ECO-02 (R46): o card cita a dívida que Finanças mostra.
    // rc.34: o empréstimo emergencial do banco e o prazo dele.
    backerOpen: (owed: string) => `Empréstimo emergencial em aberto — ${owed} a devolver ao banco.`,
    loanDue: (date: string, weeks: number) =>
      weeks <= 0
        ? `Vence nesta segunda (${date}).`
        : weeks === 1
          ? `Vence na próxima segunda, ${date}.`
          : `Vence em ${date} — faltam ${weeks} semanas. Premiações e vendas abatem parte dele no caminho.`,
    loanDueRule: deadlineRulePt,
    // rc.32 (M4): a linha do QG abaixo dele — o que significa a próxima quebra (rc.34: nextBreachParamsOf do fluxo).
    backerNextBreach: (p: Record<string, string | number>) => nextBreachPt(p),
    cards: {
      training: "Treino",
      trainingOn: "Sessão hoje. De segunda a sexta o elenco evolui.",
      trainingOff: "Sem sessão hoje — descanso ou preparação de jogo.",
      scrim: "Scrim",
      market: "Mercado",
      marketOpen: (n: number) => (n === 1 ? "Janela aberta — fecha amanhã" : `Janela aberta — fecha em ${n} dias`),
      marketClosed: (s: string) => `Janela fechada — abre ${s}`,
      finances: "Finanças",
      bootcamp: "Bootcamp",
      bootcampReady: "Há uma vaga de bootcamp neste split.",
      squad: "Elenco",
      squadLine: (ovr: number, chem: number) => `Média ${ovr} OVR · química ${chem}%`,
    },
    edges: "Suas vantagens",
    edgesEmpty: "Ainda sem vantagens — coaches, equipamentos e patrocínios abrem com reputação.",
    edgeCoach: (name: string, pct: number) => `${name} · ${pct > 0 ? "+" : ""}${pct}% de treino`,
    edgeGear: (name: string, pct: number) => `${name} · +${pct}% de treino`,
    edgePsych: "Psicólogo · +1 Clutch, +1 Consistência",
    edgeSharp: "Bootcamp Sharp · armado para o próximo oficial",
    edgeSponsor: (tier: number) => `Vantagens do patrocínio tier ${tier}`,
    autoplayOn: "Autoplay ligado — pausa na próxima parada",
    // rc.2 hub v3
    skipTo: (label: string) => `Pular até ${label}`,
    plusDay: "+1 dia",
    squadTitle: "Elenco",
    squadManage: "Gerenciar elenco",
    squadSub: "Reserva",
    squadCoach: "Técnico",
    squadNoCoach: "Sem técnico — contrate um no Mercado",
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
    trainingDelegate: "Delegar: o coach conduz",
    trainingDelegated: "O coach conduz",
    trainingCoachNone: "Sem coach — a base, ou o seu pacote pela metade",
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
    lastDay: "Último dia — o relógio espera a sua resposta.",
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
      sponsor: "Propostas de patrocínio",
    },
    noticeTitle: "Um aviso precisa de você",
    noticeBody: "Leia e confirme o aviso — o relógio anda depois disso.",
    trainingDecisionTitle: "O técnico tem um plano",
    trainingDecisionBody: "A proposta de treino do técnico espera a sua resposta.",
    sponsorDecline: "Sem acordo por agora",
    sponsorDeclineHint: "As marcas voltam no próximo split.",
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
    // rc.34 (UX-01d, decisão 6-A): a pergunta da semana sobre a vaga.
    nextRegional: (ordinal: number, week: number) => `Próxima regional (R${ordinal}, semana ${week})`,
    seatDirect: "vaga direta",
    seatQualifier: "qualificatória de sábado",
    seatPreview: "por enquanto — definida na segunda da semana",
    // rc.34 (UX-01e, HQ-CONTRACT H5): o dinheiro, só o lançado ou comprometido.
    financePerWeek: (amount: string) => `${amount} por semana`,
    financePayroll: "Próxima folha",
    financeGuaranteed: "Receita garantida",
    financeGuaranteedParts: (sponsor: string, partner: string, fans: string) =>
      `patrocínio ${sponsor} · parceiro ${partner} · torcida ${fans}`,
    financePartnerWeeks: (n: number) => (n === 1 ? "mais 1 semana" : `mais ${n} semanas`),
    financeDebt: "Dívida",
    financeDebtNone: "Nenhuma",
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
    title: "Caixa de entrada",
    unread: (n: number) => `${n} não lidas`,
    markAllRead: "Marcar tudo como lido",
    empty: "Nenhum e-mail. A mesa está quieta — por enquanto.",
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
      blockbusterBid: (p: Record<string, string | number>) => `BOMBA: ${p.org} querem ${p.player}`,
      sponsorOffers: () => `Propostas de patrocínio na sua mesa`,
      objectiveHit: (p: Record<string, string | number>) => `${p.name}: meta entregue`,
      objectiveMissed: (p: Record<string, string | number>) => `${p.name}: meta perdida`,
      contractExpiring: (p: Record<string, string | number>) => `${p.player} — contrato na última temporada`,
      // rc.34 (UX-06b): os lembretes antes de um jogador poder sair.
      contractReminder: (p: Record<string, string | number>) => `Contratos: ${p.weeks} semanas para ${p.players}`,
      bankLoan: (p: Record<string, string | number>) => `Empréstimo aprovado: ${p.amount}`,
      bankCleared: () => `Empréstimo bancário quitado`,
      cashWarning: (p: Record<string, string | number>) => `Alerta de caixa: ${p.weeks} semanas de fôlego`,
      qualifiedRegional: (p: Record<string, string | number>) => `Passou na qualificatória: ${p.event} está marcado`,
      missedRegional: (p: Record<string, string | number>) => `Fora na qualificatória — ${p.event} acontece sem você`,
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
      debtCleared: () => `Empréstimo emergencial quitado`,
      // DEV-02 (R48): o aposentado do próprio elenco — para onde ele foi.
      retiredToCoach: (p: Record<string, string | number>) => `${p.player} se aposenta — e vira treinador`,
      retiredLeaves: (p: Record<string, string | number>) => `${p.player} se aposenta das competições`,
      // rc.32 (ECONOMY-CONTRACT M3 / M4 / M8, provisório).
      foundingPartner: () => `Um parceiro fundador apoia a org`,
      foundingPartnerEnds: () => `O parceiro fundador se despede`,
      cashNotice: (p: Record<string, string | number>) => `Aviso de caixa: cerca de ${p.weeks} semanas de fôlego`,
      // Histórico do rc.32 (ECO-08 / ECO-12): nada os envia desde o rc.33 — ficam para a caixa de um save antigo.
      restructured: () => `O Investidor reestruturou a org`,
      listingOffer: (p: Record<string, string | number>) => `Proposta por ${p.player} — seu anúncio`,
    },
    body: {
      incomingBid: (p: Record<string, string | number>) =>
        `${p.org} formalizaram uma proposta de ${p.fee} por ${p.player}. Ela expira quando a janela fechar — aceite ou recuse na aba de negociações do Mercado.`,
      // rc.32 (Miguel, 30/10): o que é uma proposta Bomba, por que veio, o preço e o custo de recusar.
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} vieram com tudo: ${p.fee} por ${p.player}. Uma proposta Bombástica é um dos momentos roteirizados da temporada — uma org endinheirada atrás do jogador em torno de quem ela montou o time na história real — por isso paga ${p.mult === undefined ? "bem acima do" : `×${String(p.mult).replace(".", ",")} o`} valor de mercado dele. Recuse, ou deixe expirar, e ele fica${p.pct === undefined ? " — mas a próxima pedida de renovação dele pode subir." : `, mas a próxima pedida de renovação dele sobe ${p.pct}%.`}`,
      foundingPartner: (p: Record<string, string | number>) =>
        `Um parceiro local apoia os primeiros passos da org: ${p.base} por split (${p.pct}% da folha salarial de fundação), pagos junto com a folha de toda segunda-feira. A única exigência é disputar eventos, e não há luvas. Ele segue até o seu primeiro contrato de patrocínio — e pelo menos até o fim de ${p.through}, mesmo ao lado de um contrato assinado antes. Finanças mostra a linha dele à parte.`,
      foundingPartnerEnds: () =>
        `O ciclo do parceiro fundador acabou: a org já tem o próprio patrocínio e deixou as primeiras temporadas para trás. Daqui em diante as contas se apoiam em patrocínio, premiação e torcida.`,
      cashNotice: (p: Record<string, string | number>) =>
        `Um aviso do contador: com ${p.burn} de queima por semana, o saldo cobre mais ou menos ${p.weeks} segundas-feiras, e as contas fechariam abaixo do piso (${p.floor}) n${breachWhenPt(p)}. ${nextBreachPt(p)} Agora é a hora barata de agir: aceite uma boa proposta por um jogador, mire a premiação, segure a próxima renovação${Number(p.backer) ? "" : " ou prepare um empréstimo no banco"}.`,
      // Histórico do rc.32 (ECO-08 / ECO-12): nada os envia desde o rc.33 — ficam para a caixa de um save antigo.
      restructured: (p: Record<string, string | number>) =>
        `As contas fecharam de novo abaixo do piso (quebra ${p.n}), e o Investidor reestruturou a org${p.player ? `: ${p.player} foi vendido para ${p.org} por ${p.fee}, o valor de mercado dele${positive(p.garnished) ? ` (${p.garnished} foram para a dívida)` : ""}` : ""}. ${Number(p.rep) > 0 ? `Reputação −${p.rep}. ` : ""}${Number(p.granted) > 0 ? `O Investidor recompôs o saldo para ${p.rescueTo}` : `O saldo está em ${p.balance}`}; ${positive(p.owed) ? `a dívida é de ${p.owed}` : "não há dívida"}. O elenco segue jogando — o reserva sobe; uma vaga vazia pede um agente livre antes do próximo evento. ${legacyNextBreachPt(p.next)}`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} responderam ao seu anúncio: ${p.fee} por ${p.player}. Aceite na aba de negociações do Mercado antes de a janela fechar, ou recuse para mantê-lo — recusar encerra o anúncio.`,
      sponsorOffers: () =>
        `Marcas estão de olho na org. Avalie as propostas em Finanças — a base é garantida; o bônus depende da meta.`,
      objectiveHit: (p: Record<string, string | number>) =>
        `A meta do split foi entregue. O bônus de ${p.bonus} cai junto com o pagamento. Bom negócio.`,
      objectiveMissed: (p: Record<string, string | number>) =>
        `A meta do split escapou. Ninguém cobra dinheiro de volta — mas faltas repetidas derrubam o tier da renovação. (Faltas até aqui: ${p.misses}.)`,
      contractExpiring: (p: Record<string, string | number>) =>
        `${p.player} está na última temporada de contrato. Você tem janela exclusiva de renovação até o fim do Split 3 — depois disso, ele sai de graça.`,
      contractReminder: (p: Record<string, string | number>) =>
        `${p.players} — ainda sem contrato depois desta temporada, com ${p.weeks} semanas pela frente. Renove no Elenco antes da virada, ou eles saem como agentes livres (a revisão antes da nova temporada lista todos).`,
      bankLoan: (p: Record<string, string | number>) =>
        `O banco liberou ${p.amount}. Parcelas de ${p.weekly} caem toda segunda-feira até quitar ${p.total}. Gaste em algo que se pague.`,
      bankCleared: () =>
        `A última parcela foi paga. A linha de crédito está aberta de novo, se a org precisar.`,
      // rc.32 (M4, provisório): toda segunda com ≤ 4 semanas — a quebra projetada e a saída.
      cashWarning: (p: Record<string, string | number>) =>
        p.breachWeek === undefined
          ? `A ${p.net} por semana, o saldo cobre mais ou menos ${p.weeks} segundas-feiras. Corte salários, ganhe premiação ou negocie um empréstimo antes que as contas rompam o piso.`
          : `Com ${p.burn} de queima por semana, o saldo cobre mais ou menos ${p.weeks} segundas-feiras; nesse ritmo as contas fecham abaixo do piso (${p.floor}) n${breachWhenPt(p)}. ${nextBreachPt(p)} Saídas: aceitar uma boa proposta por um jogador, ganhar premiação, enxugar a folha na renovação${Number(p.backer) ? "" : " ou pegar um empréstimo no banco"}.`,
      qualifiedRegional: (p: Record<string, string | number>) =>
        `O Swiss de sábado acabou e a org está entre os oito classificados. ${p.event} é no domingo — os oito diretos esperam.`,
      missedRegional: (p: Record<string, string | number>) =>
        `Três derrotas no Swiss de sábado — o ${p.event} acontece no domingo sem você. Descanse; segunda começa uma nova semana de treino.`,
      // HISTÓRICO (rc.32–rc.33): o e-mail de resgate do Investidor, como saiu (o rc.34 envia emergencyLoan).
      backerIn: (p: Record<string, string | number>) =>
        p.rescueTo === undefined
          ? `As contas romperam o piso e o Investidor de emergência entrou — uma única vez. O pagamento sai descontado da premiação. Um segundo colapso encerra a org.`
          : `As contas fecharam uma segunda-feira abaixo do piso${Number(p.n) > 1 ? ` pela ${ordinalPt(Number(p.n))} vez` : ""} e o Investidor de emergência entrou: o saldo voltou a ${p.rescueTo}${Number(p.weeks) > 0 ? ` (cerca de ${p.weeks} semanas de salários)` : ""}. A dívida é de ${p.owed} — ${p.garnishPct}% de cada premiação e metade de qualquer venda vão para ela até quitar, ou abata em Finanças. Enquanto ela existir, taxas de transferência, equipamentos${Number(p.lock) ? " e novos compromissos que encurtam o fôlego" : ""} ficam suspensos.${positive(p.partnerWeekly) ? ` Um parceiro de resgate, o ${p.partnerName}, entra junto: ${p.partnerWeekly} por semana a partir da próxima segunda, por ${p.partnerWeeks} semanas — o último pagamento n${partnerUntilPt(p)}. É receita, nunca descontada; Finanças o mostra enquanto durar.` : ""} ${legacyNextBreachPt(p.next, p.nextPartner, p.partnerRun)}`,
      // rc.34 (Miguel, 31/10): o empréstimo emergencial do banco — por quê, quanto, como se paga,
      // até quando, o investidor se veio junto, e o que encerra a carreira.
      emergencyLoan: (p: Record<string, string | number>) =>
        `As contas fecharam uma segunda-feira abaixo do piso (${p.floor}), e o banco entrou com um empréstimo emergencial de ${p.lent}: o saldo voltou a ${p.rescueTo}${Number(p.weeks) > 0 ? ` (cerca de ${p.weeks} semanas de salários)` : ""}. A dívida é de ${p.owed}, juros incluídos. ${p.garnishPct}% de cada premiação e ${p.salePct}% de qualquer venda abatem a dívida automaticamente; o resto você paga em Finanças quando quiser.${p.dlWeek !== undefined ? ` O prazo é ${mondayWhenPt(p.dlWeek, p.dlAhead)}. ${deadlineRulePt}` : ""}${loansLeftPt(p) ? ` ${loansLeftPt(p)}` : ""}${positive(p.partnerWeekly) ? ` Um investidor, o ${p.partnerName}, entra junto com este primeiro empréstimo: ${p.partnerWeekly} por semana a partir da próxima segunda, por ${p.partnerWeeks} semanas — o último pagamento n${partnerUntilPt(p)}. É receita, nunca descontada.` : ""} ${Number(p.lock) ? "Enquanto houver dívida, taxas de transferência, equipamentos e novos compromissos que encurtam o fôlego ficam suspensos." : "Nada fica travado enquanto você deve: contratações, taxas e equipamentos seguem liberados."} ${nextBreachPt(p)}`,
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
        `O Investidor de emergência saiu de cena: o banco assumiu o que você devia a ele, ${p.owed}, como um empréstimo emergencial.${p.dlWeek !== undefined ? ` O prazo é ${mondayWhenPt(p.dlWeek, p.dlAhead)} — daqui a ${p.dlWeeks} semanas. ${deadlineRulePt}` : ""} ${p.garnishPct}% de cada premiação e ${p.salePct}% de qualquer venda continuam abatendo a dívida automaticamente, e Finanças aceita qualquer pagamento. ${Number(p.lock) ? "" : "Nada fica mais travado enquanto você deve: contratações, taxas e equipamentos estão liberados. "}${nextBreachPt(p)}`,
      unlock: (p: Record<string, string | number>) =>
        `O progresso da org desbloqueou: ${p.name}. Confira a trilha de progressão no Clube — o arsenal cresce com a reputação.`,
      windowReport: (p: Record<string, string | number>) =>
        `A janela fechou — ${p.n} trocas em todas as regiões. Taxas de destaque: ${p.p1} (${p.f1})${p.p2 ? ` · ${p.p2} (${p.f2})` : ""}${p.p3 ? ` · ${p.p3} (${p.f3})` : ""}. O plantão completo está no QG.`,
      unavailable: (p: Record<string, string | number>) =>
        `${p.player} não joga ${p.event} — o reserva assume a vaga com a química dele.`,
      // rc.34 review: com o que a próxima quebra faz (o último empréstimo da carreira quitado: o fim) — um e-mail antigo lê como saiu.
      debtCleared: (p: Record<string, string | number> = {}) =>
        `O empréstimo emergencial está quitado, e o prazo deixou de existir — a org volta a ser dona do próprio futuro. ${p.next === undefined ? "A porta do banco segue aberta." : nextBreachPt(p)}`,
      retiredToCoach: (p: Record<string, string | number>) =>
        `${p.player} jogou sua última temporada e deixa as competições — direto para a carreira de treinador. Ele já está no grupo de técnicos e pode aparecer na lista de treinadores.`,
      retiredLeaves: (p: Record<string, string | number>) =>
        `${p.player} jogou sua última temporada e deixa a cena de vez. A vaga está aberta — o mercado é onde começa o próximo capítulo.`,
    },
  },

  // Scrims v0.2 — blocos de dia útil entre eventos. v0.3: agendáveis, escolha
  // de adversário, resultados visíveis.
  scrim: {
    title: "Bloco de scrim",
    desc: "Uma MD5 de portas fechadas: reps de química e desenvolvimento leve. Dois blocos por semana.",
    vs: (opp: string) => `vs ${opp}`,
    run: "Rodar scrim",
    won: (opp: string, a: number, b: number) => `Scrim V ${a}-${b} vs ${opp}`,
    lost: (opp: string, a: number, b: number) => `Scrim D ${a}-${b} vs ${opp}`,
    usedUp: "Sem blocos de scrim restantes nesta semana",
    restDay: "Nada de scrim em dia de descanso",
    squadShort: "Sem scrim com menos de três jogadores — contrate um terceiro antes.",
    // v0.3 agendamento + resultados
    planTitle: "Parceiros de treino",
    planDesc: "Escolha o adversário e o dia — scrims agendadas rodam sozinhas e aparecem no calendário.",
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
      easier: "Reps de química e vitória provável — pouco XP.",
      even: "Um teste de verdade. XP padrão.",
      harder: "Sparring mais forte desenvolve mais rápido — espere perder.",
    } as Record<string, string>,
    moreOpponents: "Mais adversários",
    fewerOpponents: "Menos adversários",
  },

  calendar: {
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
    advanceToStop: (label: string) => `Continuar — ${label}`,
    seasonEnd: "Fim da temporada",
    showWorld: "Mostrar outras regiões",
    hideWorld: "Só a minha agenda",
    worldEvents: "Pelo mundo",
  },

  squad: {
    title: "Elenco",
    starters: "Titulares",
    bench: "Banco",
    subSlot: "Substituto",
    coachSlot: "Coach",
    staffRow: "Staff & boosts",
    hire: "Contratar",
    emptySub: "Sem sub — ninguém fica de fora sem ele, mas um reserva dá profundidade ao rating do time.",
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
        ? "1 contrato termina com esta temporada. Renove no Elenco, ou deixe acabar — ele sai na virada."
        : `${n} contratos terminam com esta temporada. Renove no Elenco, ou deixe acabar — eles saem na virada.`,
    reviewRenew: "Renovar no Elenco",
    reviewConfirm: (n: number) => (n === 1 ? "Deixar sair" : `Deixar os ${n} saírem`),
    reviewDone: "Revisado — eles saem na virada.",
    reviewHeld: "Uma decisão ainda espera no QG — responda antes da nova temporada.",
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
    renewalBoundFresh: "Abaixo do teto — ele renova pelo valor de mercado.",
    renewalBoundCap: (cap: string) => `No teto de ×${cap} o salário atual.`,
    renewalBoundFloor: (floorPct: number) => `Segurado em ${floorPct}% do valor de mercado.`,
    renewalBoundJump: (jump: string) => `Segurado em ×${jump} o salário atual — o máximo que uma renovação sobe.`,
    renewalTitles: (pct: number) => `+${pct}% pelos títulos que ele ganhou com você nas últimas temporadas.`,
    renewalAmbition: (pct: number) => `+${pct}% de ambição: um craque num clube menor pede mais.`,
    renewalBlockbuster: (pct: number) => `+${pct}%: você recusou uma proposta bombástica por ele.`,
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
    title: "Treinos",
    autoTrain: "Delegar ao coach",
    autoTrainDesc: "O coach define o foco de cada jogador e reporta os resultados.",
    handledByCoach: "Definido pelo coach",
    manageMyself: "Quero cuidar disso",
    focus: "Foco",
    balanced: "Equilibrado",
    auto: "Auto",
    coachEffect: (name: string, pct: number) => `Coach ${name}: ${pct > 0 ? "+" : ""}${pct}% de eficiência`,
    noCoach: "Sem coach — o desenvolvimento roda abaixo do ritmo.",
    facilityEffect: (pct: number) => `Equipamentos: +${pct}% de eficiência`,
    projection: (v: string) => `+${v} OVR neste split`,
    matchXpHint: "Jogar contra campos fortes desenvolve mais que qualquer treino.",
    report: (delta: string) => `Relatório de treinos: elenco ${delta} OVR`,
    // v0.2 — focos com identidade, intensidade, ritmo semanal
    weeklyPlan: "Plano semanal",
    weeklyPlanHint: "Sessões de segunda a sexta. Fim de semana é dia de jogo.",
    perWeekOverall: (v: string) => `+${v} OVR / semana`,
    perWeekOffset: (v: string, stat: string) => `+${v} ${stat} / semana`,
    focusHintBalanced: "Crescimento puro de overall — nada afiado.",
    focusHintAttr: "Troca uma fatia do crescimento de overall para afiar um atributo.",
    focusHintAuto: "O coach escolhe a ênfase da semana — quase ótimo, sem esforço.",
    intensity: "Intensidade",
    intensityLight: "Leve",
    intensityNormal: "Normal",
    intensityHeavy: "Pesada",
    intensityLightHint: "-40% de desenvolvimento, zero risco de fadiga.",
    intensityNormalHint: "O bloco padrão.",
    intensityHeavyHint: "+35% de desenvolvimento — adiciona um pequeno risco (avisado) de ausência antes de eventos.",
    fatigueWarning: "Sessões pesadas aumentam o risco de ausência pré-evento",
    sessionToday: "Sessão de hoje",
    noSessionToday: "Sem sessão hoje",
    // rc.34 (DEV-03 §4b): o motor treina a semana comprometida com meia carga (matchPrepShare) — o texto dizia que pausava.
    matchPrepWeek: "Semana de jogo — sessões com meia carga; o evento paga XP de partida por cima",
    // v2.0 training rework (R27–R29)
    drillTitle: "Treino da semana",
    drillHint: "Um treino coletivo por semana: todo mundo afia o atributo do treino além do próprio foco, e as sessões rendem um pouco mais.",
    drillNone: "Sem treino definido — as sessões seguem o plano base.",
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
      "mechanics-lab": "Controle aéreo, flip resets, velocidade — o atributo do high roll.",
      rotations: "Disciplina no back-post e shadow — defesa.",
      "set-plays": "Kickoffs, passes, pressão — ataque.",
      "film-room": "Revisão de VOD e cenários — consistência e experiência.",
      "clutch-sets": "Cenários de jogo 7 sob pressão — clutch.",
    } as Record<string, string>,
    growth: "Evolução",
    nextPoint: (ovr: number) => `Próximo: ${ovr} OVR`,
    etaDays: (days: number) => (days === 1 ? "≈ 1 dia de treino" : `≈ ${days} dias de treino`),
    etaNone: "Parado — no teto do período ou no potencial",
    etaAtPotential: "No potencial — não há mais o que aprender aqui",
    capLine: (split: string, splitMax: number, season: string, seasonMax: number) =>
      `Neste split +${split} de ${splitMax} · temporada +${season} de ${seasonMax}`,
    // rc.32 (DEV-01): o contrato de evolução tem só o teto da temporada, um auge e um declínio.
    capLineSeason: (season: string, seasonMax: number) => `Nesta temporada +${season} de ${seasonMax}`,
    etaAtPeak: "No auge — ele segura esse nível por enquanto",
    declineLine: (perWeek: string) => `Passou do auge: cerca de −${perWeek} OVR por semana`,
    effectsTitle: "O que seus atributos fazem",
    effectsHint: "Linha de atributos do time → os modificadores exatos que a simulação aplica. Treine o que seus resultados pedem.",
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
    plan: {
      title: "Plano de treino",
      periodOf: (n: number, count: number) => `Período ${n} de ${count}`,
      dayOf: (day: number, len: number) => `Dia ${day} de ${len}`,
      daysLeft: (n: number) => (n === 1 ? "falta 1 dia" : `faltam ${n} dias`),
      runsTo: (date: string, days: number) => `Vai até ${date} · ${days === 1 ? "1 dia" : `${days} dias`}`,
      base: "Crescimento base",
      baseHint: "Sem pacote: cada jogador cresce na base — os dias de treino mais as séries que joga. Nunca uma penalidade.",
      by: { coach: "Montado pelo coach", user: "Montado por você", base: "Sem pacote" } as Record<string, string>,
      objective: "Objetivo",
      objectives: { development: "Desenvolvimento", preparation: "Preparação competitiva", recovery: "Recuperação" } as Record<string, string>,
      objectiveHint: {
        development: "Crescimento mais rápido rumo ao pico esperado de cada jogador, e os atributos do foco.",
        preparation: "Química e scrims mais afiados para os eventos do período — pouco crescimento extra.",
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
      scrimDaysHint: "Terça, quinta e quarta para um terceiro — nunca em dia de jogo. Só treino: sem pontos, prêmios ou reputação.",
      levels: { easy: "Fácil", even: "Equilibrado", hard: "Difícil", auto: "O coach escolhe" } as Record<string, string>,
      levelHint: {
        easy: "Confiança (+consistência) e menos desgaste; pouco crescimento.",
        even: "Sinergia: a maior química, um retorno moderado.",
        hard: "O maior aprendizado, mais desgaste e risco.",
        auto: "O nível que o objetivo pede.",
      } as Record<string, string>,
      tweaks: "Ajustes por jogador",
      tweaksHint: "Opcional — só os jogadores que fogem do plano do elenco.",
      followSquad: "Segue o elenco",
      rest: "Descanso",
      restHint: "Treina na base, sem scrims, sem desgaste.",
      tweakFocus: (stat: string) => `Foco próprio: ${stat}`,
      tweakWorkload: (w: string) => `carga ${w.toLowerCase()}`,
      ownFocus: "Foco próprio",
      ownLoad: "Carga própria",
      carryHint: "O seu antigo foco e intensidade por jogador entram como ajustes.",
      projection: "O que este pacote faz",
      projectionHint: "Lido do motor que o executa — sessões e scrims até o fim do período. As séries oficiais vêm por cima.",
      perPlayer: (gain: string) => `+${gain}`,
      startersAvg: (gain: string) => `Titulares ≈ +${gain} OVR neste período`,
      wearLine: (wear: string, pts: string) => `Desgaste ${wear} · +${pts} pts de risco de ausência antes de cada evento`,
      noWear: "Sem desgaste — sem risco extra de ausência",
      daysLine: (sessions: number, scrims: number) =>
        `${sessions === 1 ? "1 sessão" : `${sessions} sessões`} · ${scrims === 1 ? "1 scrim" : `${scrims} scrims`}`,
      apply: "Aplicar",
      applyHint: (date: string) => `Vale de ${date} até o fim do período, e se repete com "Repetir" ligado.`,
      useProposal: "Carregar o plano do coach",
      keepBase: "Manter a base",
      edit: "Ajustar",
      cancel: "Cancelar",
      mode: "Quem decide",
      modes: { coach: "O coach conduz", approve: "O coach propõe", manual: "Eu monto" } as Record<string, string>,
      modeHint: {
        coach: "Ele monta e renova a cada período; as exceções aparecem no relatório, nunca como uma parada.",
        approve: "A cada período o plano dele espera um toque: aprovar, ajustar ou manter a base.",
        manual: "Você monta o pacote; a proposta dele está a um toque.",
      } as Record<string, string>,
      noCoachMode: "Ainda sem coach: todo modo roda a base ou o seu pacote repetido, e nada pede resposta.",
      repeat: "Repetir até eu mudar",
      repeatHint: "O pacote roda de novo no próximo período.",
      proposalTitle: (name: string) => `O plano de ${name} para este período`,
      proposalReason: {
        default: "Desenvolvimento por padrão.",
        event: "Um Major ou o Mundial cai neste período — preparação primeiro.",
        wear: "O desgaste foi alto no último período — recuperação primeiro.",
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
      historyEmpty: "Nenhum período fechado ainda — o primeiro relatório chega quando o próximo período começar.",
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
        coachFired: (p: Record<string, string | number>) => `${p.coach} saiu — o plano seguiu no ritmo sem coach`,
        objectiveChange: () => "O objetivo mudou no meio do período",
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
    windowClosed: "Mercado fechado",
    windowClosedHint: (label: string) => `A janela de transferências abre ${label}`,
    scoutingOpen: "A observação segue aberta entre janelas.",
    // RTW-05 (rc.33): um elenco com menos de três contrata um agente livre para a vaga vazia, com ou sem janela.
    emptySeatOpen: "Seu elenco tem menos de três: um agente livre pode ocupar a vaga vazia hoje, com ou sem janela.",
    emptySeatCheapest: (name: string, wage: string) =>
      `Sem dinheiro? ${name} (${wage} / semana), o agente livre mais barato que você pode contratar, sempre ocupa a vaga vazia.`,
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
    lengthLabel: "Duração do contrato",
    seasons: (n: number) => (n === 1 ? "1 temporada" : `${n} temporadas`),
    starter: "Titular",
    sub: "Reserva",
    signCta: "Contratar",
    offerSent: "Negócio registrado — resolve no próximo avanço.",
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
      `Uma proposta Bombástica é um dos momentos roteirizados da temporada: ${org} paga ×${mult.replace(".", ",")} o valor de mercado dele e, se você recusar ou deixar expirar, ele fica, mas a próxima renovação dele pede ${pct}% a mais.`,
    consequences: "Depois deste negócio",
    balanceAfter: (s: string) => `Saldo após: ${s}`,
    // rc.32 (M4, provisório): o fôlego que a contratação deixa.
    runwayAfter: (weeks: number | null) =>
      weeks === null
        ? "Fôlego depois: as contas seguem no azul"
        : `Fôlego depois: ${weeks === 1 ? "1 semana" : `${weeks} semanas`} com a nova queima`,
    // ECO-02 (R46): uma venda com o Investidor em aberto — a parte dele na taxa.
    saleBackerRepaid: (s: string) => `Abatido do empréstimo emergencial: ${s}`,
    // ECO-03 (R47): a vaga é definida depois da contratação e nunca muda o preço.
    slotLabel: "Vaga no elenco",
    slotStarter: "Assume uma vaga aberta no trio titular.",
    slotReserve: "Entra como reserva. Promova-o na tela de Elenco quando quiser — o contrato não muda.",
    samePrice: "Mesmo preço de um titular: a vaga nunca muda o contrato.",
    // rc.33 (UX-07): elenco cheio só avisa e leva ao Elenco; a contratação espera uma vaga livre.
    squadFullWarn: (cap: number) =>
      `Seu elenco está cheio (${cap} de ${cap}). Dispense ou venda um jogador na tela de Elenco e depois contrate.`,
    toSquad: "Ir para o Elenco",
    // DEV-02 (R48): uma contratação cuja temporada atual tem de ser a última.
    finalSeasonDeal: "Última temporada: ele se aposenta ao fim desta temporada — só contrato de 1 temporada.",
    payrollWeek: (now: string, after: string) => `Folha: ${now} → ${after} / semana`,
    coachEffects: "O que este coach faz",
    // rc.34 (DEV-03 T4): o efeito dele chega pelo pacote do período — sem pacote = a base, com ou sem coach.
    coachTraining: (pct: number) => `+${pct}% num pacote de Desenvolvimento`,
    coachRating: (n: number) => `+${n} de rating do time em toda série`,
    coachNoneEffects: (pct: number) =>
      `Sem coach: o crescimento segue na base como sempre, e um pacote de treino rende metade (+${pct}% em Desenvolvimento).`,
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
    shopHimHint: "Sinaliza disponibilidade — espere propostas na próxima janela.",
    quickFlipWarning: "Contratado há pouco — vende com deságio.",
    // v0.2 — mercado de coaches + ferramentas de busca
    coaches: "Coaches",
    coachRealTag: "Ex-pro",
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
    filterSignable: "Contratáveis com minha reputação",
    viewSheet: "Ver ficha",
    noResults: "Nenhum jogador com esses filtros.",
    dealsEmpty: "Nenhuma negociação ativa. Propostas chegam aqui com a janela aberta.",
    // v0.3 contratações travadas por reputação (cadeado visível)
    lockedAtRep: (rep: number) => `Assina com ${rep} de reputação`,
    lockedHint: "Jogadores desse nível ainda não topam a org — a reputação abre essa porta.",
    coachLockedAt: (rep: number) => `Contratar coach desbloqueia com ${rep} de reputação`,
    // rc.33 (ECO-10 + ECO-11): a negociação do contrato — duas alavancas, a faixa à vista, uma resposta.
    negotiation: {
      title: "Negociação do contrato",
      perWeek: "/ semana",
      fullAsk: "Pagar a pedida",
      wage: "Salário semanal",
      share: "Parte do prêmio",
      shareHint: "A fatia dele em cada prêmio de pódio do time (top 4 de um regional, Major ou Worlds).",
      shareAsk: (pct: number) => `Ele pede ${pct}%`,
      trade: (perWeek: string) => `Cada ponto de parte que você dá vale ${perWeek} por semana do salário dele.`,
      wageDown: "Baixar o salário semanal",
      wageUp: "Subir o salário semanal",
      shareDown: "Baixar a parte do prêmio",
      shareUp: "Subir a parte do prêmio",
      zone: (floor: string, top: string) => `Com essa parte ele assina de ${floor} a ${top} por semana.`,
      zoneFixed: (top: string) => `Com essa parte ele só assina pela pedida, ${top} por semana.`,
      signs: (wage: string, pct: number) => `Ele assina: ${wage} / semana + ${pct}% dos prêmios de pódio`,
      // rc.34 (front I): um contrato sem parte do prêmio (ele não pede, ou a negociação levou a 0 %).
      signsNoShare: (wage: string) => `Ele assina: ${wage} / semana, sem parte do prêmio`,
      counter: (wage: string, pct: number) => `Abaixo do piso dele — contraproposta: ${wage} / semana com ${pct}%`,
      counterNoShare: (wage: string) => `Abaixo do piso dele — contraproposta: ${wage} / semana`,
      // rc.34 (front I): por que uma alavanca para, embaixo do botão que ela trava (contract.TalkLimits).
      why: {
        floor: "Piso dele",
        minimum: "Mínimo da liga",
        ask: "Pedida cheia",
        shareLeast: "O mínimo que ele aceita",
        shareMost: "O máximo que ele aceita",
        shareMinimum: "Salário no mínimo",
        noShare: "Sem parte",
      },
      takeCounter: "Aceitar a contraproposta",
      saves: (s: string) => `${s} / semana abaixo da pedida`,
      costs: (s: string) => `${s} / semana acima da pedida, por uma parte menor`,
    },
    errors: {
      windowClosed: "A janela de transferências está fechada.",
      alreadySigned: "Já está no elenco.",
      squadFull: "Elenco cheio — dispense ou venda antes.",
      unavailable: "Jogador indisponível.",
      funds: "Caixa insuficiente para este negócio.",
      loanActive: "Sem transferências com taxa enquanto houver dívida do empréstimo emergencial.",
      bankActive: "Um empréstimo bancário por vez — quite o atual primeiro.",
      bankBacker: "O banco não faz outro empréstimo enquanto o emergencial estiver aberto — quite esse primeiro.",
      bankAmount: "Informe um valor válido.",
      bankLimit: "Acima do que o banco oferece para a sua reputação.",
      unknown: "Esse negócio não está mais disponível.",
      locked: "Bloqueado por enquanto.",
      maxed: "Já está no máximo.",
      used: "Já utilizado.",
      restDay: "Não em dia de descanso.",
      squadShort: "Sem scrim com menos de três jogadores — contrate um terceiro antes.",
      blocked: "Agora não.",
      none: "Nada a fazer.",
      invalid: "Seleção inválida.",
      repGate: "A reputação da org ainda é baixa para um jogador desse nível.",
      // rc.33 (ECO-11): uma oferta abaixo do piso dele — a ficha mostra a contraproposta.
      negotiationCounter: "Isso está abaixo do piso dele — aceite a contraproposta ou suba a oferta.",
      sameDay: "Vocês já treinaram contra esse time hoje.",
      rosterLocked: "Mudanças no elenco só depois do fim do evento.",
      /** DEV-02 (R48): a idade mínima para competir. */
      tooYoung: "Jovem demais para competir — jogadores assinam a partir dos 13 anos.",
      /** rc.32 (M4, provisório): a trava do Investidor sobre compromissos que encurtam o fôlego. */
      loanRunway: "Enquanto houver dívida do empréstimo emergencial, nada que encurte o fôlego — quite o empréstimo ou libere salários antes.",
    },
  },

  finances: {
    title: "Finanças",
    balance: "Saldo",
    net: "Líquido / semana",
    projected: "Projeção após segunda-feira",
    weeklyStatement: "Extrato semanal",
    statementHint: "Toda segunda-feira o caixa se move: patrocínio e torcida entram; salários, staff, manutenção e parcelas saem.",
    runway: (weeks: number) => (weeks === 1 ? "Fôlego: 1 semana nesse ritmo" : `Fôlego: ${weeks} semanas nesse ritmo`),
    runwayOk: "As contas fecham no azul",
    nextPayday: (s: string) => `Próximo pagamento ${s}`,
    // rc.33 (UX-07): a visão ampliada do gráfico do saldo — as segundas que o save registrou.
    chartOpen: "Abrir o gráfico do saldo",
    chartTitle: "Histórico do saldo",
    chartRange: (n: number, from: string, to: string) =>
      n === 1 ? `Uma segunda registrada: ${from}.` : `${n} segundas registradas, de ${from} a ${to}.`,
    chartEmpty: "O gráfico se preenche de segunda em segunda — volte depois do próximo pagamento.",
    chartLegendBalance: "Saldo depois da folha de segunda",
    chartLegendFloor: "O piso (uma segunda abaixo dele é uma quebra)",
    chartLegendSeason: "Início de temporada",
    chartHigh: (s: string) => `Máximo ${s}`,
    chartLow: (s: string) => `Mínimo ${s}`,
    chartFloor: (s: string) => `Piso ${s}`,
    chartColSeason: "Temporada",
    chartColLow: "Mínimo",
    chartColHigh: "Máximo",
    chartColLast: "Última segunda",
    chartSummary: (n: number, first: string, last: string, low: string, high: string) =>
      `Saldo em ${n} segundas: de ${first} a ${last}, mínimo ${low}, máximo ${high}.`,
    chartClose: "Fechar",
    line: {
      sponsorBase: "Base do patrocínio",
      foundingPartner: "Parceiro fundador",
      rescuePartner: "Investidor",
      fanbase: "Torcida",
      payroll: "Salários do elenco",
      coach: "Coach",
      psychologist: "Psicólogo esportivo",
      upkeep: "Manutenção das instalações",
      bankPayment: "Parcela do banco",
    },
    loans: "Empréstimos & dívidas",
    // rc.34: um banco, dois empréstimos — o voluntário e o emergencial.
    loansHint: "Um banco, dois empréstimos: o voluntário, nos seus termos, e o emergencial, quando as contas rompem o piso.",
    // A próxima quebra do piso encerra a carreira — sem empréstimo emergencial para socorrer.
    loansHintEnd: "Um jeito de se financiar: o empréstimo voluntário do banco. Não há mais empréstimo emergencial — a próxima quebra do piso encerra a carreira.",
    bankTitle: "Empréstimo bancário",
    bankNone: "Nenhum empréstimo bancário aberto",
    bankHint: (weeks: number, pct: number) =>
      `Uma linha de crédito do tamanho da sua reputação, paga em ${weeks} parcelas semanais com ${pct}% de juros. Planeje — o empréstimo emergencial é o último recurso do banco, e vem com prazo.`,
    bankHintEnd: (weeks: number, pct: number) =>
      `Uma linha de crédito do tamanho da sua reputação, paga em ${weeks} parcelas semanais com ${pct}% de juros. Planeje — não há empréstimo emergencial por trás: a próxima quebra do piso encerra a carreira.`,
    bankAvailable: (s: string) => `Disponível agora: até ${s}`,
    bankTerms: (weekly: string, weeks: number, total: string) =>
      `${weekly} / semana por ${weeks} semanas · ${total} no total`,
    bankRequest: "Pedir empréstimo",
    bankAmount: "Valor",
    bankRemaining: (s: string) => `Banco: ${s} a pagar`,
    bankWeekly: (s: string) => `Parcela de ${s} / semana`,
    bankPayEarly: "Antecipar o banco",
    bankBlockedActive: "Um empréstimo por vez — quite este primeiro.",
    bankLockedRep: "O banco abre as portas quando a org tiver um pouco de reputação.",
    // ECO-02 (R46): o cronograma do banco, como a folha de segunda lança.
    bankNext: (amount: string, date: string) => `Próxima parcela de ${amount} em ${date}`,
    bankLeft: (n: number) => (n === 1 ? "última parcela" : `${n} parcelas restantes`),
    // ECO-02 (R46): um pagamento que deixa o saldo negativo avisa antes. rc.34: o empréstimo do banco.
    payRiskBacker: (floor: string) =>
      `Isso deixa as contas no vermelho. Abaixo de ${floor} numa segunda, o empréstimo emergencial do banco entra — com prazo.`,
    payRiskEnd: (floor: string) =>
      `Isso deixa as contas no vermelho. Abaixo de ${floor} numa segunda, a carreira acaba — não há segundo resgate.`,
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
      fanbase: "Receita de torcida",
      payroll: "Salários do elenco",
      bankLoan: "Empréstimo bancário recebido",
      bankPayment: "Parcela do banco",
      insert: "Evento paralelo",
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
    // rc.34 (Miguel, 31/10): o empréstimo emergencial do banco (rc.31–rc.33: o Investidor de emergência).
    backer: "Empréstimo emergencial",
    backerRemaining: (s: string) => `Empréstimo emergencial: ${s} a devolver`,
    backerLine: (pct: number) => `Abatido da premiação (${pct}%) e das vendas — ou amortize abaixo`,
    // v0.3 quitação da dívida
    backerSaleLine: (pct: number) => `Vendas de jogadores abatem ${pct}% automaticamente`,
    payDebt: "Pagar o empréstimo",
    payDebtAll: (s: string) => `Quitar tudo (${s})`,
    payDebtAmount: "Valor",
    payDebtHint: "Quitado antes do prazo, o empréstimo se encerra e o prazo deixa de existir.",
    debtCleared: "Empréstimo quitado — o prazo deixou de existir.",
    // rc.34: a regra quando nada é devido — o piso, o empréstimo até o alvo, o prazo (null = sem prazo).
    backerIdle: (floor: string, rescueTo: string, term: number | null) =>
      `Sem uso. Se uma segunda-feira fechar abaixo de ${floor}, o banco empresta o necessário para o saldo voltar a ${rescueTo}${term !== null ? `, para quitar em até ${term} semanas` : ""} — premiações e vendas abatem parte dele automaticamente.`,
    // CAREER_LOAN.breachesToEnd encerra a carreira desta dificuldade na primeira quebra — sem empréstimo emergencial.
    backerIdleNone: (floor: string) =>
      `Sem empréstimo emergencial nesta dificuldade: uma segunda-feira que fechar abaixo de ${floor} encerra a carreira.`,
    backerWarning: "Este negócio provavelmente rompe o piso: o empréstimo emergencial do banco entraria, com prazo.",
    endsCareerWarning: "Este negócio provavelmente encerra a carreira: a próxima quebra do piso é a última.",
    backerRescued: "O último empréstimo emergencial está quitado.",
    insolvencyWarning: "As contas estão ruindo — a próxima quebra do piso encerra a carreira.",
    // rc.32 (M4): a linha em semanas de salário.
    backerWeeksLine: (floorWeeks: number, rescueWeeks: number) =>
      `A linha acompanha a folha: o piso fica ${floorWeeks} semanas de salário abaixo de zero; o empréstimo emergencial recompõe o saldo até ${rescueWeeks} semanas acima.`,
    // rc.34: a regra inteira nesta dificuldade — o prazo, o investidor, os acréscimos, o vencimento,
    // e CAREER_LOAN.breachesToEnd se ela encerra carreiras direto (null = não encerra).
    loanRule: (p: { term: number | null; partnerPct: number; partnerWeeks: number; maxTopUps: number | null; endAt: number | null; maxLoans?: number | null }) => {
      if (p.endAt !== null && p.endAt <= 1) return "Nesta dificuldade a primeira quebra do piso encerra a carreira.";
      const partner = p.partnerPct > 0 ? ` (na primeira vez, um investidor soma ${p.partnerPct}% da folha${partnerRunPt(p.partnerWeeks)})` : "";
      const term = p.term !== null ? ` Quite em até ${p.term} semanas: premiações e vendas abatem parte dele automaticamente, e Finanças recebe o resto.` : "";
      const topUps = `Abaixo do piso de novo enquanto houver dívida, o banco soma ao empréstimo${p.maxTopUps !== null ? ` (até ${p.maxTopUps} vezes)` : ""} — o prazo continua o mesmo.`;
      const end = p.term !== null ? ` No prazo, o banco cobra o que é devido desde que as contas fiquem no piso ou acima dele depois; se não ficarem, a carreira acaba.` : "";
      const count = p.endAt !== null ? ` A ${ordinalPt(p.endAt)} quebra encerra a carreira.` : "";
      // rc.34 review: o limite de empréstimos novos na carreira (CAREER_LOAN.emergency.maxLoans).
      const loans =
        p.maxLoans !== undefined && p.maxLoans !== null
          ? ` O banco abre no máximo ${p.maxLoans === 1 ? "um empréstimo emergencial" : `${p.maxLoans} empréstimos emergenciais`} por carreira: uma quebra depois de quitado o último encerra a carreira.`
          : "";
      return `Uma quebra abre o empréstimo emergencial do banco${partner}.${term} ${topUps}${end}${loans}${count}`;
    },
    // Contagem histórica (a regra do rc.33 encerrava a carreira numa quebra; `end` null = nenhuma contagem encerra).
    breachCount: (n: number, end: number | null) =>
      end === null
        ? `Quebras até aqui: ${n}`
        : n + 1 >= end
          ? `Quebras até aqui: ${n} — a próxima encerra a carreira`
          : `Quebras até aqui: ${n} — a carreira acaba na quebra ${end}`,
    backerLock: "Enquanto houver dívida: sem taxas de transferência, sem equipamento, nada que encurte o fôlego.",
    // rc.34: nada fica travado enquanto há dívida (CAREER_LOAN.lockCommitments false).
    loanNoLock: "Nada fica travado enquanto você deve: contratações, taxas e equipamentos seguem liberados.",
    // rc.34: o prazo e o estado do empréstimo, como Finanças e o QG mostram.
    loanDeadline: (date: string, weeks: number) =>
      weeks <= 0 ? `Vence nesta segunda (${date})` : weeks === 1 ? `Vence na próxima segunda, ${date}` : `Vence em ${date} — faltam ${weeks} semanas`,
    loanDeadlineRule: deadlineRulePt,
    // rc.34 review: as contas projetadas até a segunda do prazo (com o gasto semanal), o teste do próprio banco.
    loanCovered: (covered: boolean) =>
      covered ? "Neste ritmo as contas cobrem a dívida no dia." : "Neste ritmo as contas não vão cobrir a dívida no dia.",
    loanLent: (s: string) => `Emprestado no total: ${s}`,
    loanTopUps: (n: number, max: number | null) =>
      max === null
        ? `Acréscimos até aqui: ${n}`
        : n >= max
          ? `Acréscimos: ${n} de ${max} — a próxima quebra encerra a carreira`
          : `Acréscimos: ${n} de ${max}`,
    // rc.33 (ECO-07): o card do parceiro de resgate — rc.34: o investidor que entra com o primeiro empréstimo emergencial.
    rescueTitle: "Investidor",
    rescueTerms: (weeks: number) => `Entrou com o primeiro empréstimo emergencial, por ${weeks} semanas · receita, nunca descontada`,
    rescueUntil: (date: string, left: number) =>
      left === 1 ? `Último pagamento ${date}.` : `Faltam ${left} pagamentos — o último em ${date}.`,
    // rc.32 (M3, provisório): o card do parceiro fundador.
    foundingTitle: "Parceiro fundador",
    foundingTerms: (pct: number) => `${pct}% da folha de fundação · meta: disputar eventos · sem luvas`,
    foundingEnds: (through: string) => `Termina no seu primeiro contrato de patrocínio — não antes do fim de ${through}.`,
    foundingEnded: "Saiu de cena quando a org assinou o próprio patrocínio.",
    // rc.32 (M6, provisório): a parte dos jogadores nos prêmios de pódio.
    // rc.33 (ECO-10): cada contrato tem a própria parte (o Elenco e a oferta mostram).
    playerShareRule:
      "Prêmios de pódio são divididos com os jogadores que jogaram: cada contrato garante a própria parte de um prêmio de top 4 num regional, Major ou Worlds (o Elenco mostra) — lançados como linha própria.",
    boosts: "Boosts & staff",
    psychologist: "Psicóloga esportiva",
    psychologistDesc: "+1 Clutch, +1 Consistência enquanto contratada. A contratação que vence jogos decisivos.",
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
    gearLadderHint: "Comprado em ordem, desbloqueado por reputação — uma org de garagem vira potência.",
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
    bootcampT1Desc: "Uma semana sob o mesmo teto. Ganho de química + leve vantagem no próximo oficial.",
    bootcampT2: "Bootcamp estruturado",
    bootcampT2Desc: "Comissão técnica, agenda de scrims, review de VOD. Mais química + próximo oficial afiado.",
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
    none: "Nada para comprar ainda — a reputação abre a caixa de ferramentas.",
    lockedRep: (rep: number) => `Reputação ${rep}`,
    after: (name: string) => `Depois de ${name}`,
    used: "Já usado neste split",
    superseded: "Substituído pelo nível seguinte",
    training: (pct: number) => `+${pct}% de treino`,
    buff: (n: number) => `+${n} nível de buff`,
    rating: (n: string) => `+${n} de rating do time`,
    chemistry: "um ganho de química",
    stats: "+1 Clutch, +1 Consistência",
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
    free: "Grátis — vantagem do patrocínio",
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
    unlockBody: (name: string) => `${name} foi desbloqueado — pronto para comprar, ainda não comprado.`,
    unlockSee: "Ver",
    unlockLater: "Depois",
    newTag: "Novo",
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
    digest: (n: number) => `Giro pela liga: mais ${n} movimentações`,
    tpl: {
      transfer: (p: Record<string, string | number>) => `${p.player} assina com ${p.to}`,
      transferFee: (p: Record<string, string | number>) => `${p.to} tira ${p.player} de ${p.from} (${p.fee})`,
      transferFa: (p: Record<string, string | number>) => `${p.player} encontra casa na ${p.to}`,
      userSigned: (p: Record<string, string | number>) => `Oficial: ${p.player} chega a ${p.org}`,
      userSold: (p: Record<string, string | number>) => `${p.player} deixa ${p.org} rumo à ${p.to}`,
      userReleased: (p: Record<string, string | number>) => `${p.org} dispensa ${p.player}`,
      result: (p: Record<string, string | number>) => `${p.org} levam o ${p.event}`,
      resultUser: (p: Record<string, string | number>) => `${p.event}: você termina em ${p.placement}`,
      // v2.0 (R40): resultado de qualificatória é classificado / eliminado, nunca colocação.
      resultUserQualified: (p: Record<string, string | number>) => `${p.event}: classificado para domingo`,
      resultUserEliminated: (p: Record<string, string | number>) => `${p.event}: eliminado no Swiss`,
      qualifiedRegional: (p: Record<string, string | number>) => `Passou na qualificatória: ${p.event} está marcado`,
      missedRegional: (p: Record<string, string | number>) => `Fora na qualificatória — ${p.event} acontece sem você`,
      qualifiedMajor: () => `Está dentro. O Major espera.`,
      missedMajor: () => `O Major acontece sem você neste split.`,
      qualifiedWorlds: () => `WORLDS. A org chegou lá.`,
      missedWorlds: () => `A corrida pelo Worlds termina aqui nesta temporada.`,
      stability: (p: Record<string, string | number>) => `Reformulação do elenco custa ${p.points} Pontos da Temporada`,
      contractExpiring: (p: Record<string, string | number>) => `O contrato de ${p.player} entra na janela final`,
      contractReminder: (p: Record<string, string | number>) => `Relógio dos contratos: ${p.players} — ${p.weeks} semanas`,
      // rc.34 (Miguel, 31/10): um elenco incompleto ficou fora de uma regional.
      regionalSkipped: (p: Record<string, string | number>) => `${p.org} fica fora da ${p.event}`,
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
      rookieClass: (p: Record<string, string | number>) => `Chega a turma de novatos de ${p.region} — ${p.name} é o destaque`,
      decline: (p: Record<string, string | number>) => `${p.player}, ${p.n}, perdeu meio passo`,
      breakout: (p: Record<string, string | number>) => `${p.player} está superando todas as projeções`,
      trainingReport: (p: Record<string, string | number>) => `Relatório de treinos: elenco ${p.n} OVR`,
      // rc.34 (DEV-03 T7): o relatório de um período é arquivado — uma linha no feed, nunca um toast.
      trainingPeriod: (p: Record<string, string | number>) =>
        `Relatório do período ${p.n} (${({ development: "Desenvolvimento", preparation: "Preparação competitiva", recovery: "Recuperação" } as Record<string, string>)[String(p.objective)] ?? "Crescimento base"}): elenco +${p.avg} em média, ${p.player} +${p.gain}`,
      // rc.34 (T3): uma linha por semana para os scrims do pacote (só treino).
      scrimWeek: (p: Record<string, string | number>) =>
        `Semana de scrims (${({ easy: "fácil", even: "equilibrado", hard: "difícil" } as Record<string, string>)[String(p.level)] ?? String(p.level)}): ${p.won}–${p.lost}`,
      windowOpen: () => `Janela de transferências aberta — os telefones ligados`,
      windowClose: () => `Janela fechada. Os elencos são o que são.`,
      windowReport: (p: Record<string, string | number>) => `Relatório da janela: ${p.n} trocas pelas regiões`,
      debtCleared: () => `Empréstimo emergencial quitado — a org anda livre`,
      sponsorSigned: (p: Record<string, string | number>) => `${p.org} anuncia parceria com ${p.name}`,
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
      listingOffer: (p: Record<string, string | number>) => `${p.org} fazem proposta por ${p.player}, anunciado`,
      listed: (p: Record<string, string | number>) => `${p.player} está no mercado — a org o anunciou`,
      flavor1: () => `Notas da bancada: disciplina de rotação é o novo jargão do meta`,
      flavor2: () => `Servidores de scrim lotados — a região inteira está no grind`,
      flavor3: () => `O microfone de um caster pegou uma análise bem sincera no intervalo`,
      flavor4: () => `Reclamações de ping registradas. Reclamações de ping arquivadas.`,
      flavor5: () => `Uma montage da comunidade está bombando esta semana`,
    },
    // v0.2 — corpo de texto por template (mesmos params; o feed do QG renderiza).
    body: {
      transferFee: (p: Record<string, string | number>) =>
        `${p.to} acertou a taxa com ${p.from} por ${p.player}. O mapa da região se redesenha de novo.`,
      transferFa: (p: Record<string, string | number>) =>
        `${p.player} estava sem org — ${p.to} chegou primeiro. Valor de agente livre, se o encaixe funcionar.`,
      userSigned: (p: Record<string, string | number>) =>
        `Papelada assinada: ${p.player} é seu. A química começa do zero — a tabela só lembra de resultados.`,
      userSold: (p: Record<string, string | number>) =>
        `${p.player} sai rumo à ${p.to}. A taxa entra no caixa; o buraco na escalação é problema seu.`,
      userReleased: (p: Record<string, string | number>) =>
        `${p.org} pagou a rescisão e seguiu em frente. ${p.player} entra no mercado de agentes livres.`,
      result: (p: Record<string, string | number>) =>
        `${p.org} fecharam o ${p.event}. A bancada vai reprisar essa grande final por semanas.`,
      resultUser: (p: Record<string, string | number>) =>
        `A campanha da org no ${p.event} termina em ${p.placement}. Toda colocação paga — e a tabela lembra.`,
      resultUserQualified: (p: Record<string, string | number>) =>
        `Três vitórias no Swiss do ${p.event} e a org garantiu a vaga no regional. A qualificatória paga premiação e reputação — os Pontos da Temporada estão em jogo no domingo.`,
      resultUserEliminated: (p: Record<string, string | number>) =>
        `Três derrotas encerraram o ${p.event} da org no Swiss. A premiação entra mesmo assim — e a próxima semana de regional é outra chance.`,
      qualifiedRegional: (p: Record<string, string | number>) =>
        `O Swiss de sábado acabou e a org está entre os oito classificados. ${p.event} é no domingo — os oito diretos esperam.`,
      missedRegional: (p: Record<string, string | number>) =>
        `Três derrotas no Swiss de sábado — o ${p.event} acontece no domingo sem você. Descanse; segunda começa uma nova semana de treino.`,
      qualifiedMajor: () =>
        `A classificação do split travou e o seu nome está acima da linha. Chave inter-regional, pontos em dobro — o teste de verdade.`,
      missedMajor: () =>
        `Abaixo da linha quando ela travou. O próximo split zera a corrida — os pontos de Worlds já garantidos continuam valendo.`,
      qualifiedWorlds: () =>
        `Uma temporada inteira de pontos garantiu. A maior chave do jogo espera — um bracket para tudo.`,
      missedWorlds: () =>
        `Os pontos da temporada não bastaram. A org assiste ao Worlds de casa — e planeja a volta.`,
      stability: (p: Record<string, string | number>) =>
        `Escalar mais uma cara nova no meio do split custou ${p.points} Pontos da Temporada. Reformulação é coisa de pré-temporada.`,
      contractExpiring: (p: Record<string, string | number>) =>
        `O contrato de ${p.player} está acabando. Você tem janela exclusiva de renovação até o fim do Split 3.`,
      contractReminder: (p: Record<string, string | number>) =>
        `A temporada acaba em ${p.weeks} semanas e ${p.players} não têm contrato depois dela. Renove antes da virada, ou eles saem.`,
      regionalSkipped: (p: Record<string, string | number>) =>
        `Só ${p.n} de 3 vagas estão preenchidas, então o elenco não entra na ${p.event}: sem pontos, sem prêmio. A próxima regional pergunta de novo.`,
      playerLeft: (p: Record<string, string | number>) =>
        `A renovação não veio e ${p.player} saiu de graça. Agentes conversam — a próxima negociação começa daí.`,
      retirementAnnounce: (p: Record<string, string | number>) =>
        `${p.player} vai se aposentar no fim da temporada. Uma última campanha juntos — faça valer.`,
      retired: (p: Record<string, string | number>) =>
        `${p.player} deixa o jogo. A cena fica mais jovem — e um pouco mais pobre — hoje.`,
      retiredToCoach: (p: Record<string, string | number>) =>
        `${p.player} se aposenta das competições e vira treinador. O mercado de técnicos ganha um nome novo — que você conhece bem.`,
      retiredLeaves: (p: Record<string, string | number>) =>
        `${p.player} se aposenta e deixa a cena. A org agradece cada temporada com as nossas cores.`,
      orgEnters: (p: Record<string, string | number>) =>
        `Um escudo novo no circuito de ${p.region}: ${p.org} coloca uma line nesta temporada. A história chega no horário — e a tabela fica mais dura.`,
      orgLeaves: (p: Record<string, string | number>) =>
        `${p.org} não monta line nesta temporada e deixa o circuito de ${p.region}. A vaga fica com um nome novo; os jogadores procuram outra casa.`,
      rookieClass: (p: Record<string, string | number>) =>
        `Nomes novos chegam ao mercado de ${p.region}. ${p.name} é o que os olheiros sublinham.`,
      decline: (p: Record<string, string | number>) =>
        `A idade cobra a mecânica primeiro. ${p.player} está adaptando o próprio jogo — a experiência segue pagando.`,
      windowOpen: () =>
        `Agentes atendendo, taxas circulando, elencos destravados. Negócios resolvem com o passar dos dias; a janela não espera.`,
      windowReport: (p: Record<string, string | number>) =>
        `${p.n} trocas registradas antes da janela fechar. O plantão completo — taxas, agentes livres, todas as regiões — está no QG.`,
      debtCleared: () =>
        `O último pagamento quitou o empréstimo emergencial do banco. Nenhum prazo pesa mais sobre a org.`,
      sponsorSigned: (p: Record<string, string | number>) =>
        `${p.org} e ${p.name} assinaram pela temporada. Base garantida, bônus na meta — entregue e o nível cresce.`,
      unlock: (p: Record<string, string | number>) =>
        `A reputação abriu uma porta nova: ${p.name}. A trilha de progressão mostra o que ainda vem.`,
      registryRepair: () =>
        `Jogadores listados por duas orgs agora ficam em um só elenco, e gamertags repetidas foram renomeadas. Seu elenco, seus contratos e seus resultados não mudaram.`,
      unavailable: (p: Record<string, string | number>) =>
        `${p.player} está fora de ${p.event} — visto, saúde, vida. O sub entra com a química dele.`,
      standIn: (p: Record<string, string | number>) =>
        `Um substituto contratado mantém a org no ${p.event}. Escalação completa, química zero — e dá para notar.`,
      bankLoan: (p: Record<string, string | number>) =>
        `Crédito novo no balanço — ${p.amount}, pago semanalmente. Ambição com dinheiro emprestado ainda é ambição.`,
      bankCleared: () =>
        `A parcela final caiu. O que o dinheiro comprou, a org agora tem de verdade.`,
      cashWarning: (p: Record<string, string | number>) =>
        `Os custos semanais passam a receita e a reserva está em ${p.weeks} semanas. Quem ignora isso acaba no balcão de emergência do banco.`,
      backerIn: () =>
        `O piso rompeu e o aporte do investidor caiu. O reembolso sai descontado da premiação e das vendas até quitar — a caixa de entrada diz o que a próxima quebra significaria.`,
      emergencyLoan: () =>
        `O piso rompeu e o banco depositou um empréstimo emergencial. Premiações e vendas abatem parte dele — e ele tem prazo. A caixa de entrada traz as condições.`,
      emergencyTopUp: () =>
        `Abaixo do piso de novo antes de quitar: o banco somou ao empréstimo. O prazo não mudou.`,
      loanCollected: () =>
        `Dia do prazo, e o saldo cobriu a dívida: o banco cobrou o que era devido. A org segue em frente.`,
      insolvency: () =>
        `O colapso final. Salários sem pagar, cadeiras vazias, servidores no escuro — a história da org termina no livro-caixa.`,
      seasonChampion: (p: Record<string, string | number>) =>
        `${p.org} levantam o troféu do ${p.event}. A régua de todo mundo acabou de subir.`,
      incomingBid: (p: Record<string, string | number>) =>
        `${p.org} querem ${p.player} e puseram dinheiro na mesa. A decisão — e as consequências — são suas.`,
      gearBought: (p: Record<string, string | number>) =>
        `O upgrade de ${p.name} chegou. A eficiência de treino sobe — os jogadores notaram na hora.`,
      bootcampRun: () =>
        `Uma semana sob o mesmo teto faz o que agenda nenhuma faz: o elenco joga como se dividisse um cérebro. Próximo oficial mais afiado, e mais entrosados para sempre.`,
      coachHired: (p: Record<string, string | number>) =>
        `${p.coach} assume o quadro branco de ${p.org}. Ritmo de desenvolvimento e preparação de jogo agora respondem ao banco.`,
      scrimWin: (p: Record<string, string | number>) =>
        `Um set limpo de portas fechadas contra ${p.opponent}. Reps no bolso, química em alta, nada vazou para o plantão — quase.`,
      scrimLoss: (p: Record<string, string | number>) =>
        `${p.opponent} levou o set de scrim. Derrota de portas fechadas é a lição mais barata dos esports.`,
      blockbusterBid: (p: Record<string, string | number>) =>
        `${p.org} vieram com intenção real por ${p.player}. A história quer essa transferência — você decide se ela acontece.`,
      // Histórico do rc.32 (ECO-08 / ECO-12): nada os envia desde o rc.33 — ficam para o feed de um save antigo.
      restructured: (p: Record<string, string | number>) =>
        `A org fechou de novo abaixo do piso e o Investidor forçou a mão${p.player ? `: ${p.player} vai para ${p.org}` : ""}. A reputação sente; ${Number(p.granted) > 0 ? "as contas voltam a ter fôlego" : "a venda cobre as contas"}. ${legacyNextBreachPt(p.next)}`,
      listingOffer: (p: Record<string, string | number>) =>
        `${p.org} responderam ao anúncio com uma proposta formal por ${p.player}. Aceite antes de a janela fechar, ou fique com ele.`,
      listed: (p: Record<string, string | number>) =>
        `A org colocou ${p.player} no mercado. Uma proposta de um time que o escalaria chega em poucos dias de janela.`,
      repDown: (p: Record<string, string | number>) =>
        `As expectativas foram declaradas e não cumpridas; o prestígio de ${p.org} sente. Reputação se recupera do mesmo jeito que se constrói.`,
    },
  },

  achievements: {
    title: "Conquistas da carreira",
    hint: "Permanentes e suas em todos os saves — um reset de season nunca encosta nelas. Cada uma paga Season XP uma vez; as grandes liberam cosméticos.",
    unlocked: "Conquista desbloqueada",
    lockedLabel: "Bloqueada",
    unlockedOn: (date: string) => `Desbloqueada em ${date}`,
    xp: (n: number) => `+${n} Season XP`,
    progress: (done: number, total: number) => `${done} de ${total}`,
    tier: { common: "Comum", rare: "Rara", epic: "Épica", legend: "Lenda" } as Record<string, string>,
    items: {
      "car-first-sponsor": { name: "Aberta para Negócios", desc: "Assine seu primeiro patrocínio." },
      "car-bank-cleared": { name: "Bom Pagador", desc: "Quite um empréstimo bancário por completo." },
      "car-first-qualifier": { name: "Pela Porta da Frente", desc: "Passe por uma qualificatória de sábado até o regional de domingo." },
      "car-rep-50": { name: "Um Nome na Cena", desc: "Alcance 50 de reputação." },
      "car-three-seasons": { name: "Road Warrior", desc: "Chegue à terceira temporada com uma mesma org." },
      "car-major-qualified": { name: "Internacional", desc: "Classifique-se para um Major." },
      "car-first-regional": { name: "Campeão Regional", desc: "Vença um regional." },
      "car-worlds-qualified": { name: "No Grande Palco", desc: "Classifique-se para o Campeonato Mundial." },
      "car-rep-100": { name: "Nome Conhecido", desc: "Alcance 100 de reputação." },
      "car-first-major": { name: "Vencedor de Major", desc: "Vença um Major internacional." },
      "car-first-worlds": { name: "Campeão Mundial", desc: "Vença o Campeonato Mundial." },
      "car-worlds-underdog": { name: "Underdog", desc: "Vença um regional, Major ou Mundial como azarão: overall do time 3+ abaixo da média do campo." },
      "car-worlds-homegrown": { name: "Prata da Casa", desc: "Vença o Mundial com o elenco que fundou a org — sem contratações, nunca." },
      "car-three-worlds": { name: "Dinastia", desc: "Vença três Mundiais com uma mesma org." },
      "car-all-difficulties": { name: "Todos os Caminhos", desc: "Vença o Mundial no Fácil, Normal e Difícil (entre saves)." },
    } as Record<string, { name: string; desc: string }>,
  },

  inserts: {
    kinds: { random: "Missão paralela", sponsor: "Pedido do patrocinador", training: "Decisão de treino" } as Record<string, string>,
    expires: "Decida hoje — o momento passa com o dia.",
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
      "ins-showmatch": { title: "Um streamer quer um showmatch", body: "Um criador grande oferece ao elenco um showmatch pago nesta semana. Dinheiro fácil, química boa, uma sessão a menos.", a: "Jogar", b: "Passar" },
      "ins-charity-cup": { title: "Copa beneficente", body: "Uma copa beneficente local quer sua org no cartaz. Custa pouco e compra boa vontade.", a: "Aparecer", b: "Recusar" },
      "ins-pc-dies": { title: "Um PC morre no meio da semana", body: "Uma das máquinas de torneio pifou. Troque agora ou empreste uma reserva e perca tempo de treino.", a: "Trocar", b: "Emprestar uma reserva" },
      "ins-fan-meetup": { title: "A torcida pede um encontro", body: "A torcida quer um encontro depois do treino. Um custo pequeno, um pouco de prestígio.", a: "Organizar", b: "Não esta semana" },
      "ins-media-day": { title: "Pedido de media day", body: "A imprensa quer um dia inteiro com o elenco. Bom para a marca, uma sessão mais curta.", a: "Media day completo", b: "Manter o mínimo" },
      "ins-sponsor-content": { title: "Seu patrocinador quer um dia de conteúdo", body: "O patrocinador pede um dia de conteúdo com os jogadores. Paga — e o treino paga por isso.", a: "Gravar o conteúdo", b: "Recusar com educação" },
      "ins-sponsor-jersey": { title: "Foto de lançamento da camisa", body: "O patrocinador quer revelar a camisa nova no próximo evento com uma sessão de fotos. Dinheiro rápido e um pouco de prestígio.", a: "Fazer o lançamento", b: "Pular" },
      "ins-rest-request": { title: "Um titular pede uma semana mais leve", body: "O elenco está cansado. Sessões mais leves mantêm o clima; insistir mantém o ritmo.", a: "Aliviar a semana", b: "Insistir" },
      "ins-lan-bootcamp": { title: "Uma LAN house oferece um bootcamp barato", body: "Uma LAN house local oferece ao elenco um fim de semana sob o mesmo teto por um valor fixo.", a: "Reservar", b: "Passar" },
      "ins-coach-clinic": { title: "O coach propõe uma clínica", body: "O coach quer rodar uma clínica focada nesta semana — um custo pequeno, um passo real.", a: "Rodar a clínica", b: "Agora não" },
    } as Record<string, { title: string; body: string; a: string; b: string }>,
  },

  club: {
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
      perfCenter: "Centro de Performance",
      coach: "Contratação de coach",
      t2: "Circuito de Invitationals",
      sponsorT2: "Patrocinadores Challenger",
      sponsorT3: "Patrocinadores globais",
      sponsorT4: "Parceiros de título",
      relocation: "Mudança de região",
      star5: "Status 5 estrelas",
    },
    editCrest: "Editar escudo",
    settings: "Opções da carreira",
    abandonCareer: "Abandonar carreira",
    abandonConfirm: "Isto apaga o save permanentemente. Os troféus vão junto.",
  },

  event: {
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
    champion: (name: string) => `${name} — CAMPEÕES`,
    yourResult: (placement: string) => `Colocação final: ${placement}`,
    earned: "Conquistado",
    unavailableNotice: (player: string) => `${player} está fora desta — próximo da fila.`,
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
      `Seed nº ${seed} — sua estreia é contra ${opp} (nº ${oppSeed})`,
    sundaySpectating: "Fora no Swiss — hoje a taça é decidida sem você",
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
    worldsChampion: (name: string) => `${name} — CAMPEÕES MUNDIAIS`,
    yourTitle: "CAMPEÕES MUNDIAIS",
    creditsJourney: "A estrada até aqui",
    creditsRoster: "O elenco que conseguiu",
    finalWhistle: "Apito final",
    finalWhistleBody: "A temporada 2026 fecha o livro — mas não a história da org.",
    insolvencyTitle: "Insolvência",
    insolvencyBody: "As contas fecharam abaixo do piso uma vez a mais do que esta dificuldade tolera. A história da org termina aqui.",
    // rc.34 (end.moneyCause "deadline"): o empréstimo emergencial sem pagar no prazo.
    insolvencyBodyDeadline:
      "O empréstimo emergencial venceu e o saldo não cobria a dívida. O banco cobrou o empréstimo — a história da org termina aqui.",
    legacyTitle: "Legado da carreira",
    legacyGrade: { legend: "Lenda", contender: "Contendor", challenger: "Desafiante", journeyman: "Batalhador" },
    retire: "Aposentar",
    retireDesc: "A carreira é arquivada — troféus e histórico continuam visíveis.",
    infinite: "Era infinita",
    infiniteDesc: "A linha do tempo agora é sua. Sem roteiro — só a simulação.",
    infiniteExplainer:
      "A partir de 2027 o mundo é totalmente procedural: novatos são gerados, veteranos se aposentam, a história é a que você fizer.",
    defendTitle: "Defender o título",
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

  goals: {
    reachMajor: "Alcançar um Major",
    regionalTop4: "Um top-4 regional",
    majorTop8: "Um top-8 de Major",
    majorTop4: "Um top-4 de Major",
    qualifyWorlds: "Classificar para o Worlds",
    worldsTop4: "Um top-4 no Worlds",
    winMajor: "Vencer um Major",
    winWorlds: "Vencer o Worlds",
    repRisk: (n: number) => `Sua reputação espera isso (−${n} se falhar)`,
  },

  explainers: {
    skipAll: "Pular todas as dicas",
    gotIt: "Entendi",
    hub: {
      title: "Este é o QG",
      body: "O cartão do dia comanda sua carreira: avance um dia por vez ou pule até a próxima parada. Os cartões marcados Precisa de você pedem decisão; o resto é profundidade opcional.",
    },
    calendar: {
      title: "A temporada num relance",
      body: "Três splits, três fins de semana de regional cada — qualificatória no sábado, regional no domingo — e um Major fechando cada split: fase Swiss no sábado, playoffs no Championship Sunday. Os Pontos da Temporada decidem quem vai ao Major — e ao Worlds.",
    },
    squad: {
      title: "Seu elenco",
      body: "Três titulares e um sub. Mantenha um núcleo junto e a química paga; troque demais e a tabela lembra.",
    },
    training: {
      title: "Treinos",
      body: "Os jogadores evoluem rumo ao potencial toda semana. O coach pode cuidar disso por você — assuma quando quiser.",
    },
    market: {
      title: "O mercado",
      body: "Contrate agentes livres ou compre contratos — só com a janela aberta. Todo preço mostra sua conta.",
    },
    window: {
      title: "Janela de transferências",
      body: "As janelas ficam entre os splits (mais uma última chamada antes do Worlds). Negócios resolvem quando você avança a semana.",
    },
    finances: {
      title: "As contas",
      // rc.34 (ECO-13/15): o empréstimo emergencial do banco e o prazo dele.
      body: "Premiações e patrocínios entram, salários e manutenção saem, toda segunda-feira. Abaixo do piso, o banco faz um empréstimo emergencial — quite até o prazo (mais longo nas dificuldades mais fáceis) ou a carreira acaba.",
    },
    standings: {
      title: "A linha de corte",
      body: "A linha tracejada é o corte de classificação. Tudo pelo que a org luta se mede contra ela.",
    },
    sponsor: {
      title: "Patrocinadores",
      body: "Dinheiro garantido por split, bônus se bater a meta. Falhar nunca custa caixa — falhar repetidamente custa o nível da renovação.",
    },
    randomEvent: {
      title: "Próximo da fila",
      body: "Às vezes um titular não pode jogar — visto, saúde, vida. O sub entra com a química dele; sem sub, ninguém fica de fora. Nenhum evento é disputado com menos de três.",
    },
    worldsRace: {
      title: "A corrida pelo Worlds",
      body: "Os Pontos da Temporada de cada regional e Major acumulam o ano todo. Termine acima da linha da sua região e o maior palco se abre.",
    },
    rollover: {
      title: "Virada de temporada",
      body: "As idades avançam, os contratos contam, o mundo se reorganiza rumo à própria história — a menos que você já a tenha mudado.",
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
      "Um time amador da cena regional — joga as community cups e as qualificatórias de sábado, e seus pontos de regional contam na corrida do Major e do Worlds.",
  },

  // rc.34 (Miguel, 31/10: "comunicar melhor com um modal que diga o que está acontecendo"): o aviso
  // de dinheiro, um por evento que muda o jogo (careerFlow.moneyNoticeOf). O modal passa os params
  // do aviso com o dinheiro formatado e `dlDate` (a data do prazo) incluída.
  moneyNotice: {
    ok: "Entendi",
    toFinances: "Abrir Finanças",
    loanOpened: (p: Record<string, string | number>): MoneyNoticeText => ({
      title: "O banco entrou em cena",
      lead: `Nesta segunda as contas fecharam abaixo do piso (${p.floor}), então o banco emprestou ${p.lent} e o saldo voltou a ${p.rescueTo}.`,
      rows: noticeRows(
        ["Dívida", `${p.owed}, com ${p.repayPct}% de juros incluídos`],
        p.dlDate !== undefined && ["Quitar até", `${p.dlDate} — ${p.dlWeeks} semanas`],
        ["Como se paga", `${p.garnishPct}% de cada premiação e ${p.salePct}% de cada venda vão para ela automaticamente; o resto você paga em Finanças quando quiser.`],
        positive(p.partnerWeekly) && [
          "Investidor",
          `O ${p.partnerName} entra junto com este primeiro empréstimo: ${p.partnerWeekly} por semana durante ${p.partnerWeeks} semanas (${p.partnerPct}% da folha) — receita, nunca descontada.`,
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
        p.dlDate !== undefined && ["Quitar até", `${p.dlDate} — o prazo não muda`],
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
        p.dlDate !== undefined && ["Quitar até", `${p.dlDate} — daqui a ${p.dlWeeks} semanas`],
        ["Como se paga", `${p.garnishPct}% de cada premiação e ${p.salePct}% de cada venda vão para ela automaticamente; o resto você paga em Finanças quando quiser.`],
        ["Abaixo do piso de novo", nextBreachPt(p)],
        p.dlDate !== undefined && ["O que encerra a carreira", `Em ${p.dlDate} o banco cobra o que é devido. Se pagar deixar as contas abaixo do piso, a carreira acaba.`],
      ),
      foot: Number(p.lock) ? undefined : "Nada fica mais travado enquanto você deve: contratações, taxas e equipamentos estão liberados.",
    }),
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
  },
};
