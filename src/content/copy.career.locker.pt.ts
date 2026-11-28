/**
 * v2.3 LOCKER (onda 1): os textos do vestiário — humores, motivos, os
 * e-mails e as respostas das conversas, o fechamento das promessas. Entra na
 * cópia da carreira como `locker` (uma linha). Gêmeo do copy.career.locker.en.ts,
 * com as mesmas chaves.
 *
 * Regra (HISTORIAS-SPEC): um jogador do elenco pode ser um pro de verdade,
 * então nenhuma frase vai para a boca dele. A comissão relata o que o save
 * prova; as respostas são palavras do técnico.
 */

import type { CareerLockerCopy } from "./copy.career.locker.en";

type P = Record<string, string | number>;

const MOODS_PT = {
  angry: "Revoltado",
  unhappy: "Insatisfeito",
  neutral: "Tranquilo",
  content: "Satisfeito",
  delighted: "Empolgado",
} as const;

/** O motivo da mudança: completa "… porque …" no e-mail de humor. */
const REASONS_PT: Record<string, string> = {
  bench: "ele segue fora dos eventos",
  played: "ele está jogando",
  backInSide: "ele voltou para a escalação",
  title: "o time ganhou um título",
  deepRun: "o time foi longe num evento grande",
  losingRun: "os resultados não param de piorar",
  listed: "ele foi colocado na lista de transferências",
  promiseMade: "o técnico fez uma promessa a ele",
  promiseKept: "o técnico cumpriu a palavra",
  promiseBroken: "o técnico quebrou uma promessa feita a ele",
  teammateBroken: "o técnico quebrou uma promessa feita a um companheiro",
  blunt: "o técnico foi seco com ele",
  refused: "o pedido de transferência foi recusado",
  agreedSale: "o clube aceitou liberá-lo",
  settling: "a poeira baixou com o tempo",
  inherited: "o técnico anterior deixou o clima pesado",
  mediaFatigue: "ele foi enviado a outro dia de mídia logo depois do último", // v2.3 MEDIA
  managerPost: "o técnico falou com a torcida depois da série", // rc9 STORIES
  // rc9 LOCKER
  goodResults: "o time está ganhando mais séries do que o rating prometia",
  poorResults: "o time está perdendo séries que deveria ganhar",
  goodForm: "ele jogou acima dos companheiros nos últimos jogos",
  poorForm: "ele jogou abaixo dos companheiros nos últimos jogos",
  heavyLoad: "a carga pesada de treino está cansando ele",
  rested: "ele teve uma semana de treino mais leve",
  heard: "o técnico atendeu ao pedido dele",
  passedOver: "o técnico recusou o pedido dele",
  madeWay: "ele perdeu a vaga para um reserva por um evento",
  sideEvent: "ele jogou um evento paralelo",
};

/** rc9 LOCKER (R218): a linha do motivo no selo de humor (Elenco e QG), lida como "Por quê: …". */
const WHY_PT: Record<string, string> = {
  bench: "Fora dos eventos",
  played: "Jogando",
  backInSide: "De volta à escalação",
  title: "Título conquistado",
  deepRun: "Campanha longa num evento grande",
  losingRun: "Eliminações seguidas",
  listed: "Colocado na lista de transferências",
  promiseMade: "Você fez uma promessa a ele",
  promiseKept: "Você cumpriu a palavra",
  promiseBroken: "Você quebrou uma promessa a ele",
  teammateBroken: "Você quebrou uma promessa a um companheiro",
  blunt: "A sua resposta seca",
  refused: "Pedido de transferência recusado",
  agreedSale: "Você aceitou liberá-lo",
  settling: "O tempo passou",
  inherited: "Clima pesado herdado do técnico anterior",
  mediaFatigue: "Dias de mídia demais",
  goodResults: "Resultados acima do rating do time",
  poorResults: "Resultados abaixo do rating do time",
  goodForm: "Jogando acima dos companheiros",
  poorForm: "Jogando abaixo dos companheiros",
  heavyLoad: "Carga de treino pesada",
  rested: "Semana de treino mais leve",
  heard: "Você atendeu ao pedido dele",
  passedOver: "Você recusou o pedido dele",
  madeWay: "Barrado por um reserva",
  sideEvent: "Jogou um evento paralelo",
};
// rc9 LOCKER end

const changesOf = (p: P, moods: Record<string, string>): string =>
  String(p.changes ?? "")
    .split("|")
    .filter(Boolean)
    .map((part) => {
      const [name, mood] = part.split("~");
      return `${name}: ${moods[mood] ?? mood}`;
    })
    .join("\n");

