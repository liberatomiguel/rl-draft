# SKIP handoff (v2.3.0-dev, R200)

Branch `v23/skip-guard`. The batched Skip and the autoplay stop once on the Monday a multi-week transfer window enters its last week; one `windowClosing` news item that day.

- Predicate: `isWindowLastWeekStart(day)`, end of `src/engine/career/calendar.ts`. False for the one-week Worlds window.
- Stop: `isStopState` (`careerFlow.ts`) and the effect in `CareerAutopilot.tsx`, both guarded so a second press goes on.
- Notice: pushed in `processDayArrival` next to `windowOpen`; copy `windowClosing` (title and body) in `copy.career.en/pt.ts`; kind added to PUBLIC_KEYS in `communications.ts`.
- Tests: `src/store/careerWindowClosing.test.ts`.
- Not verified: browser, full suite, soft-lock probe.
- Merge note: all added lines are marked `// v2.3 SKIP`; expect trivial conflicts in `careerFlow.ts`, `calendar.ts` (file end) and the copy files.
