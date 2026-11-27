/**
 * v2.3 LOCKER (wave 1): the locker room's strings — moods, reasons, the
 * talks' mail and answers, promise settlements. Spread into the career copy
 * as `locker` (one line). PT twin: copy.career.locker.pt.ts, keyed identically.
 *
 * Rule (HISTORIAS-SPEC): a squad player may be a real pro, so no sentence is
 * ever put in his mouth. The staff report what the save proves (the events he
 * sat out, the bid, the list); the manager's answers are the manager's words.
 */

type P = Record<string, string | number>;

const MOODS_EN = {
  angry: "Angry",
  unhappy: "Unhappy",
  neutral: "Settled",
  content: "Content",
  delighted: "Delighted",
} as const;

/** Why a mood moved: completes "… because …" in the mood mail. */
const REASONS_EN: Record<string, string> = {
  bench: "he keeps sitting out events",
  played: "he is playing",
  backInSide: "he is back in the lineup",
  title: "the club won a title",
  deepRun: "the club went deep at a big event",
  losingRun: "the results keep going the wrong way",
  listed: "he was put on the transfer list",
  promiseMade: "the manager made him a promise",
  promiseKept: "the manager kept his word",
  promiseBroken: "the manager broke a promise to him",
  teammateBroken: "the manager broke a promise to a teammate",
  blunt: "the manager gave him a blunt answer",
  refused: "his transfer request was refused",
  agreedSale: "the club agreed to let him go",
  settling: "time has passed",
  inherited: "the previous manager left the room unsettled",
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

const ANSWER_LABELS_EN = {
  promiseMinutes: (p: P) => `Promise him ${p.need} starts in the next ${p.of} events`,
  promiseStay: () => "Promise he stays through the window",
  earnIt: () => "Tell him to earn his place in training",
  focus: () => "Tell him to focus on the next event",
  blunt: () => "Tell him the lineup is not up for discussion",
  sell: () => "Agree to sell him",
  refuse: () => "Refuse the request",
};

export const CAREER_LOCKER_EN = {
  moods: MOODS_EN as Record<string, string>,
  reasons: REASONS_EN,
  /** The talk's answer buttons in the inbox (params: need, of). */
  answers: ANSWER_LABELS_EN as Record<string, (p: P) => string>,
  answeredLabel: (answer: string) => `Your answer: ${answer}.`,
  answeredAuto: (answer: string) => `No answer came in time. The staff answered for you: ${answer}.`,
  talkHint: "A talk you leave unanswered resolves itself with the neutral answer after a week.",
  /** v2.3 UI (wave 2): the screens — the locker room on Squad, the mood sheet, the talk, the HQ card. */
  ui: {
    title: "Locker room",
    lead: "How the players feel, the promises you made and the talks waiting for you.",
    room: "The room",
    whyOf: (player: string) => `Why ${player} feels this way`,
    recent: "What moved him",
    noChanges: "Nothing has moved him yet. A player with no history is settled.",
    word: "Your word",
    kept: "Kept",
    broken: "Broken",
    wordLine: {
      fresh: "No promise settled yet. A new promise calms with its normal weight.",
      trusted: "The room trusts your word: a new promise calms more.",
      damaged: "Your word is damaged: a new promise calms less, and a liar's calms nothing.",
    } as Record<string, string>,
    promises: "Open promises",
    noPromises: "No open promises.",
    hisPromise: "His promise",
    promiseOf: {
      minutes: (need: number, of: number) => `${need} starts in his next ${of} events`,
      stay: () => "Not sold or listed before the window closes",
    } as Record<string, (need: number, of: number) => string>,
    progress: (started: number, need: number, left: number) =>
      `${started} of ${need} starts, ${left === 1 ? "1 event" : `${left} events`} left`,
    stayUntil: (date: string) => `Until ${date}`,
    lapses: (date: string) => `Lapses ${date}`,
    atRisk: "One more event on the bench breaks it.",
    inherited: "Made by the previous manager",
    talks: "Waiting for you",
    fromStaff: "The staff report",
    answerBy: (date: string) => `Answer by ${date}`,
    defaultTag: "If you do not answer",
    commits: {
      promiseMinutes: (p: P) =>
        `A promise: he starts ${p.need} of the next ${p.of} events. Kept, his mood lifts and your word gains weight. Broken, he and the squad take it hard.`,
      promiseStay: () => "A promise: he is not sold or listed before the window closes. Listing him breaks it.",
      earnIt: () => "No promise. Nothing changes, and he keeps fighting for a place.",
      focus: () => "No promise. Nothing changes.",
      blunt: () => "No promise, and he takes it badly: his mood drops.",
      sell: () => "He goes on the transfer list at his value and he is relieved. In a closed window the listing waits for the next one.",
      refuse: () => "He stays, unhappy: his mood drops, and he will not ask again for a few weeks.",
    } as Record<string, (p: P) => string>,
    nowMood: (player: string, mood: string) => `${player} is ${mood.toLowerCase()} now.`,
    promiseOpened: "The promise is open in the locker room, on the Squad screen.",
    toLockerRoom: "Locker room",
    nowRisk: (player: string) => `Promise at risk: ${player}`,
    nowRiskHint: "Start him in the next event, or the promise breaks.",
    toSquad: "Pick the lineup",
  },
  mail: {
    tpl: {
      lockerTalk_bench: (p: P) => `${p.player} asks about his playing time`,
      lockerTalk_bid: (p: P) => `${p.player} after the refused bid`,
      lockerTalk_request: (p: P) => `${p.player} hands in a transfer request`,
      lockerTalkAuto: (p: P) => `Talk with ${p.player} closed`,
      lockerPromiseKept: (p: P) => `Promise kept: ${p.player}`,
      lockerPromiseBroken: (p: P) => `Promise broken: ${p.player}`,
      lockerMood: (p: P) => (Number(p.count) === 1 ? "A change in the locker room" : `${p.count} changes in the locker room`),
      lockerListLater: (p: P) => `${p.player}: the sale waits for the window`,
    } as Record<string, (p: P) => string>,
    body: {
      lockerTalk_bench_0: (p: P) =>
        `${p.player} has sat out the last ${p.n} events and has asked for a word with you. Pick an answer below. A promise is remembered, and so is a broken one.`,
      lockerTalk_bench_1: (p: P) =>
        `${p.n} events in a row on the bench for ${p.player}. He has asked the staff for a meeting about his place in the side. Your answer sets the tone.`,
      lockerTalk_bench_2: (p: P) =>
        `The staff report that ${p.player} is frustrated after ${p.n} straight events without playing. He wants to hear it from you.`,
      lockerTalk_bid_0: (p: P) =>
        `You turned down a bid for ${p.player}. The interest has unsettled him and he has asked where he stands.`,
      lockerTalk_bid_1: (p: P) =>
        `${p.player} knows another club bid for him and that you said no. He has asked for a meeting about his future here.`,
      lockerTalk_bid_2: (p: P) =>
        `The refused bid for ${p.player} is the talk of the training room. He has asked to hear your plans for him.`,
      lockerTalk_request_0: (p: P) =>
        `${p.player} has been unhappy for weeks and has formally asked to leave. Sell, promise or refuse: the choice is yours.`,
      lockerTalk_request_1: (p: P) =>
        `A written transfer request from ${p.player} is on your desk. His mood has been low for several weeks.`,
      lockerTalk_request_2: (p: P) =>
        `${p.player} wants out. The staff say his mood has not recovered in weeks and the request is formal.`,
      lockerTalkAuto: (p: P) =>
        `The talk with ${p.player} went unanswered for a week, so the staff closed it with the neutral answer: ${ANSWER_LABELS_EN[p.answer as keyof typeof ANSWER_LABELS_EN]?.(p) ?? p.answer}.`,
      lockerPromiseKept_minutes: (p: P) =>
        `${p.player} got the starts he was promised${Number(p.inherited) ? " by the previous manager" : ""}. His mood lifts, and your word counts for more in the room.`,
      lockerPromiseKept_stay: (p: P) =>
        `The window closed with ${p.player} still here, as promised. His mood lifts, and your word counts for more in the room.`,
      lockerPromiseBroken_minutes: (p: P) =>
        `${p.player} was promised ${p.need} starts in ${p.of} events${Number(p.inherited) ? " by the previous manager" : ""} and did not get them. He takes it hard, the squad notices, and your next promise will carry less weight.`,
      lockerPromiseBroken_stay: (p: P) =>
        `${p.player} was promised he would stay through the window. That promise is broken: he takes it hard, the squad notices, and your next promise will carry less weight.`,
      lockerMood: (p: P) => `Mood changes, because ${REASONS_EN[String(p.reason)] ?? String(p.reason)}:\n\n${changesOf(p, MOODS_EN)}`,
      lockerListLater: (p: P) =>
        `You agreed to sell ${p.player}, but the transfer window is closed. Put him on the list from the market when it opens; it will not upset him.`,
    } as Record<string, (p: P) => string>,
  },
};

export type CareerLockerCopy = typeof CAREER_LOCKER_EN;
