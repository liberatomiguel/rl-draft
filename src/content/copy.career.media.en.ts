/**
 * v2.3 MEDIA (wave 2): the media days' strings. Spread into the career copy as
 * `media` (one line). PT twin: copy.career.media.pt.ts, keyed identically.
 *
 * The brands are fictional parodies; none of them is a real company
 * (copy.career.media.test.ts checks the bank against the real names it plays
 * on). A squad player may be a real pro, so no sentence is put in his mouth:
 * the brand asks, the staff report what the save proves (dates, cash, the
 * event he would miss).
 */

type P = Record<string, string | number>;

/** The brand bank. CAREER_MEDIA.brands is its length. */
const BRANDS_EN = [
  "Blue Stag Energy",
  "Tri-Stripe Athletics",
  "Pop-Sip Cola",
  "Logistik Gear",
  "Viper Edge Gaming",
  "Nvidious Graphics",
  "Interlock Chips",
  "Uberly Rides",
  "McDolan's Burgers",
  "Netflux",
  "Spotifly",
  "Amazin' Parcels",
  "Samsong Mobile",
  "Nubanco",
  "iFud Delivery",
] as const;

const DOW_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const brandOf = (p: P): string => BRANDS_EN[Number(p.brand) % BRANDS_EN.length];
const dayText = (dow: unknown, d: unknown, m: unknown): string => `${DOW_EN[(Number(dow) - 1) % 7]} ${d} ${MONTH_EN[(Number(m) - 1) % 12]}`;
const rangeOf = (p: P): string => `from ${dayText(p.fromDow, p.fromD, p.fromM)} to ${dayText(p.toDow, p.toD, p.toM)}`;
const eventsOf = (p: P): string => (p.event2 ? `${p.event} and ${p.event2}` : String(p.event));

export const CAREER_MEDIA_EN = {
  brands: BRANDS_EN as readonly string[],
  /** The buttons under the offer in the inbox (params: player, cash). */
  answers: {
    accept: (p: P) => `Accept: ${p.player} goes (${p.cash})`,
    decline: () => "Decline",
  } as Record<string, (p: P) => string>,
  hint: "An offer you leave unanswered lapses as declined on its deadline. Nothing else changes.",
  /** The line that replaces the buttons once the offer is closed. */
  closed: {
    accepted: (p: P) => `You accepted. ${p.player} is away ${rangeOf(p)}.`,
    declined: () => "You declined.",
    lapsed: () => "No answer came by the deadline, so it lapsed as declined.",
    cancelled: () => "The trip was called off.",
  } as Record<string, (p: P) => string>,
  mail: {
    tpl: {
      mediaOffer: (p: P) => `${brandOf(p)} wants ${p.player} for a media day`,
      mediaCalledOff: (p: P) => `Media day called off: ${p.player}`,
    } as Record<string, (p: P) => string>,
    body: {
      mediaOffer: (p: P) =>
        `${brandOf(p)} has asked for ${p.player} for a media day, away from the club ${rangeOf(p)} (${p.days} days). They pay ${p.cash}.\n\n` +
        (p.event ? `He would miss ${eventsOf(p)}.` : "No event of yours falls on those days.") +
        (Number(p.fatigue) ? `\n\nHe was away on a media day not long ago, and being sent again so soon will weigh on his mood.` : "") +
        `\n\nYou can answer from this message until ${dayText(p.deadlineDow, p.deadlineD, p.deadlineM)}. Left unanswered, it lapses as declined.`,
      mediaCalledOff: (p: P) =>
        p.why === "gone"
          ? `${brandOf(p)} has called off the media day: ${p.player} is no longer at the club. Nothing was paid.`
          : `${brandOf(p)} has called off the media day with ${p.player}: another player is already out for ${p.event}, and the club cannot be left short. Nothing was paid.`,
    } as Record<string, (p: P) => string>,
  },
};

export type CareerMediaCopy = typeof CAREER_MEDIA_EN;
