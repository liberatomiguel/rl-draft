import { writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { useCareerStore } from "./careerStore";
import { useProfileStore } from "./profileStore";
import { balanceHistoryOf, latestMoneyChangeOf, mondayBalancesOf } from "./careerFlow";
import { applyPrize, pushLedger } from "@/engine/career/economy";
import { balanceChartModel } from "@/components/career/finances/balanceChart";
import { profileNewSummary, specialKey } from "@/engine/profileNew";
import { specialCards } from "@/data";
import { ladderOf } from "@/engine/career/ladder";

const INPUT = { identity: { orgName: "Aurora Esports", abbrev: "AUR", managerName: "Miguel", country: "BR", region: "SAM" as const, crestId: "shield", colors: { primary: "#f97316", secondary: "#fde68a" }, buffType: "consistency" as const }, difficulty: "normal" as const, style: "balanced" as const, rosterKey: "balanced" as const };
function fixture() {
  useCareerStore.setState({ slots: [null, null, null], activeSlot: null, achievements: { unlocked: {}, worldsWonOn: {} }, toasts: [] });
  useCareerStore.getState().createCareer(0, INPUT, 53006);
  const s = useCareerStore.getState();
  return structuredClone(s.slots[s.activeSlot!]!);
}

describe("rc.53 polish: financial feedback", () => {
  it("shows a settled prize immediately without rewriting the recorded Monday", () => {
    const save = fixture();
    save.clock = { seasonIndex: 0, day: 14 };
    save.finances.balanceRing = [{ s: 0, w: 1, b: 1000 }, { s: 0, w: 2, b: 2000 }];
    const before = structuredClone(save.finances.balanceRing);
    save.finances = applyPrize(save.finances, 10000, { seasonIndex: 0, week: 2, day: 14, difficulty: "normal", refName: "Regional", playerShare: 2000 }).fin;
    expect(latestMoneyChangeOf(save)).toEqual({ amount: 8000, label: "Regional" });
    const live = balanceHistoryOf(save);
    expect(live.at(-1)).toMatchObject({ d: 14, b: save.finances.balance });
    expect(mondayBalancesOf(save)).toEqual(before);
    const chart = balanceChartModel(live, 600, 200)!;
    expect(chart.points.at(-1)!.balance).toBe(save.finances.balance);
    expect(chart.points.at(-1)!.x).toBeGreaterThan(chart.points.at(-2)!.x);
  });
  it("shows spending with its real sign and includes it in the live chart", () => {
    const save = fixture();
    save.finances = pushLedger(save.finances, { seasonIndex: 0, week: 1, day: 1, kind: "facility", amount: -750, refName: "Monitors" });
    expect(latestMoneyChangeOf(save)).toEqual({ amount: -750, label: "Monitors" });
    expect(balanceHistoryOf(save).at(-1)!.b).toBe(save.finances.balance);
  });
});

describe("rc.53 polish: destination dots and item tags", () => {
  beforeEach(() => useProfileStore.getState().resetAll());
  it("acknowledges a tab without opening its item, and a later arrival stays new", () => {
    const [a,b] = specialCards;
    useProfileStore.setState({ newItems: { seen: [] }, unlockedSpecials: { [a.id]: "2026-11-12" } });
    useProfileStore.getState().markNewDotsSeen("nav:collection", [a.id]);
    let state = useProfileStore.getState();
    expect(state.newDotSeen?.["nav:collection"]).toContain(a.id);
    expect(profileNewSummary(state.newItems, state).keys.has(specialKey(a.id))).toBe(true);
    const seen = state.newDotSeen;
    state.markNewDotsSeen("nav:collection", [a.id]);
    expect(useProfileStore.getState().newDotSeen).toBe(seen);
    useProfileStore.setState({ unlockedSpecials: { [a.id]: "2026-11-12", [b.id]: "2026-11-12" } });
    state = useProfileStore.getState();
    expect(state.newDotSeen?.["nav:collection"]).not.toContain(b.id);
    state.markItemsSeen([specialKey(a.id)]);
    expect(profileNewSummary(useProfileStore.getState().newItems, useProfileStore.getState()).keys.has(specialKey(a.id))).toBe(false);
  });
});

it.skipIf(!process.env.POLISH_FIXTURES)("exports isolated browser-review snapshots", () => {
  const save = fixture();
  save.flags.seenHub = true;
  save.reputation = 32;
  save.clock = { seasonIndex: 0, day: 12 };
  save.pendingEventDef = null; save.unofficialOffer = null; save.pendingInsert = null; save.sponsorOffers = null; save.pendingOffers = [];
  save.news = []; save.mail = [];
  save.finances.balanceRing = [{s:0,w:1,b:7000},{s:0,w:2,b:5800}];
  save.finances = applyPrize(save.finances, 12000, { seasonIndex: 0, week: 2, day: 12, difficulty: "normal", refName: "Community Cup", playerShare: 0 }).fin;
  save.newAnnounced = ["ui:progression-announcements", ...ladderOf(save).filter(r => r.status !== "locked").map(r => `unlock:${r.id}`)];
  const unlock = structuredClone(save);
  unlock.newAnnounced = unlock.newAnnounced!.filter(k => k !== "unlock:coach");
  const news = structuredClone(save);
  news.news = [{id:"qa-headline",seasonIndex:2,week:2,day:12,type:"transfer",priority:3,titleKey:"beat",beatId:"s3-vitality-zen",read:false,headline:true}];
  writeFileSync("../qa-career.json", JSON.stringify({save,unlock,news}));
});
