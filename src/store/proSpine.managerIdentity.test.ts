/**
 * v2.2 Pro spine (PROSPINE): the manager career is untouched by the Pro's
 * hook into careerFlow (`proHooks.onAiEvent`, R-PROSPINE-1). Opt-in
 * (PROSPINE_ID=1): plays a fixed-seed manager career with the arc bot and
 * prints the sha256 of its final save, once with the hook empty and once
 * with an observer set; both must match (and match the hash recorded before
 * the hook existed, which the handoff lists).
 *
 *   PROSPINE_ID=1 PROSPINE_ID_SEASONS=3 npx vitest run src/store/proSpine.managerIdentity.test.ts
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { CareerSave } from "@/engine/career/types";
import { playArcCareer } from "./careerArcBot";
import { proHooks } from "./proHooks";

const ON = process.env.PROSPINE_ID === "1";
const SEASONS = Number(process.env.PROSPINE_ID_SEASONS ?? 3);

function runHash(): string {
  let last: CareerSave | null = null;
  playArcCareer({ region: "NA", difficulty: "normal", policy: "autopilot", seed: 4242, seasons: SEASONS, onDay: (s) => { last = s; } });
  return createHash("sha256").update(JSON.stringify(last)).digest("hex");
}

describe.skipIf(!ON)("PROSPINE: manager save identical with the Pro hook", () => {
  it(
    "fixed-seed manager career: same final save with and without an observer",
    () => {
      proHooks.onAiEvent = null;
      const plain = runHash();
      let seen = 0;
      proHooks.onAiEvent = () => {
        seen += 1;
      };
      let observed: string;
      try {
        observed = runHash();
      } finally {
        proHooks.onAiEvent = null;
      }
      console.log(`PROSPINE_ID seasons=${SEASONS} plain=${plain} observed=${observed} aiEvents=${seen}`);
      expect(observed).toBe(plain);
    },
    3_600_000,
  );
});
