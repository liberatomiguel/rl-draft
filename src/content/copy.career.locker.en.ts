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
  mediaFatigue: "he was sent to another media day so soon after the last", // v2.3 MEDIA
  managerPost: "the manager spoke to the fans after the series", // rc9 STORIES
  // rc9 LOCKER
  goodResults: "the team is winning more series than its rating promised",
  poorResults: "the team is losing series it was expected to win",
  goodForm: "he has outplayed his teammates in recent games",
  poorForm: "his recent games have been below his teammates'",
  heavyLoad: "the heavy training load is wearing him down",
  rested: "he had a lighter training week",
  heard: "the manager said yes to what he asked for",
  passedOver: "the manager turned down what he asked for",
  madeWay: "he lost his seat to a reserve for one event",
  sideEvent: "he played a side event",
};

/**
 * rc9 LOCKER (R218): one line per reason for the mood chip on Squad and HQ,
 * read as "Why: …". Present tense, what the save shows.
 */
const WHY_EN: Record<string, string> = {
  bench: "Sitting out events",
  played: "Playing",
  backInSide: "Back in the lineup",
  title: "A title won",
  deepRun: "A deep run at a big event",
  losingRun: "A run of early exits",
  listed: "Put on the transfer list",
  promiseMade: "You made him a promise",
  promiseKept: "You kept your word",
  promiseBroken: "You broke a promise to him",
  teammateBroken: "You broke a promise to a teammate",
  blunt: "Your blunt answer",
  refused: "His transfer request refused",
  agreedSale: "You agreed to let him go",
  settling: "Time has passed",
  inherited: "Left unsettled by the previous manager",
  mediaFatigue: "Too many media days",
  goodResults: "Results above the team's rating",
  poorResults: "Results below the team's rating",
  goodForm: "Playing above his teammates",
  poorForm: "Playing below his teammates",
  heavyLoad: "A heavy training load",
  rested: "A lighter training week",
  heard: "You said yes to his request",
  passedOver: "You turned down his request",
  madeWay: "Benched for a reserve",
  sideEvent: "Played a side event",
  managerPost: "Your post to the fans", // rc9 STORIES
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

const ANSWER_LABELS_EN = {
  promiseMinutes: (p: P) => `Promise him ${p.need} starts in the next ${p.of} events`,
  promiseStay: () => "Promise he stays through the window",
  earnIt: () => "Tell him to earn his place in training",
  focus: () => "Tell him to focus on the next event",
  blunt: () => "Tell him the lineup is not up for discussion",
  sell: () => "Agree to sell him",
  refuse: () => "Refuse the request",
  // rc9 LOCKER
  lighten: () => "Give him a light load until the training block ends",
  keepLoad: () => "Keep the plan as it is",
  pushHim: () => "Give him a heavy load until the training block ends",
  holdBack: () => "Keep his load where it is",
  enterHim: () => "Enter the cup with him",
  passCup: () => "Leave the cup this time",
  startHim: () => "Start him in the regional",
  notYet: () => "Keep the lineup",
};

/** rc9 LOCKER: "the 1v1 cup" / "the 2v2 cup" when the size is known, else "the cup". */
const cupOf = (p: P): string => (Number(p.size) === 1 || Number(p.size) === 2 ? `the ${p.size}v${p.size} cup` : "the cup");

export const CAREER_LOCKER_EN = {
  moods: MOODS_EN as Record<string, string>,
  reasons: REASONS_EN,
  /** rc9 LOCKER (R218): the mood chip's reason line. */
  why: WHY_EN,
  /** rc9 LOCKER (R217): the match effect line in a player's sheet (points = rating points, signed). */
  matchLine: (points: number) =>
    points === 0 ? "No effect on his match rating." : `${points > 0 ? "+" : "−"}${Math.abs(points)} to his match rating while he feels this way.`,
  trend: { up: "Rising", down: "Falling", steady: "Steady" } as Record<string, string>,
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
      // rc9 LOCKER
      lighten: () => "He trains on a light load until the block ends. He grows a little slower, wears less, and his mood lifts.",
      keepLoad: () => "The heavy load stays. He keeps tiring, and his mood drops.",
      pushHim: () =>
        "He trains on a heavy load until the block ends. He grows faster, but the wear raises his risk of missing an event. His mood lifts.",
      holdBack: () => "Nothing changes, and he takes it well.",
      enterHim: (p: P) => `You enter ${cupOf(p)} with him in the side. His mood lifts. The result depends on his own rating.`,
      passCup: (p: P) => `He does not play ${cupOf(p)}, and his mood drops a little.`,
      startHim: () =>
        "He takes the weakest starter's seat for this regional only, then the lineup goes back. A new trio has less chemistry, and the starter who makes way is not pleased. His mood lifts.",
      notYet: () => "The lineup stays. His mood drops a little.",
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
      // rc9 LOCKER
      lockerTalk_load: (p: P) => `${p.player} asks for a lighter load`,
      lockerTalk_more: (p: P) => `${p.player} asks for more training`,
      lockerTalk_side: (p: P) => `${p.player} wants to play ${cupOf(p)}`,
      lockerTalk_start: (p: P) => `${p.player} asks to start the regional`,
      lockerSwapBack: (p: P) => `${p.player} is back in the lineup`,
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
      // rc9 LOCKER: the players' own requests, reported by the staff (never his words).
      lockerTalk_load_0: (p: P) =>
        `${p.player} has trained on a heavy load for several weeks and told the staff he is tired. He asks for a lighter load.`,
      lockerTalk_load_1: (p: P) =>
        `The staff say ${p.player} is feeling the heavy training block. He has asked whether his load can come down.`,
      lockerTalk_load_2: (p: P) =>
        `${p.player} went to the staff after another heavy week. He wants a lighter load before the next event.`,
      lockerTalk_more_0: (p: P) =>
        `${p.player} is in good spirits and told the staff he can handle more. He asks for a heavier load.`,
      lockerTalk_more_1: (p: P) =>
        `The staff report that ${p.player} feels sharp and wants to train harder until the block ends.`,
      lockerTalk_more_2: (p: P) =>
        `${p.player} has asked the staff for extra work. He feels good and wants a heavy load.`,
      lockerTalk_side_0: (p: P) =>
        `${p.player} has asked the staff to put his name down for ${cupOf(p)} this week.`,
      lockerTalk_side_1: (p: P) =>
        `${p.player} saw ${cupOf(p)} on the calendar and wants to play it. He asked the staff to check with you.`,
      lockerTalk_side_2: (p: P) =>
        `The staff pass on a request from ${p.player}: he would like to enter ${cupOf(p)} this week.`,
      lockerTalk_start_0: (p: P) =>
        `${p.player} has watched the last events from the bench and asked the staff for a start in the regional this week.`,
      lockerTalk_start_1: (p: P) =>
        `The staff say ${p.player} wants a chance in the regional. He has not played for a while and feels ready.`,
      lockerTalk_start_2: (p: P) =>
        `${p.player} asked the staff whether he can start the regional this week instead of watching it.`,
      lockerSwapBack: (p: P) =>
        `The regional is over, so ${p.player} takes his seat back and ${p.sub} returns to the bench. Change the lineup on the Squad screen if you want to keep the new trio.`,
    } as Record<string, (p: P) => string>,
  },
};

export type CareerLockerCopy = typeof CAREER_LOCKER_EN;
