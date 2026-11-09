/** Experiment only. No balance constants, saved ratings or production modules are changed. */
import { vi } from "vitest";
import * as worldSim from "@/engine/career/worldSim";

export function withWorldsExtra<T>(extra: number, run: () => T) {
  if (!Number.isFinite(extra) || extra < 0) throw Error("Invalid Worlds rating increment");
  const original = worldSim.fieldForEvent;
  let applications = 0;
  const spy = vi.spyOn(worldSim, "fieldForEvent").mockImplementation((def, ctx) => {
    const result = original(def, ctx);
    if (extra === 0 || def.tier !== "worlds") return result;
    applications++;
    return { ...result, field: result.field.map(team => team.isUser ? team : {
      ...team, rating: { ...team.rating, total: team.rating.total + extra, difficultyShift: team.rating.difficultyShift + extra },
    }) };
  });
  try { return { value: run(), applications }; }
  finally { spy.mockRestore(); }
}
