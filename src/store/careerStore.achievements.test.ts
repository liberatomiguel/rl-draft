/**
 * v2.0 (R32): a career achievement unlocked by a flow lands in the store's
 * permanent memory, pops an achievement toast, pays Season XP to the profile
 * and mirrors the id into profile.careerMarks (→ career cosmetics).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { careerAchievementById } from "@/data/career/achievements";
import { ACH_FLAGS } from "@/engine/career/achievements";
import { useCareerStore } from "./careerStore";
import { useProfileStore } from "./profileStore";

const INPUT = {
  identity: {
    orgName: "Ach Org",
    abbrev: "ACH",
    managerName: "Bot",
    country: "BR",
    region: "SAM" as const,
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency" as const,
  },
  difficulty: "normal" as const,
  style: "balanced" as const,
  rosterKey: "balanced" as const,
};

describe("careerStore — achievements settle after flows (R32)", () => {
  beforeEach(() => {
    useCareerStore.setState({ slots: [null, null, null], activeSlot: null, achievements: { unlocked: {}, worldsWonOn: {} }, toasts: [] });
  });

  it("markFlag(sponsor) unlocks 'Open for Business' once: memory + toast + XP + profile mark", () => {
    useCareerStore.getState().createCareer(0, INPUT, 123);
    const xpBefore = useProfileStore.getState().xp;
    useCareerStore.getState().markFlag(ACH_FLAGS.sponsorSigned);
    const s = useCareerStore.getState();
    expect(s.achievements.unlocked["car-first-sponsor"]).toBeGreaterThan(0);
    expect(s.toasts.some((t) => t.source === "achievement" && t.titleKey === "car-first-sponsor")).toBe(true);
    const p = useProfileStore.getState();
    expect(p.xp - xpBefore).toBe(careerAchievementById.get("car-first-sponsor")!.xp);
    expect(p.careerMarks).toContain("car-first-sponsor");
    // Idempotent: another flow does not pay twice.
    useCareerStore.getState().markFlag("whatever");
    expect(useProfileStore.getState().xp - xpBefore).toBe(careerAchievementById.get("car-first-sponsor")!.xp);
    expect(useCareerStore.getState().toasts.filter((t) => t.source === "achievement")).toHaveLength(1);
  });

  it("rc.36 (UX-05, #155): a mark the profile already holds (another device) is never granted twice", () => {
    useProfileStore.getState().resetAll();
    // The cloud brought "Open for Business" in; this device's career memory never saw it.
    useProfileStore.getState().addCareerMarks(["car-first-sponsor"]);
    useCareerStore.getState().createCareer(0, INPUT, 321);
    const xpBefore = useProfileStore.getState().xp;
    useCareerStore.getState().markFlag(ACH_FLAGS.sponsorSigned);
    const s = useCareerStore.getState();
    // It joins the memory silently: no toast, no Season XP.
    expect(s.achievements.unlocked["car-first-sponsor"]).toBeGreaterThan(0);
    expect(s.toasts.some((t) => t.source === "achievement" && t.titleKey === "car-first-sponsor")).toBe(false);
    expect(useProfileStore.getState().xp).toBe(xpBefore);
  });

  it("rc.36 (UX-05): permanent across saves — a new career after deleting the slot grants nothing again", () => {
    useProfileStore.getState().resetAll();
    const xp0 = useProfileStore.getState().xp;
    useCareerStore.getState().createCareer(0, INPUT, 777);
    useCareerStore.getState().markFlag(ACH_FLAGS.sponsorSigned);
    const xpAfterFirst = useProfileStore.getState().xp;
    expect(xpAfterFirst - xp0).toBe(careerAchievementById.get("car-first-sponsor")!.xp);
    useCareerStore.getState().deleteSlot(0);
    useCareerStore.getState().createCareer(1, INPUT, 778);
    useCareerStore.getState().markFlag(ACH_FLAGS.sponsorSigned);
    expect(useProfileStore.getState().xp).toBe(xpAfterFirst);
    expect(useCareerStore.getState().achievements.unlocked["car-first-sponsor"]).toBeGreaterThan(0);
    expect(useProfileStore.getState().careerMarks.filter((id) => id === "car-first-sponsor")).toHaveLength(1);
  });

  it("rc.4: a Worlds title feeds the profile's lifetime + season counters (World Champion badges)", () => {
    const before = useProfileStore.getState();
    const lifetime = before.careerWorldsWon ?? 0;
    const season = before.season.careerWorlds ?? 0;
    useProfileStore.getState().addCareerWorlds(1);
    const p = useProfileStore.getState();
    expect(p.careerWorldsWon).toBe(lifetime + 1);
    expect(p.season.careerWorlds).toBe(season + 1);
    expect(p.cosmetics.owned).toHaveProperty("world-champion-crowned");
    expect(p.cosmetics.owned).toHaveProperty("career-title-rtw-champion");
    useProfileStore.getState().addCareerWorlds(0);
    expect(useProfileStore.getState().careerWorldsWon).toBe(lifetime + 1);
  });
});
