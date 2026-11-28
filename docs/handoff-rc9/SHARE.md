# SHARE handoff (rc.9)

Finished from the WIP in `10b23ca4`. DESIGN-DECISIONS #255 to #262, CHANGELOG "SHARE front".

## What changed
- Invite: `components/share/InviteSheet.tsx`, `lib/share/inviteText.ts` (three first-person messages: won, career, draft; EN and PT). `inviteImage.ts` deleted. `ShareSheet` labels the box "The message" when there is no image.
- Prompts: `lib/share/sharePrompts.ts` (+test), `components/share/SharePrompts.tsx`, numbers in `config/balance.sharePrompts.ts`, record in the plain key `rocket-draft:share-prompts:v1`. Mounted from `RunShareSheet` and `CareerShareButton` (event title screen, season review). The opt-out moved under the preview (three buttons wrapped on desktop).
- Images: `canvasKit.ts` (two-line headline), `runImage.ts`, `careerImage.ts`, `careerShare.ts`; the banner through `shareBanner.ts`. This pass: no truncated headline, one wordmark per story, the career story without the crest-on-every-card hand.
- Copy: `copyFailed` pointed up at text that sits below. Audit items for `SHARE_UI` were already applied in the WIP; `share.buttonTitle` kept (it is the title screen's label, not a tooltip).

## Evidence
- 32 PNGs from the running app in `.claude/rc9/shots/share/` (run title / placement, career title / season; Post and Story; EN and PT; plain and with the worst-contrast banner, `challenge-banner-back-to-basics`), plus `wip-*` (the state I found). Each one opened and checked.
- Banner contrast over all 27 banners: worst text box 4.52:1.
- Prompts and invite sheet at 1280 and 375: measured in the DOM (no sideways scroll, 44 px targets on the phone, two actions in one row on desktop, Escape closes, focus ring on Tab, accept opens the invite sheet). The shared pane is 482 px wide, so the saved jpgs are partial views.

## Not verified
- A phone's native share sheet and a real clipboard (automation clicks have no user activation: the copy failed and showed its notice).
- That production drops the dev bench: by code (the `NODE_ENV` branch), no build was run.
- The prompts' timing in a real run or career (the rules are tested; the bench forces them).

## For Miguel
- **Cosmetic proposal (#262):** a "Share frame" slot. Owned frames set the image's hairline colour and a small corner mark (e.g. a rank frame at Diamond, a Daily-streak frame, a Worlds frame from the career); the gold title frame stays earned per image. Cheap: one colour and one SVG mark per item, drawn by `drawImageFrame`.
- The invite after a runner-up or third place counts as "went well"; say if only titles should.
