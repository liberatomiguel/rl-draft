import { describe, expect, it } from "vitest";
import type { CareerSave } from "@/engine/career/types";
import { createCareerSave, CURRENT_SAVE_VERSION, type CreateCareerInput } from "@/store/careerFlow";
import {
  SAVE_FILE_FORMAT,
  SAVE_FILE_MAX_CHARS,
  SAVE_FILE_VERSION,
  buildSaveFile,
  checksumOf,
  looksLikeCareerSave,
  parseSaveFile,
  saveFileName,
  type ParseSaveFileOptions,
} from "./careerSaveFile";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Immutable",
    abbrev: "IMM",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  rosterKey: "balanced",
};

const mk = (): CareerSave => createCareerSave(INPUT, 36090);
const opts = (over: Partial<ParseSaveFileOptions> = {}): ParseSaveFileOptions => ({
  maxSaveVersion: CURRENT_SAVE_VERSION,
  migrate: (s) => s,
  probe: () => {},
  ...over,
});
const NOW = new Date("2026-11-17T12:00:00.000Z");
const file = (save = mk()) => buildSaveFile(save, { release: "2.0.26", now: NOW });
const err = (text: string, o = opts()) => {
  const r = parseSaveFile(text, o);
  return r.ok ? "ok" : r.error;
};

describe("buildSaveFile / parseSaveFile", () => {
  it("round-trips a real save", () => {
    const save = mk();
    const text = file(save);
    const env = JSON.parse(text);
    expect(env).toMatchObject({ format: SAVE_FILE_FORMAT, formatVersion: SAVE_FILE_VERSION, exportedAt: NOW.toISOString(), release: "2.0.26" });
    expect(env.checksum).toBe(checksumOf(JSON.stringify(save)));
    const res = parseSaveFile(text, opts());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.save).toEqual(JSON.parse(JSON.stringify(save)));
  });

  it("a fresh save has the current saveVersion", () => {
    expect(mk().saveVersion).toBe(CURRENT_SAVE_VERSION);
  });

  it("unreadable: not JSON, empty, over the size cap, not a string", () => {
    expect(err("not json {")).toBe("unreadable");
    expect(err("")).toBe("unreadable");
    expect(err(" ".repeat(SAVE_FILE_MAX_CHARS + 1))).toBe("unreadable");
    expect(err(undefined as unknown as string)).toBe("unreadable");
  });

  it("not-a-save: another JSON shape, wrong format, missing save fields", () => {
    expect(err("[]")).toBe("not-a-save");
    expect(err("null")).toBe("not-a-save");
    expect(err(JSON.stringify({ hello: "world" }))).toBe("not-a-save");
    expect(err(JSON.stringify({ format: "other", formatVersion: 1, save: mk() }))).toBe("not-a-save");
    expect(err(JSON.stringify({ format: SAVE_FILE_FORMAT, formatVersion: "1", save: mk() }))).toBe("not-a-save");
    expect(err(JSON.stringify({ format: SAVE_FILE_FORMAT, formatVersion: 1, checksum: "x", save: {} }))).toBe("not-a-save");
    const noSquad = JSON.parse(file());
    delete noSquad.save.squad;
    expect(err(JSON.stringify(noSquad))).toBe("not-a-save");
    const noIdentity = JSON.parse(file());
    delete noIdentity.save.identity;
    expect(err(JSON.stringify(noIdentity))).toBe("not-a-save");
  });

  it("newer: a newer formatVersion, or a save above maxSaveVersion", () => {
    const env = JSON.parse(file());
    env.formatVersion = SAVE_FILE_VERSION + 1;
    expect(err(JSON.stringify(env))).toBe("newer");
    expect(err(file(), opts({ maxSaveVersion: CURRENT_SAVE_VERSION - 1 }))).toBe("newer");
    const future = mk();
    future.saveVersion = CURRENT_SAVE_VERSION + 1;
    expect(err(file(future))).toBe("newer");
  });

  it("damaged: a flipped character in the save, a changed value, a missing or wrong checksum", () => {
    const text = file();
    const at = text.indexOf("Immutable", text.indexOf('"save"'));
    expect(at).toBeGreaterThan(0);
    expect(err(text.slice(0, at) + "Immutablf" + text.slice(at + 9))).toBe("damaged");

    const env = JSON.parse(text);
    env.save.finances.balance += 1;
    expect(err(JSON.stringify(env))).toBe("damaged");

    const noSum = JSON.parse(text);
    delete noSum.checksum;
    expect(err(JSON.stringify(noSum))).toBe("damaged");
    const badSum = JSON.parse(text);
    badSum.checksum = "00000000";
    expect(err(JSON.stringify(badSum))).toBe("damaged");
  });

  it("invalid: migrate returns null, migrate throws, probe throws, migrate returns a non-save", () => {
    expect(err(file(), opts({ migrate: () => null }))).toBe("invalid");
    expect(
      err(
        file(),
        opts({
          migrate: () => {
            throw new Error("x");
          },
        }),
      ),
    ).toBe("invalid");
    expect(
      err(
        file(),
        opts({
          probe: () => {
            throw new Error("x");
          },
        }),
      ),
    ).toBe("invalid");
    expect(err(file(), opts({ migrate: () => ({}) as CareerSave }))).toBe("invalid");
  });

  it("never throws, whatever it is given", () => {
    for (const t of ["", "{", "[]", "0", "true", '{"format":1}', "\u0000", "x".repeat(100)]) {
      expect(() => parseSaveFile(t, opts())).not.toThrow();
    }
  });
});

