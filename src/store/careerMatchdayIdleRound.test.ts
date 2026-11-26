/**
 * Regression (PROSPINE round 3): a manager career with Matchday in custom
 * mode ("every series") must get through a double-elimination round in which
 * the user has no series (his bracket waits). Before the fix the custom
 * gate opened a series that did not exist, `openUserSeriesOn` did nothing
 * and `stepEventRound` made no progress: a dead button.
 */
import { describe, expect, it, vi } from "vitest";
import type { CareerSave } from "@/engine/career/types";

describe("manager custom matchday: a playoff round without the user", () => {
  it("watched custom-mode events always progress to their end", async () => {
    vi.stubEnv("NEXT_PUBLIC_MATCHDAY_DECISIONS", "1");
    vi.resetModules();
    const F = await import("./careerFlow");
    const { playArcCareer } = await import("./careerArcBot");
    const T = await import("@/engine/tournament");
    let events = 0;
    let idleRounds = 0;
    const problems: string[] = [];
    const check = (save: CareerSave) => {
      if (idleRounds > 0 && events > 3) return;
      let next: CareerSave;
      try {
        next = F.advanceDayFlow(save);
      } catch {
        return;
      }
      const def = next.pendingEventDef;
      if (!def || next.activeEvent || def.day !== next.clock.day || next.phase !== "running" || F.eventStartBlockOf(next, def)) return;
      let w = F.startEvent(F.setMatchdayModeFlow(next, "custom", "every"), true);
      if (!w.activeEvent?.matchday) return;
      events += 1;
      for (let guard = 0; guard < 120 && w.activeEvent && w.activeEvent.tournament.stage !== "finished" && !F.isEventPaused(w); guard++) {
        const t = w.activeEvent.tournament;
        if (t.stage === "playoffs" && T.userHasPendingSeries(t) && !T.upcomingUserPairing(t, w.difficulty)) idleRounds += 1;
        if (F.pendingUserSeriesOf(w)) {
          w = F.delegateUserSeriesFlow(w);
        }
        const stepped = F.stepEventRound(w);
        const rounds = (x: CareerSave) => (x.activeEvent ? x.activeEvent.tournament.swiss.rounds.length + (x.activeEvent.tournament.playoffs?.rounds.length ?? 0) : -1);
        if (rounds(stepped) === rounds(w) && !F.pendingUserSeriesOf(stepped) && stepped.activeEvent?.tournament.stage === t.stage) {
          problems.push(`no progress in ${def.id} at ${t.stage} round ${t.playoffs?.rounds.length ?? t.swiss.rounds.length}`);
          break;
        }
        w = stepped;
        const t2 = w.activeEvent?.tournament;
        if (t2 && t2.stage === "playoffs" && T.userHasPendingSeries(t2) && !T.upcomingUserPairing(t2, w.difficulty)) idleRounds += 1;
      }
    };
    // A strong squad, so the user wins upper-bracket series and waits while the lower bracket plays.
    const base = F.createCareerSave(
      {
        identity: { orgName: "Idle Test", abbrev: "IDL", managerName: "T", country: "FR", region: "EU", crestId: "shield", colors: { primary: "#f97316", secondary: "#fde68a" }, buffType: "consistency" },
        difficulty: "easy",
        rosterKey: "balanced",
        trainingMode: "auto",
      },
      9100,
    );
    const strong = { ...base, squad: base.squad.map((p) => ({ ...p, overall: 96, potential: 99 })) };
    playArcCareer({ region: "EU", difficulty: "easy", policy: "tuned", seed: 9100, seasons: 5, startFrom: strong, onDay: check });
    expect(events).toBeGreaterThan(3);
    expect(idleRounds).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  }, 1_200_000);
});
