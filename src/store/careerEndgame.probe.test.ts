/** ENDGAME=1: full difficulty × founding roster × region matrix, real paid purchases.
 * ENDGAME_REGIONS, ENDGAME_DIFFS, ENDGAME_ROSTERS, ENDGAME_SEEDS (default 1),
 * ENDGAME_SEASONS (default 8), ENDGAME_SLICE=i/4, ENDGAME_OUT.
 * Small stage/lineup samples can be replayed separately; no money, rep or OVR grants.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { BALANCE_VERSION, CAREER_GEAR, CAREER_SEASONS } from "@/config/balance";
import { fastForward, initFieldTournament, userPlacement } from "@/engine/tournament";
import { gearCompetitiveBonus } from "@/engine/career/economy";
import { createRng } from "@/lib/rng";
import type { CareerDifficulty, CareerSave } from "@/engine/career/types";
import type { Region, TournamentTeam } from "@/engine/types";
import { playArcCareer, type ArcPolicyId } from "./careerArcBot";

const env = process.env;
const list = <T extends string>(s: string | undefined, defaults: T[]): T[] => s ? s.split(",") as T[] : defaults;
type Roster = "balanced" | "prospects" | "journeymen";

it.skipIf(!env.ENDGAME)("measures paid full-support managers in every difficulty, founding roster and region", () => {
  const control = env.ENDGAME_CONTROL ? JSON.parse(readFileSync(env.ENDGAME_CONTROL, "utf8")).configuration as typeof CAREER_GEAR : null;
  if (env.ENDGAME_VARIANT === "baseline") {
    if (!control) throw new Error("A baseline sensitivity run requires ENDGAME_CONTROL");
    Object.assign(CAREER_GEAR, { ...structuredClone(control), items: control.items.map(i => ({ ...i, ratingBonus: i.ratingBonus ?? 0 })) });
  }
  const diffs = list<CareerDifficulty>(env.ENDGAME_DIFFS, ["easy", "normal", "hard"]);
  const regions = list<Region>(env.ENDGAME_REGIONS, ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"]);
  const rosters = list<Roster>(env.ENDGAME_ROSTERS, ["balanced", "prospects", "journeymen"]);
  const seeds = Number(env.ENDGAME_SEEDS ?? 1);
  const [slice, slices] = (env.ENDGAME_SLICE ?? "0/1").split("/").map(Number);
  const cells = regions.flatMap(region => diffs.flatMap(difficulty => rosters.flatMap(rosterKey =>
    Array.from({ length: seeds }, (_, k) => ({ region, difficulty, rosterKey, seed: 9100 + k * 7919 })))));
  const careers: unknown[] = [];
  const configuration = structuredClone(CAREER_GEAR);
  if (env.ENDGAME_REPLAY && !control) throw new Error("Replay requires ENDGAME_CONTROL pointing to the baseline configuration dump");
  const write = () => { if (env.ENDGAME_OUT) writeFileSync(env.ENDGAME_OUT, JSON.stringify({ balanceVersion: BALANCE_VERSION, variant: env.ENDGAME_VARIANT ?? "candidate", timelineSeasons: CAREER_SEASONS.length, configuration, careers })); };
  write();
  for (const [i, cell] of cells.entries()) {
    if (i % slices !== slice) continue;
    const support: unknown[] = [];
    const events: unknown[] = [];
    let frozenWorlds: { season: number; field: TournamentTeam[]; ratingChange: number } | null = null;
    const observe = (save: CareerSave) => {
      const ev = save.activeEvent;
      if (!ev || (ev.def.tier !== "worlds" && ev.def.tier !== "major")) return;
      const teams = Object.values(ev.tournament.teams);
      const user = ev.tournament.teams.user;
      const opponents = teams.filter(t => !t.isUser).map(t => t.rating.total);
      if (ev.def.tier === "worlds" && save.clock.seasonIndex < CAREER_SEASONS.length) {
        // Isolate the new flat-rating facilities/camp benefit on exactly the
        // same paid roster and actual World field. Psychology stays identical
        // on both sides of this comparison; it is NOT a title forecast per start.
        const oldPermanent = control?.items.reduce((sum, item) => sum + (save.finances.gear[item.id] ? item.ratingBonus ?? 0 : 0), 0) ?? gearCompetitiveBonus(save.finances.gear);
        const isStructured = save.finances.bootcampSharp === CAREER_GEAR.bootcamp[1].sharpRating * CAREER_GEAR.bootcampSplitEdgeShare;
        const oldSharp = isStructured && control ? control.bootcamp[1].sharpRating * control.bootcampSplitEdgeShare : save.finances.bootcampSharp;
        frozenWorlds = { season: save.clock.seasonIndex, field: structuredClone(teams),
          ratingChange: gearCompetitiveBonus(save.finances.gear) - oldPermanent + Math.max(0, Math.min(save.finances.bootcampSharp, CAREER_GEAR.tempRatingMax) - Math.min(oldSharp, CAREER_GEAR.tempRatingMax)) };
      }
      events.push({ season: save.clock.seasonIndex, tier: ev.def.tier, week: ev.def.week,
        placement: userPlacement(ev.tournament), rating: user?.rating.total ?? null,
        maxOpponent: Math.max(...opponents), medianOpponent: [...opponents].sort((a,b) => a-b)[Math.floor(opponents.length / 2)],
        gear: { ...save.finances.gear }, sharp: save.finances.bootcampSharp,
        series: [...ev.tournament.swiss.rounds.flatMap(r => r.series), ...(ev.tournament.playoffs?.rounds.flatMap(r => r.series) ?? [])]
          .filter(s => s.teamAId === "user" || s.teamBId === "user").map(s => ({won: s.winnerTeamId === "user", opponent: s.teamAId === "user" ? s.teamBId : s.teamAId})),
      });
    };
    const career = playArcCareer({ ...cell, policy: (env.ENDGAME_POLICY ?? "professional") as ArcPolicyId, fullSupport: true, seasons: Number(env.ENDGAME_SEASONS ?? 8), budgetMs: 300_000,
      onEvent: observe,
      onSeason(moment, save) {
        if (moment === "end") support.push({ season: save.clock.seasonIndex, gear: { ...save.finances.gear },
          coach: save.coach?.overall ?? null, rep: save.reputation, payroll: save.squad.map(p => ({ id:p.id, salary:p.salaryPerSplit })),
          sharp: save.finances.bootcampSharp, cash: save.finances.balance });
      },
    });
    const frozen = frozenWorlds as { season: number; field: TournamentTeam[]; ratingChange: number } | null;
    let replay: unknown = null;
    if (env.ENDGAME_REPLAY && frozen) {
      const n = Number(env.ENDGAME_REPLAY);
      const titles = [0, 0];
      const playoffs = [0, 0];
      for (let k = 0; k < n; k++) for (let variant = 0; variant < 2; variant++) {
        const rng = createRng(83000 + k);
        const field = frozen.field.map(t => t.isUser && variant === 0 ? { ...t, rating: { ...t.rating, total: t.rating.total - frozen.ratingChange } } : t);
        const tournament = fastForward(initFieldTournament(field, "swiss", rng), cell.difficulty, rng);
        const placement = userPlacement(tournament);
        if (placement === "champion") titles[variant]++;
        if (placement !== "swiss_exit") playoffs[variant]++;
      }
      replay = { season: frozen.season, repetitions: n, ratingChange: frozen.ratingChange, titles, playoffs, field: frozen.field };
    }
    careers.push({ ...career, rosterKey: cell.rosterKey, support, events, replay });
    write();
  }
  console.log(`Full support matrix: ${careers.length} careers`);
}, 7_200_000);
