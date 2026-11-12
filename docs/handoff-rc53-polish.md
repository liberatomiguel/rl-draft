# rc.53 polish — isolated candidate

Base: staging 0cb44a4 (v2.0.0-rc.53). Branch: codex/rc53-final-polish. Candidate: v2.0.0-rc.53-polish.2. This branch does not include the finalizer’s later work and does not deploy main/staging.

## Miguel review, polish.2

- Home CTA restored to the original rc.53 sentence/layout.
- Collection display order is Legendary, Mythic, Epic, Rare, Community, Special; Wings and Creator share the Special group/filter/counter. Stored rarities, card designs and discovery rules are unchanged. Community labels are localized.
- Progression dialog is compact, orange-led, Explore left / Close right. News uses a single brand/date/dismiss masthead, blue side rule and eager crest loading. Desktop capture verifies the 72px Vitality logo, and 390px captures show both dialog layouts without horizontal overflow.
- HQ positive cash feedback confirmed at +$12k beside Balance.
- Typecheck, targeted ESLint and 60 targeted asset/news/HQ/persist tests passed. UI-only follow-up: no career engine/store changes. Static export (736 pages) and postexport checks passed; all 1,351 manifest image URLs exist.

## Changes

- Integrates the package’s catalogue corrections and all 36 supplied portrait crops. Adds the 16 proposed specials with the approved overall/rarity values (including Lethamyr 88). Gibbs uses the historical iBUYPOWER S1 substitute role; Mawkzy uses Lille’s 2021 roster. Base ratings for the new historical records are editorial. No image was AI-generated or retouched.
- Collection: collapsible rarity sections, per-section owned/total counts, both existing filter groups preserved. Locked official cards remain silhouettes. Community/Wings/Creator stay hidden until found; a discovered family gains a section/filter without revealing its undiscovered cards.
- Novelty: independent device-local tab acknowledgements. Opening a destination/subtab clears its dot. Individual NEW tags remain until the card/challenge/cosmetic is opened or selected. No persist key/version or cloud-progress change.
- Home: larger, straight NEW sticker; two-line career CTA; aligned navbar sticker; smaller gap around the hero/rank.
- Season track: consistent banner preview geometry for banner-only and banner-plus-title rewards; separate title area; no duplicated selected-rank heading.
- Locker: click an owned badge in the grid to equip/remove; always-visible remove controls on slots; two slot clicks swap positions; selecting a new badge with three full slots asks which slot to replace.
- RTW: clearer headline hierarchy with large crests retained; restrained progression dialog; shorter honors/race filters. Calendar removes the other-region layer, moves the legend below the month, places advance actions below the calendar, and opens the correct month when an upcoming event is selected.
- Finances/HQ: a small signed amount for the latest ledger operation (prize deductions grouped); charts append actual current cash immediately while keeping the stored Monday ring intact.

## Challenge authoring

45 challenges / 135 stars have legal deterministic replay witnesses. Pure Talent now enforces its advertised no-specials rule; its former no-specials star is replaced by at most two paid rerolls. Schema guards reject redundant no-specials stars on no-specials drafts and reroll stars on scripted drafts. Four fixed seeds were reauthored after the catalogue expansion: Emerald Wall 25118→25119, Topple the Titans 37398→37399, Perfect Storm 29812→29814, Squishy’s Supporting Cast 89023→89024. Existing ids, gates, reward ownership and earned stars are preserved.

## Integration

Review this branch against 0cb44a4, then merge/cherry-pick into the finalizer’s current candidate and resolve any shared-file conflicts. Do not overwrite the finalizer’s work with this checkout. Re-run the combined candidate’s data/contracts/challenge/daily replays and static export; the final catalogue changes seeded draft offers and therefore requires the coordinator’s final balance-matrix review. Miguel should review the supplied desktop/mobile screenshots and play collection/locker/calendar plus one settled tournament. No production/cutover approval is implied.

## Sources for missing bases

Mawkzy/Lille: https://rocketbaguette.com/2021/12/07/la-france-terre-promise-en-rlcs/ and https://liquipedia.net/rocketleague/Lille_Esport. Gibbs/iBUYPOWER: https://liquipedia.net/rocketleague/IBUYPOWER. Photos, proposed overalls and rarities: Miguel’s rocket-draft-pacote-final.zip.

Daily replays were refreshed for all 365 staged dates (2026-11-09 through 2027-11-08). The final catalogue required 98 replacement seeds, including the expired staging date 2026-11-09; this only changes authored puzzles and never rewrites stored results/rewards. The publication candidate has never been deployed to production. All dates have a legal title + bonus replay.

The image build completed: 1,317 optimized assets, 15.82 MB total, generated manifest committed. Browser checks used isolated profile/career fixtures; desktop 1440 px and mobile 390 px. Physical devices and Safari were not tested. Gold (banner + title) and Platinum (banner only) both measured 353.4375 × 80 px. Badge equip/remove/reorder/full-slot replacement and the real $1,500 facility purchase were exercised. Final checks: TypeScript and ESLint passed; the final static export generated all 736 pages. Broad suite: 2,333 passed / 5 failed / 37 skipped, across 195 files (170 passed / 5 failed / 20 skipped). One failure was the branch version identifier, fixed in SITE.version and rechecked (44 tests passed). The other four were the local 5-second test timeout under CPU load; the same assertions passed in targeted runs with local CLI limits of 30/60 seconds (18 + 16 tests). No test assertion or gameplay rule was weakened. The original full invocation is therefore not recorded as an all-green run; all five findings were resolved/rechecked. The staged daily store replay and all challenge reward/reload checks passed in the broad run. Soft-lock probe: SAM/NA Normal tuned, 3 seasons each, 134 lobbies, 0 findings.

The final postexport gate verifies flattened Windows prefetch paths, static assets and staging headers. It passed: 2,079 Windows segment files flattened; all 1,351 manifest URLs present; 729 HTML pages noindexed; 9,189 export files within Cloudflare static-asset limits; accounts/analytics disabled. No server/hosting change.
