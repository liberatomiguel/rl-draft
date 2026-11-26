/**
 * v2.2 Pro spine (PROSPINE): a bot that plays a Pro career through the real
 * flows the screens call (proFlow), for the tests and probes. It takes the
 * coach's week, accepts the first amateur call, signs the best org offer
 * (counters once when the shown risk is low), asks for a transfer after a
 * benched split and renews when asked. It records every soft lock it meets:
 * a step that does not move the save.
 */

import { weekOfDay } from "@/engine/career/calendar";
import { ageOf } from "@/engine/career/development";
import { proOverall } from "@/engine/career/pro/attrs";
import { createProSave } from "@/engine/career/pro/create";
import type { ProSave } from "@/engine/career/pro/types";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import {
  acceptProOfferFlow,
  advanceProDayFlow,
  canRequestProTransfer,
  counterProOfferFlow,
  ensureProHost,
  openProOffersOf,
  proOfferBlockOf,
  proStopOf,
  keepPlayingFlow,
  requestProTransferFlow,
  retireProFlow,
  seatOfPro,
} from "./proFlow";

export interface ProBotRun {
  save: ProSave;
  days: number;
  stuck: string[];
  firstOrgAge: number | null;
  firstOrgSeason: number | null;
  stages: string[];
}

export function newProBotSave(region: Region, difficulty: CareerDifficulty, seed: number, startAge: 13 | 14 = 13): ProSave {
  return ensureProHost(
    createProSave({ name: "Bot Pro", country: region === "SAM" ? "BR" : region === "EU" ? "FR" : "US", region, startAge, archetype: "allround", difficulty }, seed, "test"),
  );
}

/** One decision pass of the bot on the save (offers, transfer request). */
export function proBotDecide(save: ProSave, opts: { counter?: boolean } = {}): ProSave {
  let out = save;
  // The end offered after a season without a team: he keeps going until 30, then takes it.
  if (out.retireOffer) return ageOf(out.player.birthYear, out.clock.seasonIndex) >= 30 ? retireProFlow(out) : keepPlayingFlow(out);
  for (const offer of openProOffersOf(out)) {
    if (proOfferBlockOf(out, offer.id)) continue;
    if (offer.kind === "amateur" && (out.stage === "ranked" || out.stage === "freeAgent" || out.stage === "amateur")) {
      return acceptProOfferFlow(out, offer.id);
    }
    if (offer.kind === "renewal") return acceptProOfferFlow(out, offer.id);
  }
  const benched = out.stage === "org" && seatOfPro(out) === "reserve";
  // At an org he moves only for a promised start while benched, or when his deal is running out.
  const leaving = out.stage === "org" && out.contract && out.contract.endSeason <= out.clock.seasonIndex;
  const orgOffers = openProOffersOf(out).filter(
    (o) => o.kind === "org" && !proOfferBlockOf(out, o.id) && (out.stage !== "org" || leaving || (benched && o.role === "starter")),
  );
  if (orgOffers.length > 0) {
    // Prefer a promised start, then the stronger org.
    const best = [...orgOffers].sort((a, b) => (a.role === b.role ? b.level - a.level : a.role === "starter" ? -1 : 1))[0];
    if (opts.counter && !best.counter && best.counterRisk <= 0.3) {
      const c = counterProOfferFlow(out, best.id);
      const after = c.offers.find((o) => o.id === best.id);
      if (after?.status === "open") return acceptProOfferFlow(c, best.id);
      out = c;
    } else {
      return acceptProOfferFlow(out, best.id);
    }
  }
  // A whole season mostly on the bench: he asks to leave in the last split.
  if (canRequestProTransfer(out) && weekOfDay(out.clock.day) >= 23 && out.contract && out.contract.endSeason > out.clock.seasonIndex) out = requestProTransferFlow(out);
  return out;
}

export function playProBot(cfg: {
  region: Region;
  difficulty: CareerDifficulty;
  seed: number;
  seasons: number;
  startAge?: 13 | 14;
  counter?: boolean;
  onDay?: (save: ProSave) => void;
}): ProBotRun {
  let save = newProBotSave(cfg.region, cfg.difficulty, cfg.seed, cfg.startAge ?? 13);
  const stuck: string[] = [];
  const stages: string[] = [save.stage];
  let firstOrgAge: number | null = null;
  let firstOrgSeason: number | null = null;
  let days = 0;
  const lastSeason = cfg.seasons;
  for (let guard = 0; guard < cfg.seasons * 4000 && save.clock.seasonIndex < lastSeason && save.stage !== "retired"; guard++) {
    save = proBotDecide(save, { counter: cfg.counter });
    if (save.stage !== stages[stages.length - 1]) stages.push(save.stage);
    if (save.stage === "org" && firstOrgAge === null) {
      firstOrgAge = ageOf(save.player.birthYear, save.clock.seasonIndex);
      firstOrgSeason = save.clock.seasonIndex;
    }
    const before = save;
    const next = advanceProDayFlow(save);
    if (next === before || (next.clock.day === before.clock.day && next.clock.seasonIndex === before.clock.seasonIndex && proStopOf(next)?.kind === proStopOf(before)?.kind && next.report === before.report && next.live === before.live && next.stage === before.stage)) {
      stuck.push(`S${save.clock.seasonIndex} d${save.clock.day} stage=${save.stage} stop=${proStopOf(save)?.kind ?? "-"}`);
      if (stuck.length > 3) break;
    }
    save = next;
    days += 1;
    cfg.onDay?.(save);
  }
  return { save, days, stuck, firstOrgAge, firstOrgSeason, stages };
}

export function proBotSummary(run: ProBotRun): string {
  const p = run.save.player;
  return `S${run.save.clock.seasonIndex} d${run.save.clock.day} stage=${run.save.stage} ovr=${proOverall(p.attrs).toFixed(1)} firstOrg=S${run.firstOrgSeason ?? "-"}@${run.firstOrgAge ?? "-"} stages=${run.stages.join(">")} stuck=${run.stuck.length}`;
}
