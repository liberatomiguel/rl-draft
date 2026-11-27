/**
 * Share kit (v2.2): the permanent facts sharing leaves on the profile. They
 * ride the profile's mark list (`careerMarks`, synced as a union with the
 * account) under a `share-` prefix, like the Classic run marks (`run-`), so no
 * persisted field is added. The cosmetics derivation reads them
 * (`{ type: "run-mark", markId }`).
 *
 *  · `share-first` (Ambassador title): the first time something left the game
 *    through a share sheet (any channel: the share sheet, a social link, a copy
 *    or a download). The game cannot see whether the post went out; the click is
 *    the fact.
 */

import { useProfileStore } from "@/store/profileStore";

export const SHARE_MARK_FIRST = "share-first";

/** Records the first share (a no-op once the mark is on the profile). */
export function markShared(): void {
  const state = useProfileStore.getState();
  if ((state.careerMarks ?? []).includes(SHARE_MARK_FIRST)) return;
  state.addCareerMarks([SHARE_MARK_FIRST]);
}
