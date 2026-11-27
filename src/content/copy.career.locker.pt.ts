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
};

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
};

export const CAREER_LOCKER_PT: CareerLockerCopy = {
  moods: MOODS_PT as Record<string, string>,
  reasons: REASONS_PT,
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
    } as Record<string, (p: P) => string>,
  },
};
