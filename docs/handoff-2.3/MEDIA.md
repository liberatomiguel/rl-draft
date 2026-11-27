# v2.3 wave 2, front MEDIA: handoff

Branch `v23/media-days` (base `v23/ui-stories` tip, 23a091f). Flag `FEATURES.mediaDays`
(staging build or `NEXT_PUBLIC_MEDIA_DAYS=1`); off in production, playtest, dev and tests.
Decisions R205-R209 in `ROAD-TO-WORLDS-DECISIONS.md`.

## What was built

| Part | File |
|---|---|
| Rules (pure, seeded): roll, who, cash, days, M3 check, lapse, accept, decline, fatigue record | `src/engine/career/mediaDays.ts` |
| Tunables (`CAREER_MEDIA`) | `src/config/balance.mediaDays.ts` |
| Store side: weekly roll, lapse, pay, absence, accept / decline | `src/store/mediaDaysFlow.ts` |
| Accept / decline under the offer (minimum component, **not mounted, not seen in a browser**) | `src/components/career/media/MediaOfferAnswers.tsx` |
| Strings (EN, PT), 15 fictional brands | `src/content/copy.career.media.en.ts`, `.pt.ts` |

## Rules as built

- **M1 roll.** On a write that crosses a Monday: seeded draw (`careerSeed`, season, absolute week).
  Chance `min(0.20, 0.03 + 0.0015 x reputation)`, x `(1 + 0.5 x min(1, followers/4000))` when the fan
  feed is on. Rep 0 / 50 / 100 = 3 % / 10.5 % / 18 % a week. Not before week 3, one open offer at a time,
  2 weeks of cooldown. Player weighted by overall squared. 2 to 4 days, first day 2 to 6 days after the
  Monday, all inside the season. Up to 6 (player, dates) draws.
- **M2.** Inbox mail with dates, cash, the event(s) he would miss (or "no event falls on those days").
  Never holds the clock (it is mail, not a `careerDecisions` item). Lapses as declined the day after
  its deadline (the day before the first away day).
- **M3.** Accepting over a committed event sets `pendingUnavailability = { playerId, eventId, reason: "media" }`
  (the illness / fatigue system; the hub and lobby notices read it). `leavesEnough`: three remain, and a
  starter's seat needs a registered, free reserve. An event with another absentee or a trip already booked
  refuses the date. Only officials count (qualifier, regional, Major, Worlds he is in). A club of three is
  never offered an event date; event-free dates stay possible.
- **M4.** Second trip of the same player within 6 weeks of the first: -6 morale, reason `mediaFatigue`,
  through the new `nudgeMorale` (wave-1 `Step`), only with `FEATURES.lockerRoom`. The offer warns him
  only then.
- **M5.** Cash = `tierValuePerWeek(tier of the reputation)` (season, difficulty) x 1 week x 0.8 / 1 / 1.2
  for 2 / 3 / 4 days, +/- 15 %, quantized. Booked once on the first away day as ledger kind `mediaDay`
  ("Media day", brand as the reference), so Finances shows a named line.

## Numbers and how they were derived

Samples at season 1, Normal, no spread: reputation 20 (tier 1), 3 days: **$750**; reputation 60
(tier 3), 2 days: **$2,900**; reputation 90 (tier 4), 4 days: **$9,350** (tier 4 weekly $7,790 x 1.2). They
come straight from the sponsor tiers' own weekly value, so a media day is about a week of what a typical
sponsor pays at that reputation. Offer frequency is a first guess (about 1 to 5 offers a season). **None of it
is measured in a battery.**

## Every line added to a shared file

| File | Line(s) | Purpose |
|---|---|---|
| `src/config/balance.ts` | `mediaDays:` in FEATURES (+ comment); `export * from "./balance.mediaDays";` (last line); `BALANCE_VERSION` 54 -> 55 | flag, tunables, the fingerprint rule |
| `src/config/balanceVersion.test.ts` | `FINGERPRINT` 54 / `104bb5b0` -> 55 / `ff4d6823` | what its message said |
| `src/config/stagingFlags.test.ts` | `"mediaDays"`, `"NEXT_PUBLIC_MEDIA_DAYS"` | staging-only flag list |
| `src/engine/career/types.ts` | `"mediaDay"` in `LedgerKind`; `"media"` in `pendingUnavailability.reason`; `mediaDays?:` on `CareerSave` | ledger line, absence cause, save field |
| `src/engine/career/lockerRoom.ts` | `"mediaFatigue"` in `MoraleReason`; `nudgeMorale` (new export) | M4 through the wave-1 API |
| `src/content/copy.career.locker.en.ts` / `.pt.ts` | `mediaFatigue` in `REASONS` | the visible reason |
| `src/content/copy.career.en.ts` / `.pt.ts` | import; `media:` (last key); `media` in `hub.absenceReasons`; `mediaDay` in `finances.ledgerKind` | strings |
| `src/components/career/news/newsText.ts` | `?? career.media.mail.tpl/body[...]` in `resolveMail` (2 lines edited) | the inbox reads the media mail |
| `src/store/careerStore.ts` | import; `answerMediaOffer` in the interface and the actions; `mediaDaysAfter(...)` in `withSave` and `withResult` | the hooks |

No change to `careerFlow.ts`, `calendar.ts`, `sunday.ts`, `board.ts`, `mandate.ts`, the event screens,
`components/career/locker/*`, `SquadScreen`, `NewsScreen`, `HubScreen` or `hub/NowCards`.

