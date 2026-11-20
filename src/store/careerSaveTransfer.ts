/**
 * Road to Worlds save file — the store side (v2.0.26). `lib/careerSaveFile.ts`
 * knows the file; this knows the slots. The saves screen calls these two and
 * only handles the browser's file download / file picker.
 *
 * For everyone, guests included (roadmap decision D4). Imported only from the
 * career screens: it pulls in the career store.
 */

import { SITE } from "@/config/site";
import type { CareerSave } from "@/engine/career/types";
import { buildSaveFile, parseSaveFile, saveFileName, type SaveFileError } from "@/lib/careerSaveFile";
import { CURRENT_SAVE_VERSION, migrateSaveToV5 } from "./careerFlow";
import { slotMetaFor, useCareerStore } from "./careerStore";

export interface SaveFileExport {
  name: string;
  text: string;
}

/** The file for the career in `slot`, or null when the slot is empty. */
export function exportSlotFile(slot: number, now: Date = new Date()): SaveFileExport | null {
  const save = useCareerStore.getState().slots[slot];
  if (!save) return null;
  return { name: saveFileName(save), text: buildSaveFile(save, { release: SITE.version, now }) };
}

export type SaveFileImportError = SaveFileError | "slot-taken";

/**
 * Load a save file's text into an EMPTY slot. Returns null when the career is
 * now in the slot, or the reason it is not. A slot that holds a career is never
 * overwritten by a file: the player deletes it first, on purpose.
 */
export function importSaveFile(slot: number, text: string): SaveFileImportError | null {
  const store = useCareerStore.getState();
  if (store.slots[slot]) return "slot-taken";
  const parsed = parseSaveFile(text, {
    maxSaveVersion: CURRENT_SAVE_VERSION,
    // On a copy: the migrations upgrade in place.
    migrate: (raw: CareerSave) => migrateSaveToV5(JSON.parse(JSON.stringify(raw))),
    probe: (save: CareerSave) => void slotMetaFor([save]),
  });
  if (!parsed.ok) return parsed.error;
  return store.adoptSave(slot, parsed.save) ? null : "invalid";
}