const ANSWER_LABELS_PT = {
  promiseMinutes: (p: P) => `Prometer ${p.need} jogos como titular nos próximos ${p.of} eventos`,
  promiseStay: () => "Prometer que ele fica até a janela fechar",
  earnIt: () => "Dizer que a vaga se conquista no treino",
  focus: () => "Pedir foco no próximo evento",
  blunt: () => "Dizer que a escalação não está em discussão",
  sell: () => "Aceitar vendê-lo",
  refuse: () => "Recusar o pedido",
  // rc9 LOCKER
  lighten: () => "Dar carga leve a ele até o fim do bloco de treino",
  keepLoad: () => "Manter o plano como está",
  pushHim: () => "Dar carga pesada a ele até o fim do bloco de treino",
  holdBack: () => "Manter a carga dele como está",
  enterHim: () => "Inscrever o time na copa com ele",
  passCup: () => "Ficar fora da copa desta vez",
  startHim: () => "Escalar ele como titular no regional",
  notYet: () => "Manter a escalação",
};

/** rc9 LOCKER: "a copa 1v1" / "a copa 2v2" quando o formato é conhecido, senão "a copa". */
const cupOf = (p: P): string => (Number(p.size) === 1 || Number(p.size) === 2 ? `a copa ${p.size}v${p.size}` : "a copa");

