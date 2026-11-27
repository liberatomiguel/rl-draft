/**
 * rc9 DS type lab (DESIGN-DECISIONS #213): the display face can be switched
 * between Industry (the default) and Chakra Petch on the staging and dev
 * builds, so Miguel can judge both on the real screens. Production never
 * shows the control and never reads the key.
 *
 * The choice lives in a plain localStorage key, outside every zustand persist
 * key (the persist contract is untouched). `?type=chakra` / `?type=industry`
 * sets it from a link.
 */

import { STAGING_BUILD } from "@/config/balance";

export const TYPE_LAB = STAGING_BUILD || process.env.NODE_ENV === "development";

export const TYPE_FACES = ["industry", "chakra"] as const;
export type TypeFace = (typeof TYPE_FACES)[number];

export const TYPE_LAB_KEY = "rd-type-lab";

export const TYPE_FACE_NAME: Record<TypeFace, string> = {
  industry: "Industry",
  chakra: "Chakra Petch",
};

export function isTypeFace(v: unknown): v is TypeFace {
  return typeof v === "string" && (TYPE_FACES as readonly string[]).includes(v);
}

export function readTypeFace(): TypeFace {
  try {
    const v = window.localStorage.getItem(TYPE_LAB_KEY);
    return isTypeFace(v) ? v : "industry";
  } catch {
    return "industry";
  }
}

/** Sets the face on <html> and remembers it (the default removes the key). */
export function applyTypeFace(face: TypeFace): void {
  document.documentElement.dataset.type = face;
  try {
    if (face === "industry") window.localStorage.removeItem(TYPE_LAB_KEY);
    else window.localStorage.setItem(TYPE_LAB_KEY, face);
  } catch {
    // Storage blocked: the face still applies for this page view.
  }
  window.dispatchEvent(new Event("rd-type-lab"));
}
