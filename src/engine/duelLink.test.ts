import { describe, expect, it } from "vitest";
import { coachById, playerCards, specialCards, subById, lineups } from "@/data";
import { DUEL_MATCH } from "@/config/balance";
import {
  duelCodePath,
  duelRematch,
  encodeDuelCode,
  makeDuelChallenge,
  makeDuelReply,
  parseDuelCode,
  readDuelHash,
  sanitizeDuelName,
  type DuelCode,
} from "./duelLink";
import { isStaleDuel, makeDuelRules, nextDuelRules, type DuelTeamCards } from "./duelRules";
import { botDraft } from "./duelTestKit";

const rules = makeDuelRules({ mode: "classic", rerolls: 3, showOverall: false, region: "EU" }, 3_141_592_653);
const team = botDraft(rules, { pickSeed: 1 }).team;
const team2 = botDraft(makeDuelRules({}, 99), { pickSeed: 2 }).team;
const challenge = makeDuelChallenge(rules, { name: "Ana", team });
const reply = makeDuelReply(challenge, { name: "Zé 🚀", team: team2 });

describe("duel link codec", () => {
  it("round-trips a challenge and a reply, classic and quick, every rule", () => {
    const quickRules = makeDuelRules({ mode: "quick", rerolls: 0, showOverall: true, region: null }, 0);
    const quickTeam: DuelTeamCards = { players: botDraft(quickRules, { pickSeed: 3 }).team.players };
    const codes: DuelCode[] = [
      challenge,
      reply,
      makeDuelChallenge(quickRules, { name: "", team: quickTeam }),
      makeDuelReply(makeDuelChallenge(quickRules, { name: "A", team: quickTeam }), { name: "B", team: quickTeam }),
      makeDuelChallenge({ ...rules, seed: 0xffffffff, rerolls: 7, region: "SSA" }, { name: "x", team }),
    ];
    for (const c of codes) expect(parseDuelCode(encodeDuelCode(c))).toEqual({ ok: true, code: c });
  });

  it("carries the name exactly, including accents and emoji, and cleans what it cannot", () => {
    const parsed = parseDuelCode(encodeDuelCode(reply));
    expect(parsed.ok && parsed.code.kind === "reply" && parsed.code.opponent.name).toBe("Zé 🚀");
    expect(sanitizeDuelName("  a   b\n\tc ")).toBe("a b c");
    expect(sanitizeDuelName("x".repeat(40))).toHaveLength(DUEL_MATCH.maxNameLength);
    const long = sanitizeDuelName("😀".repeat(30));
    expect(long.length).toBeLessThanOrEqual(DUEL_MATCH.maxNameLength);
    expect(parseDuelCode(encodeDuelCode(makeDuelChallenge(rules, { name: long, team }))).ok).toBe(true);
    // The separator can never be typed into a name.
    const dotted = makeDuelChallenge(rules, { name: "a.b_c+d~e", team });
    expect(parseDuelCode(encodeDuelCode(dotted))).toEqual({ ok: true, code: dotted });
  });

  it("reads the code from the hash and builds the /duel path", () => {
    const path = duelCodePath(challenge);
    expect(path.startsWith("/duel#c=")).toBe(true);
    const hash = path.slice(path.indexOf("#"));
    expect(parseDuelCode(readDuelHash(hash))).toEqual({ ok: true, code: challenge });
    expect(readDuelHash(`#x=1&c=${encodeDuelCode(challenge)}`)).toBe(encodeDuelCode(challenge));
    expect(readDuelHash("")).toBeNull();
    expect(readDuelHash("#c=%E0%A4%A")).toBeNull();
  });

  it("refuses an edited link as tampered, never as a different duel", () => {
    const code = encodeDuelCode(challenge);
    for (const i of [2, 5, 9, 20, code.length - 8]) {
      const edited = code.slice(0, i) + (code[i] === "a" ? "b" : "a") + code.slice(i + 1);
      const r = parseDuelCode(edited);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(["tampered", "malformed"]).toContain(r.reason);
    }
    // Swapping the seed digit and keeping the old check value is tampered.
    const parts = code.split(".");
    parts[2] = "1";
    expect(parseDuelCode(parts.join("."))).toEqual({ ok: false, reason: "tampered" });
  });

  it("refuses cut, empty and foreign codes with the old error kinds", () => {
    const code = encodeDuelCode(reply);
    expect(parseDuelCode(code.slice(0, -4))).toMatchObject({ ok: false });
    expect(parseDuelCode(code.slice(0, 30))).toMatchObject({ ok: false, reason: "malformed" });
    expect(parseDuelCode("")).toEqual({ ok: false, reason: "missing" });
    expect(parseDuelCode(null)).toEqual({ ok: false, reason: "missing" });
    expect(parseDuelCode("hello")).toEqual({ ok: false, reason: "malformed" });
    expect(parseDuelCode("x".repeat(DUEL_MATCH.maxCodeLength + 1))).toEqual({ ok: false, reason: "malformed" });
    expect(parseDuelCode("2.z.a.b.c.d.e.f.g")).toEqual({ ok: false, reason: "malformed" });
  });

  it("reads an old-format link as unsupported", () => {
    // The friend duel's link: format 1, seven fields, its own check value.
    expect(parseDuelCode("1.1ly2s5.cn1.w.1l.p-3-1-2-e-1h-u-57.abc123")).toEqual({ ok: false, reason: "unsupported" });
    expect(parseDuelCode("1.1ly2s5.hn0.EU.1l..7wpq0z")).toEqual({ ok: false, reason: "unsupported" });
  });

  it("rejects shapes a real link never has (wrong card count for the mode, repeated players)", () => {
    const body = (rest: string[]) => {
      const text = ["2", "c", "1", "c13", "w", "1l", "", ...rest].join(".");
      let h = 0x811c9dc5;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return `${text}.${(h >>> 0).toString(36)}`;
    };
    expect(parseDuelCode(body(["a_b_c_d_e_f"])).ok).toBe(true);
    expect(parseDuelCode(body(["a_b_c"])).ok).toBe(false); // classic needs six
    expect(parseDuelCode(body(["a_a_c_d_e_f"])).ok).toBe(false); // the same card twice
    expect(parseDuelCode(body(["a_b_c_d_E_f"])).ok).toBe(false); // an id with a capital
  });

  it("flags a link made on another balance version", () => {
    expect(isStaleDuel(rules)).toBe(false);
    expect(isStaleDuel({ balanceVersion: rules.balanceVersion + 1 })).toBe(true);
  });
});

