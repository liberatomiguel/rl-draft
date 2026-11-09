# rc.38 — cosmetic review / validation

Base: remote staging `7cccb3463c12a90ac0dcbbc66420a1f9867e130f`, fetched again
before release. Only staging is a publication target; main / production are
outside this change. Version: 2.0.0-rc.38.

## Changes and audits

See CHANGELOG.md, COSMETICS-CATALOG.md, SPECIAL-CARDS-MISSING-rc38.md,
UNLOCK-COPY-AUDIT-rc38.md and COSMETIC-SUGGESTIONS-rc38.md. The latter is only
proposals; none of its rewards / counters / art / IDs were registered.

The catalog contains 90 cosmetics: 35 badges, 37 titles, 18 banners. Saved IDs
and persist keys/versions stay stable. Underdog's cosmetic is retired and old
equipment is sanitized; the independent career achievement remains. Historical
Road Warrior XP is not replayed or removed, while new grants require season four.

## Validation

- Full suite: `npm test -- --maxWorkers=2 --testTimeout=30000` — 2099 passed,
  28 skipped, 165 files. An initial run with four workers hit time limits in
  three career tests. Removed unnecessary repeated profile writes from the new
  cosmetic fact integration; final suite passed with two workers.
- Added real renderer/store matrix, run separately after collection of the
  full suite: 15 passed (`GameCard.visibility.test.ts`). Classic + Quick across
  Easy/Normal/Hard/Legacy, optional/forced visibility, restart, five playable
  regions, hidden + visible daily templates, authored Challenges, collected /
  uncollected cards, local / explicit photo sources. Authored Challenges remain
  visible even when their simulation difficulty is Hard/Legacy.
- TypeScript and ESLint checked. Build prechecks: 100 data tests passed / 1
  skipped, 35 persist-contract tests passed. Staging static export succeeded;
  all 1073 generated image URLs exist, 1991 files / 51.29 MB.
- Flags: career=1, noindex=1, playtest unset, no Supabase/PostHog environment
  variables. Postexport confirms accounts and analytics disabled, career on.
- Asset source art is unchanged. Local Windows image generation rewrote hashes
  for some existing images; the generated export uses its own consistent map,
  but those platform-only manifest changes are not committed.

## Real visual flow

Screenshots were captured from the actual application components and engine,
not illustrations or reconstructed layouts. Local QA controller prepared a
disposable profile (1499 XP) and hunted real random offers; it was removed before
the build. No QA route or controller is published. Some local captures show the
old rc.37 footer because the version bump followed the captures; they already
contain the final visual changes.

- Hidden Classic/Normal, seed 152723592: Torsos (`sp-torsos-oce-longevity`) in
  the Cringe Society offer. Draft/review contain no special photo image URL.
- That run was drafted and simulated through the real store. Results load
  Torsos's PNG successfully; the special ceremony, Bronze → Silver ceremony,
  then Circuit / Challenger / Card Hunter individual unlocks were captured.
- Visible Classic/Normal, seed 479603461: caard + caiotg1 offer photos both load.
- Actual profile preview tools expose the locker and 50/50 Staff fallback;
  season track was checked with Silver selected. Actual login calendar is
  mounted with day-30 data, showing Spark/Wildfire at the new size.
- Captures delivered in the chat's outputs directory: login-diario.jpg,
  special-draft-oculto.jpg, special-review-oculto.jpg, special-reveal.jpg,
  team-reveal-final.jpg, special-draft-normal.jpg, season-track.jpg, rank-up.jpg,
  cosmetic-unlock-posterior.jpg, rank-title-unlock-posterior.jpg,
  cosmetics-titles.jpg and cosmetics-badges.jpg.

## Pending assets / database

50/50 Staff manual grant ID: `50-50-staff`, gives badge `50-50-staff` and title
`grant-title-50-50-staff`. Its image is intentionally pending. Integrate Miguel's
future art into `data-sources/badges/badges-gema-moldura.html`, generating
`public/badges/50-50-staff.svg` with `npm run build:badges`; run `build:images`
and version the manifest. The existing text fallback automatically gives way
to built artwork; no fabricated image is supplied.

`docs/sql/rc38-staff-grant.sql` adds the new allowed grant ID without granting it
to anyone or changing RLS. It is ready but not applied: this isolated staging
export has accounts disabled and no administrative staging Supabase connection
was available. Apply only to the staging project before issuing this online
grant. The full schema/runbook includes the allowed ID for future setup.