describe("saveFileName", () => {
  it.each([
    ["Immutable", "IMM"],
    ["Équipe Ação", "ÉQP"],
    ["a/b\\c:d", "a/b"],
    ["🚀🚀", "🚀"],
    ["", ""],
  ])("is safe for org %j / abbrev %j", (orgName, abbrev) => {
    const save = mk();
    save.identity.orgName = orgName;
    save.identity.abbrev = abbrev;
    const name = saveFileName(save);
    expect(name).toMatch(/^rocket-draft-[a-z0-9-]+-season-\d+\.json$/);
    expect(name.endsWith(".json")).toBe(true);
  });
  it("falls back to the org name, then to 'career'", () => {
    const save = mk();
    save.identity.abbrev = "";
    save.identity.orgName = "Équipe Ação";
    expect(saveFileName(save)).toBe("rocket-draft-equipe-acao-season-1.json");
    save.identity.orgName = "";
    expect(saveFileName(save)).toBe(`rocket-draft-career-season-${save.clock.seasonIndex + 1}.json`);
  });
  it("is bounded for a very long name", () => {
    const save = mk();
    save.identity.abbrev = "";
    save.identity.orgName = "x".repeat(500);
    expect(saveFileName(save).length).toBeLessThan(60);
  });
});

describe("looksLikeCareerSave: the fields the account copy is keyed and compared by", () => {
  const withField = (field: string, value: unknown) => {
    const s = mk() as unknown as Record<string, unknown>;
    s[field] = value;
    return s as unknown as CareerSave;
  };

  it.each([
    ["careerId a number", "careerId", 5],
    ["careerId an object", "careerId", { a: 1 }],
    ["careerId 65 chars", "careerId", "x".repeat(65)],
    ["careerId empty", "careerId", ""],
    ["seq a string", "seq", "3"],
    ["seq negative", "seq", -1],
    ["lastPlayedAt negative", "lastPlayedAt", -5],
    ["lastPlayedAt a string", "lastPlayedAt", "now"],
    ["careerSeed a string", "careerSeed", "1"],
  ])("refused: %s (and parseSaveFile says not-a-save)", (_n, field, value) => {
    const save = withField(field, value);
    expect(looksLikeCareerSave(save)).toBe(false);
    expect(err(file(save))).toBe("not-a-save");
  });

  it("accepted: no careerId, a 64-char careerId, no seq, no lastPlayedAt", () => {
    const none = mk() as unknown as Record<string, unknown>;
    delete none.careerId;
    delete none.seq;
    delete none.lastPlayedAt;
    expect(looksLikeCareerSave(none)).toBe(true);
    expect(err(file(none as unknown as CareerSave))).toBe("ok");
    expect(looksLikeCareerSave(withField("careerId", "x".repeat(64)))).toBe(true);
  });
});

describe("checksumOf / looksLikeCareerSave", () => {
  it("is stable, 8 hex chars, and changes with the text", () => {
    expect(checksumOf("abc")).toBe(checksumOf("abc"));
    expect(checksumOf("abc")).toMatch(/^[0-9a-f]{8}$/);
    expect(checksumOf("")).toMatch(/^[0-9a-f]{8}$/);
    expect(checksumOf("abc")).not.toBe(checksumOf("abd"));
    expect(checksumOf("a".repeat(10000))).toMatch(/^[0-9a-f]{8}$/);
  });
  it("accepts a real save and refuses odd values", () => {
    expect(looksLikeCareerSave(mk())).toBe(true);
    for (const v of [null, undefined, 1, "s", [], {}, { saveVersion: 0 }]) expect(looksLikeCareerSave(v)).toBe(false);
    const s = mk();
    (s as unknown as { saveVersion: number }).saveVersion = -1;
    expect(looksLikeCareerSave(s)).toBe(false);
  });
});