## The UI gap (tell Miguel)

The existing mail path renders the offer (title, dates, cash, event) but has no buttons, and
`LockerTalkAnswers` is bound to locker talks. `MediaOfferAnswers` is written and takes the same props; it
needs one line in `screens/NewsScreen.tsx`, in `MailReader` next to `<LockerTalkAnswers />`:

```tsx
import { MediaOfferAnswers } from "@/components/career/media/MediaOfferAnswers"; // v2.3 MEDIA
...
<MediaOfferAnswers item={item} C={C} /> {/* v2.3 MEDIA */}
```

Until it is mounted, accept and decline exist only as the store action `answerMediaOffer(offerId, accept)`
(tested); an unanswered offer lapses as declined. Not seen in a browser.

## Tests (all green, one file at a time)

- `src/engine/career/mediaDays.test.ts` (14): determinism per seed; days, start, deadline bounds; chance by
  reputation and followers; first week, one open offer, cooldown; events named exactly; lapse on the deadline and
  not before; `leavesEnough`; club of three never offered an event date; a taken event refuses the date; accept
  makes him away exactly those days, cash due from the first day, once; late / answered / gone answers refused;
  decline changes only the status; fatigue window; cash against the sponsor tier.
- `src/store/mediaDaysFlow.test.ts` (12): flag off (six-week walk byte-identical, no field, answer refused,
  hook inert even with the chance at 100 %); flag on (offers deterministic, mail resolves EN and PT); accept over
  real walked days (away exactly the days, one ledger line of the offer's cash); decline and lapse change nothing
  else; late and second answers refused; accept over a committed regional sets the absence and he does not play;
  a taken seat cancels the trip; the named event matches the calendar; no event date for a club of three; fatigue
  lowers morale with the locker room on (visible reason in `last` and the log), nothing with it off, nothing outside
  the window.
- `src/content/copy.career.media.test.ts` (4): EN/PT key parity and spread; 15 brands, none repeated, count equals
  the config; no brand is or contains, as a word, any of 50 real names (the ones parodied and others); every mail key
  renders in both languages.
- Re-run green: `balanceVersion`, `stagingFlags`, `lockerRoom`, `copy.career.locker`, `orgCopy`, `newsView`,
  `persistContract`.

## Not verified

- No browser: the mail, the buttons (not even mounted), the absence notice and the Finances line were never seen.
- No full suite, no build, no soft-lock probe, no battery: no number is measured.
- Writes that bypass the store's `withSave` / `withResult` (bots, probes) do not run media days.
- A random illness roll that lands after the accept for the same event cancels the trip (R207); a player sold before the
  first away day cancels it. Neither was played through a full season.
- The locker room counts an event he misses as a sat-out event (wave-1 rule, R191).
- The fan-feed lift of the chance is tested only on the pure function.

## Three sample offers (as the inbox reads them, from `resolveMail`)

**1 (EN).** Blue Stag Energy wants Vatira for a media day. "Blue Stag Energy has asked for Vatira for a media day,
away from the club from Wed 12 Mar to Fri 14 Mar (3 days). They pay $750. He would miss EU Regional 2. You can
answer from this message until Tue 11 Mar. Left unanswered, it lapses as declined."

**1 (PT).** Blue Stag Energy quer Vatira num dia de mídia. "A Blue Stag Energy pediu Vatira para um dia de mídia, fora
do clube de qua 12/03 a sex 14/03 (3 dias). Eles pagam $750. Ele perderia EU Regional 2. Você pode responder por esta
mensagem até ter 11/03. Sem resposta, a oferta vence como recusada."

**2 (EN, no event).** Uberly Rides wants Zen for a media day. "Uberly Rides has asked for Zen for a media day, away
from the club from Mon 9 Jun to Tue 10 Jun (2 days). They pay $2,900. No event of yours falls on those days. You can
answer from this message until Sun 8 Jun. Left unanswered, it lapses as declined."

**2 (PT).** Uberly Rides quer Zen num dia de mídia. "A Uberly Rides pediu Zen para um dia de mídia, fora do clube de
seg 09/06 a ter 10/06 (2 dias). Eles pagam $2,900. Nenhum evento do seu time cai nesses dias. Você pode responder por
esta mensagem até dom 08/06. Sem resposta, a oferta vence como recusada."

**3 (EN, two events, repeat, locker room on).** McDolan's Burgers wants Squishy for a media day. "McDolan's Burgers has
asked for Squishy for a media day, away from the club from Thu 15 Oct to Sun 18 Oct (4 days). They pay $9,350. He would
miss EU Qualifier 2 and EU Regional 2. He was away on a media day not long ago, and being sent again so soon will weigh
on his mood. You can answer from this message until Wed 14 Oct. Left unanswered, it lapses as declined."

**3 (PT).** McDolan's Burgers quer Squishy num dia de mídia. "A McDolan's Burgers pediu Squishy para um dia de mídia,
fora do clube de qui 15/10 a dom 18/10 (4 dias). Eles pagam $9,350. Ele perderia EU Qualifier 2 e EU Regional 2. Ele
esteve num dia de mídia há pouco tempo, e ser enviado de novo tão cedo vai pesar no humor dele. Você pode responder por
esta mensagem até qua 14/10. Sem resposta, a oferta vence como recusada."