describe("duel link length", () => {
  it("a typical reply is short, and the worst case the dataset allows stays under the ceiling", () => {
    expect(encodeDuelCode(reply).length).toBeLessThan(700);
    expect(encodeDuelCode(challenge).length).toBeLessThan(450);

    const longest = <T,>(list: readonly T[], id: (x: T) => string, n: number) => [...list].sort((a, b) => id(b).length - id(a).length).slice(0, n);
    const players = longest(playerCards, (c) => c.id, 3).map((c) => c.id);
    const sp = longest(specialCards, (c) => c.id, 1)[0].id;
    const coach = longest([...coachById.values()], (c) => c.id, 1)[0].id;
    const sub = longest([...subById.values()], (c) => c.id, 1)[0].id;
    const lineup = longest(lineups, (l) => l.id, 1)[0].id;
    const worst: DuelTeamCards = {
      players: players.map((id) => ({ id, sp })),
      coach: { id: coach, sp },
      sub: { id: sub, sp },
      orgLineup: lineup,
    };
    const longName = "😀".repeat(8);
    const code = encodeDuelCode(
      makeDuelReply(makeDuelChallenge(rules, { name: longName, team: worst }), { name: longName, team: worst }),
    );
    expect(code.length).toBeLessThanOrEqual(DUEL_MATCH.maxCodeLength);
    expect(parseDuelCode(code).ok).toBe(true);
  });
});

describe("new match", () => {
  it("keeps the rules, derives a new seed, and makes the one who asks the challenger", () => {
    const fromChallenger = duelRematch(reply, "challenger");
    const fromOpponent = duelRematch(reply, "opponent");
    for (const next of [fromChallenger, fromOpponent]) {
      expect(next.rules).toEqual({ ...rules, seed: next.rules.seed });
      expect(next.rules.seed).not.toBe(rules.seed);
      expect(next.rules.seed).toBe(nextDuelRules(rules).seed);
    }
    expect(fromChallenger).toMatchObject({ challengerName: "Ana", opponentName: "Zé 🚀" });
    expect(fromOpponent).toMatchObject({ challengerName: "Zé 🚀", opponentName: "Ana" });
    // A chain of rematches never repeats a seed.
    const seeds = new Set<number>();
    let r = rules;
    for (let i = 0; i < 50; i++) {
      seeds.add(r.seed);
      r = nextDuelRules(r);
    }
    expect(seeds.size).toBe(50);
  });
});
