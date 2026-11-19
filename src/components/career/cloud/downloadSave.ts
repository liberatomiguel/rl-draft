import { exportSlotFile } from "@/store/careerSaveTransfer";

/** Hands the slot's save to the browser as a file download. False when there is nothing to export. */
export function downloadSlotFile(slot: number): boolean {
  const file = exportSlotFile(slot);
  if (!file) return false;
  const url = URL.createObjectURL(new Blob([file.text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
