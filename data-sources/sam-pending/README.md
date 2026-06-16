# SAM Top-8 — STAGING (not active yet)

This folder is **inert**: `scripts/build-dataset.mjs` only reads
`data-sources/teams.md` (and `src/data/specialCards.json`), so nothing here
affects the game until it's explicitly merged. It's staged in-repo so it travels
across machines via git.

It holds the **South America (SAM) regional Top-8 dataset** for the upcoming
**"SAM Only" mode** — the 45 Top-8 SAM teams (S7→2025) that did NOT reach
RLCS Worlds/Finals (each block carries `flag: sam-only`). The general draft keeps
showing only today's Worlds/Finals teams.

- **`teams-sam.md`** — the 45 new lineups, in `teams.md` block format + the
  `flag: sam-only` line. Pasteable into the matching `## Season …` sections.
- **`sam-merge-notes.md`** — START HERE to merge. §1 = step-by-step; §2 = the
  generator change for the flag; §4 = `COUNTRY` additions; §5 = dedup/collision
  map; §3 = overall methodology; §6 = per-season Top-8 tables; §7 = possible
  corrections to existing finals teams; §8 = Liquipedia sources.
- **`validate-sam.mjs`** — re-validate after editing:
  `node data-sources/sam-pending/validate-sam.mjs data-sources/teams.md data-sources/sam-pending/teams-sam.md`
  (checks for duplicate lineup ids + parse/flag errors).

To activate: do `sam-merge-notes.md` §2 (wire the flag) FIRST, then §1.