export const CAREER_LOCKER_PT: CareerLockerCopy = {
  moods: MOODS_PT as Record<string, string>,
  reasons: REASONS_PT,
  why: WHY_PT,
  matchLine: (points: number) =>
    points === 0 ? "Sem efeito no rating dele em jogo." : `${points > 0 ? "+" : "−"}${String(Math.abs(points)).replace(".", ",")} no rating dele em jogo enquanto ele se sentir assim.`,
  trend: { up: "Subindo", down: "Caindo", steady: "Estável" } as Record<string, string>,
  answers: ANSWER_LABELS_PT as Record<string, (p: P) => string>,
  answeredLabel: (answer: string) => `Sua resposta: ${answer}.`,
  answeredAuto: (answer: string) => `A resposta não veio a tempo. A comissão respondeu por você: ${answer}.`,
  talkHint: "Conversa sem resposta se resolve sozinha com a resposta neutra depois de uma semana.",
  /** v2.3 UI (onda 2): as telas — o vestiário no Elenco, a ficha de humor, a conversa, o cartão do QG. */
  ui: {
    title: "Vestiário",
    lead: "Como os jogadores se sentem, as promessas que você fez e as conversas esperando por você.",
    room: "O vestiário",
    whyOf: (player: string) => `Por que ${player} está assim`,
    recent: "O que mexeu com ele",
    noChanges: "Nada mexeu com ele ainda. Jogador sem histórico está tranquilo.",
    word: "Sua palavra",
    kept: "Cumpridas",
    broken: "Quebradas",
    wordLine: {
      fresh: "Nenhuma promessa fechada ainda. Uma promessa nova acalma com o peso normal.",
      trusted: "O vestiário confia na sua palavra: uma promessa nova acalma mais.",
      damaged: "Sua palavra está arranhada: uma promessa nova acalma menos, e a de quem mente não acalma nada.",
    } as Record<string, string>,
    promises: "Promessas abertas",
    noPromises: "Nenhuma promessa aberta.",
    hisPromise: "A promessa dele",
    promiseOf: {
      minutes: (need: number, of: number) => `Titular em ${need} dos próximos ${of} eventos`,
      stay: () => "Não ser vendido nem listado antes de a janela fechar",
    } as Record<string, (need: number, of: number) => string>,
    progress: (started: number, need: number, left: number) =>
      `${started} de ${need} como titular, ${left === 1 ? "falta 1 evento" : `faltam ${left} eventos`}`,
    stayUntil: (date: string) => `Até ${date}`,
    lapses: (date: string) => `Vence em ${date}`,
    atRisk: "Mais um evento no banco e ela se quebra.",
    inherited: "Feita pelo técnico anterior",
    talks: "Esperando por você",
    fromStaff: "A comissão relata",
    answerBy: (date: string) => `Responder até ${date}`,
    defaultTag: "Se você não responder",
    commits: {
      promiseMinutes: (p: P) =>
        `Uma promessa: ele é titular em ${p.need} dos próximos ${p.of} eventos. Cumprida, o humor dele sobe e sua palavra ganha peso. Quebrada, ele e o elenco sentem o golpe.`,
      promiseStay: () => "Uma promessa: ele não é vendido nem listado antes de a janela fechar. Listá-lo quebra a promessa.",
      earnIt: () => "Sem promessa. Nada muda, e ele segue brigando pela vaga.",
      focus: () => "Sem promessa. Nada muda.",
      blunt: () => "Sem promessa, e ele não gosta: o humor dele cai.",
      sell: () => "Ele entra na lista de transferências pelo valor dele e fica aliviado. Com a janela fechada, a listagem espera a próxima.",
      refuse: () => "Ele fica, insatisfeito: o humor dele cai, e ele não volta a pedir por algumas semanas.",
      // rc9 LOCKER
      lighten: () => "Ele treina com carga leve até o fim do bloco. Evolui um pouco mais devagar, se desgasta menos e o humor dele melhora.",
      keepLoad: () => "A carga pesada continua. Ele segue cansando, e o humor dele cai.",
      pushHim: () =>
        "Ele treina com carga pesada até o fim do bloco. Evolui mais rápido, mas o desgaste aumenta o risco de ele ficar fora de um evento. O humor dele melhora.",
      holdBack: () => "Nada muda, e ele aceita bem.",
      enterHim: (p: P) => `O time entra n${cupOf(p)} com ele. O humor dele melhora. O resultado depende do rating dele.`,
      passCup: (p: P) => `Ele não joga ${cupOf(p)}, e o humor dele cai um pouco.`,
      startHim: () =>
        "Ele assume a vaga do titular mais fraco só neste regional, e depois a escalação volta. Um trio novo tem menos química, e o titular que sai não gosta. O humor dele melhora.",
      notYet: () => "A escalação fica como está. O humor dele cai um pouco.",
    } as Record<string, (p: P) => string>,
    nowMood: (player: string, mood: string) => `${player} agora está ${mood.toLowerCase()}.`,
    promiseOpened: "A promessa fica aberta no vestiário, na tela do Elenco.",
    toLockerRoom: "Vestiário",
    nowRisk: (player: string) => `Promessa em risco: ${player}`,
    nowRiskHint: "Escale ele no próximo evento, ou a promessa se quebra.",
    toSquad: "Escalar",
  },
  mail: {
    tpl: {
      lockerTalk_bench: (p: P) => `${p.player} quer falar sobre tempo de jogo`,
      lockerTalk_bid: (p: P) => `${p.player} depois da proposta recusada`,
      lockerTalk_request: (p: P) => `${p.player} pede para sair`,
      lockerTalkAuto: (p: P) => `Conversa com ${p.player} encerrada`,
      lockerPromiseKept: (p: P) => `Promessa cumprida: ${p.player}`,
      lockerPromiseBroken: (p: P) => `Promessa quebrada: ${p.player}`,
      lockerMood: (p: P) => (Number(p.count) === 1 ? "Mudança no vestiário" : `${p.count} mudanças no vestiário`),
      lockerListLater: (p: P) => `${p.player}: a venda espera a janela`,
      // rc9 LOCKER
      lockerTalk_load: (p: P) => `${p.player} pede uma carga mais leve`,
      lockerTalk_more: (p: P) => `${p.player} pede mais treino`,
      lockerTalk_side: (p: P) => `${p.player} quer jogar ${cupOf(p)}`,
      lockerTalk_start: (p: P) => `${p.player} pede para ser titular no regional`,
      lockerSwapBack: (p: P) => `${p.player} volta à escalação`,
    } as Record<string, (p: P) => string>,
    body: {
      lockerTalk_bench_0: (p: P) =>
        `${p.player} ficou fora dos últimos ${p.n} eventos e pediu uma conversa com você. Escolha uma resposta abaixo. Promessa feita fica registrada, e promessa quebrada também.`,
      lockerTalk_bench_1: (p: P) =>
        `São ${p.n} eventos seguidos no banco para ${p.player}. Ele pediu à comissão uma reunião sobre o lugar dele no time. A sua resposta dá o tom.`,
      lockerTalk_bench_2: (p: P) =>
        `A comissão avisa que ${p.player} está frustrado depois de ${p.n} eventos seguidos sem jogar. Ele quer ouvir isso de você.`,
      lockerTalk_bid_0: (p: P) =>
        `Você recusou uma proposta por ${p.player}. O interesse mexeu com ele, e ele quer saber qual é a situação dele.`,
      lockerTalk_bid_1: (p: P) =>
        `${p.player} sabe que outro clube fez proposta e que você disse não. Ele pediu uma reunião sobre o futuro dele aqui.`,
      lockerTalk_bid_2: (p: P) =>
        `A proposta recusada por ${p.player} virou assunto no treino. Ele pediu para ouvir os seus planos para ele.`,
      lockerTalk_request_0: (p: P) =>
        `${p.player} está insatisfeito há semanas e pediu formalmente para sair. Vender, prometer ou recusar: a decisão é sua.`,
      lockerTalk_request_1: (p: P) =>
        `Tem um pedido de transferência por escrito de ${p.player} na sua mesa. O humor dele está baixo há várias semanas.`,
      lockerTalk_request_2: (p: P) =>
        `${p.player} quer sair. Segundo a comissão, o humor dele não se recupera há semanas e o pedido é formal.`,
      lockerTalkAuto: (p: P) =>
        `A conversa com ${p.player} ficou uma semana sem resposta, então a comissão encerrou com a resposta neutra: ${ANSWER_LABELS_PT[p.answer as keyof typeof ANSWER_LABELS_PT]?.(p) ?? p.answer}.`,
      lockerPromiseKept_minutes: (p: P) =>
        `${p.player} teve as partidas como titular que ${Number(p.inherited) ? "o técnico anterior prometeu" : "você prometeu"}. O humor dele melhora, e a sua palavra pesa mais no vestiário.`,
      lockerPromiseKept_stay: (p: P) =>
        `A janela fechou e ${p.player} continua no clube, como prometido. O humor dele melhora, e a sua palavra pesa mais no vestiário.`,
      lockerPromiseBroken_minutes: (p: P) =>
        `${Number(p.inherited) ? "O técnico anterior prometeu" : "Você prometeu"} a ${p.player} ${p.need} jogos como titular em ${p.of} eventos, e isso não aconteceu. Ele sentiu o golpe, o elenco percebeu, e a sua próxima promessa vai valer menos.`,
      lockerPromiseBroken_stay: (p: P) =>
        `${p.player} tinha a promessa de ficar até a janela fechar. A promessa foi quebrada: ele sentiu o golpe, o elenco percebeu, e a sua próxima promessa vai valer menos.`,
      lockerMood: (p: P) => `O humor mudou porque ${REASONS_PT[String(p.reason)] ?? String(p.reason)}:\n\n${changesOf(p, MOODS_PT)}`,
      lockerListLater: (p: P) =>
        `Você aceitou vender ${p.player}, mas a janela de transferências está fechada. Coloque ele na lista pelo mercado quando ela abrir; isso não vai incomodá-lo.`,
      // rc9 LOCKER: os pedidos dos próprios jogadores, relatados pela comissão (nunca as palavras dele).
      lockerTalk_load_0: (p: P) =>
        `${p.player} treina com carga pesada há algumas semanas e disse à comissão que está cansado. Ele pede uma carga mais leve.`,
      lockerTalk_load_1: (p: P) =>
        `Segundo a comissão, ${p.player} está sentindo o bloco pesado de treino. Ele perguntou se a carga dele pode baixar.`,
      lockerTalk_load_2: (p: P) =>
        `${p.player} procurou a comissão depois de mais uma semana pesada. Ele quer uma carga mais leve antes do próximo evento.`,
      lockerTalk_more_0: (p: P) =>
        `${p.player} está de bem com a vida e disse à comissão que aguenta mais. Ele pede uma carga mais pesada.`,
      lockerTalk_more_1: (p: P) =>
        `A comissão conta que ${p.player} se sente afiado e quer treinar mais forte até o fim do bloco.`,
      lockerTalk_more_2: (p: P) =>
        `${p.player} pediu trabalho extra à comissão. Ele se sente bem e quer carga pesada.`,
      lockerTalk_side_0: (p: P) => `${p.player} pediu à comissão para colocar o nome dele n${cupOf(p)} desta semana.`,
      lockerTalk_side_1: (p: P) => `${p.player} viu ${cupOf(p)} no calendário e quer jogar. Ele pediu à comissão para falar com você.`,
      lockerTalk_side_2: (p: P) => `A comissão repassa um pedido de ${p.player}: ele gostaria de jogar ${cupOf(p)} desta semana.`,
      lockerTalk_start_0: (p: P) =>
        `${p.player} assistiu aos últimos eventos do banco e pediu à comissão uma vaga de titular no regional desta semana.`,
      lockerTalk_start_1: (p: P) =>
        `Segundo a comissão, ${p.player} quer uma chance no regional. Ele não joga há algum tempo e se sente pronto.`,
      lockerTalk_start_2: (p: P) =>
        `${p.player} perguntou à comissão se pode começar o regional desta semana como titular, em vez de assistir.`,
      lockerSwapBack: (p: P) =>
        `O regional acabou, então ${p.player} retoma a vaga e ${p.sub} volta para o banco. Se quiser manter o trio novo, mude a escalação na tela do Elenco.`,
    } as Record<string, (p: P) => string>,
  },
};
