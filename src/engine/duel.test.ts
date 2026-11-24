import { describe, expect, it } from "vitest";
import { BALANCE_VERSION, DUEL } from "@/config/balance";
import {
  capEntries,
  compareEntries,
  duelCodeFromHash,
  duelPath,
  duelStandings,
  duelTournamentSeed,
  duelVerdict,
  encodeDuel,
  freshDuel,
  parseDuel,
  type DuelEntry,
  type DuelLink,
} from "./duel";

const entry = (over: Partial<DuelEntry> = {}): DuelEntry => ({
  placement: "runner_up",
  swissWins: 3,
  swissLosses: 1,
  playoffWins: 2,
  gameWins: 14,
  goalsFor: 41,
  goalsAgainst: 30,
  teamOverall: 87,
  ...over,
});

const link = (over: Partial<DuelLink["setup"]> = {}, entries: DuelEntry[] = [entry()]): DuelLink => ({
  setup: { seed: 3_141_592_653, mode: "classic", difficulty: "hard", region: "EU", showOverall: false, balanceVersion: BALANCE_VERSION, ...over },
  entries,
});

describe("duel link codec", () => {
  it("round-trips every setup field and entry", () => {
    for (const l of [
      link(),
      link({ mode: "quick", difficulty: "easy", region: null, showOverall: true, seed: 0 }, [entry({ swissWins: 0, swissLosses: 0, placement: "top8" })]),
      link({ seed: 0xffffffff, difficulty: "legacy" }, []),
      link({}, [entry({ placement: "champion" }), entry({ placement: "swiss_exit", playoffWins: 0 })]),
    ]) {
      const parsed = parseDuel(encodeDuel(l));
      expect(parsed).toEqual({ ok: true, link: l });
    }
  });

  it("reads the code from the hash and builds the /duel path", () => {
    const l = link();
    const path = duelPath(l);
    expect(path.startsWith("/duel#c=")).toBe(true);
    const hash = path.slice(path.indexOf("#"));
    expect(parseDuel(duelCodeFromHash(hash))).toEqual({ ok: true, link: l });
    expect(duelCodeFromHash(`#x=1&c=${encodeDuel(l)}`)).toBe(encodeDuel(l));
    expect(duelCodeFromHash("")).toBeNull();
    expect(duelCodeFromHash("#c=%E0%A4%A")).toBeNull(); // a broken escape never throws
  });

  it("carries nothing but the draft settings and the score lines", () => {
    // Only base-36 digits, letters for the codes, and the separators.
    expect(encodeDuel(link())).toMatch(/^[0-9a-zA-Z._-]+$/);
  });

  it("refuses a missing, edited, cut or foreign code without throwing", () => {
    const code = encodeDuel(link());
    expect(parseDuel(undefined)).toEqual({ ok: false, reason: "missing" });
    expect(parseDuel("")).toEqual({ ok: false, reason: "missing" });
    expect(parseDuel(null)).toEqual({ ok: false, reason: "missing" });
    // A digit of the score changed, the check value left alone.
    const edited = code.replace(/\.([0-9a-z])-/, (_m, d: string) => `.${d === "0" ? "1" : "0"}-`);
    expect(edited).not.toBe(code);
    expect(parseDuel(edited)).toEqual({ ok: false, reason: "tampered" });
    expect(parseDuel(code.slice(0, -3))).toMatchObject({ ok: false });
    expect(parseDuel(code.split(".").slice(0, 4).join("."))).toEqual({ ok: false, reason: "malformed" });
    expect(parseDuel(`2${code.slice(1)}`)).toEqual({ ok: false, reason: "unsupported" });
    expect(parseDuel("hello world")).toEqual({ ok: false, reason: "malformed" });
    expect(parseDuel("x".repeat(5000))).toEqual({ ok: false, reason: "malformed" });
    for (let i = 0; i < code.length; i++) {
      const cut = code.slice(0, i) + code.slice(i + 1);
      expect(() => parseDuel(cut)).not.toThrow();
      expect(parseDuel(cut).ok).toBe(false);
    }
  });

  it("refuses values out of range even when the check value matches", () => {
    // A hand-built code with a valid check: the bounds still apply.
    const withCheck = (body: string) => {
      let h = 0x811c9dc5;
      for (let i = 0; i < body.length; i++) {
        h ^= body.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return `${body}.${(h >>> 0).toString(36)}`;
    };
    const ok = withCheck("1.abc.ch1.w.1a.0-3-0-4-12-30-10-2s");
    expect(parseDuel(ok).ok).toBe(true);
    expect(parseDuel(withCheck("1.abc.xh1.w.1a.0-3-0-4-12-30-10-2s"))).toEqual({ ok: false, reason: "malformed" }); // mode
    expect(parseDuel(withCheck("1.abc.ch1.ZZ.1a.0-3-0-4-12-30-10-2s"))).toEqual({ ok: false, reason: "malformed" }); // region
    expect(parseDuel(withCheck("1.abc.ch1.w.1a.9-3-0-4-12-30-10-2s"))).toEqual({ ok: false, reason: "malformed" }); // placement
    expect(parseDuel(withCheck("1.abc.ch1.w.1a.0-a-0-4-12-30-10-2s"))).toEqual({ ok: false, reason: "malformed" }); // Swiss wins
    expect(parseDuel(withCheck("1.abc.qh1.w.1a.0-3-0-4-12-30-10-2s"))).toEqual({ ok: false, reason: "malformed" }); // Swiss in Quick
    expect(parseDuel(withCheck("1.zzzzzzz.ch1.w.1a."))).toEqual({ ok: false, reason: "malformed" }); // seed past uint32
    const many = Array.from({ length: DUEL.maxEntries + 1 }, () => "0-3-0-4-12-30-10-2s").join("_");
    expect(parseDuel(withCheck(`1.abc.ch1.w.1a.${many}`))).toEqual({ ok: false, reason: "malformed" });
  });

  it("keeps the first run and the latest replies once the link is full", () => {
    const list = Array.from({ length: DUEL.maxEntries + 3 }, (_, i) => entry({ teamOverall: 60 + i }));
    const kept = capEntries(list);
    expect(kept).toHaveLength(DUEL.maxEntries);
    expect(kept[0]).toBe(list[0]);
    expect(kept.at(-1)).toBe(list.at(-1));
    expect(parseDuel(encodeDuel(link({}, list)))).toMatchObject({ ok: true, link: { entries: kept } });
  });

  it("a fresh duel hides overalls where the difficulty does and stamps the balance version", () => {
    expect(freshDuel({ mode: "classic", difficulty: "hard", region: null, showOverall: true }, 7).setup).toMatchObject({
      showOverall: false,
      balanceVersion: BALANCE_VERSION,
      seed: 7,
    });
    expect(freshDuel({ mode: "quick", difficulty: "normal", region: "NA", showOverall: true }, -1).setup.seed).toBe(0xffffffff);
  });

  it("derives a tournament seed that differs from the run seed and is stable", () => {
    expect(duelTournamentSeed(12345)).toBe(duelTournamentSeed(12345));
    expect(duelTournamentSeed(12345)).not.toBe(12345);
    expect(duelTournamentSeed(12345)).not.toBe(duelTournamentSeed(12346));
  });
});

describe("duel comparison", () => {
  it("orders by placement, then Swiss wins, playoff wins, games, goal difference", () => {
    expect(compareEntries(entry({ placement: "champion" }), entry())).toBeLessThan(0);
    expect(compareEntries(entry({ placement: "swiss_exit" }), entry({ placement: "top8" }))).toBeGreaterThan(0);
    expect(compareEntries(entry({ swissWins: 3, swissLosses: 0 }), entry({ swissWins: 2 }))).toBeLessThan(0);
    expect(compareEntries(entry({ playoffWins: 3 }), entry())).toBeLessThan(0);
    expect(compareEntries(entry({ gameWins: 15 }), entry())).toBeLessThan(0);
    expect(compareEntries(entry({ goalsFor: 50 }), entry())).toBeLessThan(0);
    expect(compareEntries(entry(), entry())).toBe(0);
  });

  it("ranks the runs with shared places for equal results, and counts the verdict", () => {
    const a = entry({ placement: "champion" });
    const b = entry();
    const c = entry();
    const d = entry({ placement: "swiss_exit" });
    const rows = duelStandings([b, d, a, c]);
    expect(rows.map((r) => [r.index, r.rank])).toEqual([
      [2, 1],
      [0, 2],
      [3, 2],
      [1, 4],
    ]);
    expect(duelVerdict(b, [a, c, d])).toEqual({ beat: 1, level: 1, lost: 1 });
    expect(duelVerdict(a, [])).toEqual({ beat: 0, level: 0, lost: 0 });
  });
});
