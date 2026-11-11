"use client";
import { useEffect } from "react";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { toolboxOf, toolboxRefusalOf } from "@/store/careerHq";
import { sponsorFreeBootcampsOf } from "@/engine/career/sponsorDeals";
import type { CareerSave } from "@/engine/career/types";

export function sponsorBootcampReady(save: CareerSave): boolean {
  if (save.phase !== "running" || save.activeEvent || save.finances.freeBootcampsUsedThisSeason >= sponsorFreeBootcampsOf(save.sponsor)) return false;
  return toolboxOf(save).some(item => item.kind === "bootcamp" && item.status === "buyable" && item.free && !toolboxRefusalOf(save, item.id));
}

/** Use the existing guarded action; no new economy rule or persisted field. */
export function SponsorAutoBootcamp() {
  const save = useCareerStore(selectActiveSave);
  const run = useCareerStore(s => s.runBootcamp);
  useEffect(() => { const current = selectActiveSave(useCareerStore.getState()); if (current && sponsorBootcampReady(current)) run(); }, [save, run]);
  return null;
}
