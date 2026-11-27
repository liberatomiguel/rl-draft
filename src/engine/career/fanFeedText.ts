/**
 * v2.3 FEED: a post's text. The copy layer owns the words (`feed.text[key]`,
 * `{slot}` placeholders); this only drops the post's slots in. Takes the
 * dictionary as an argument so the engine never imports copy.
 */
import type { FeedPost } from "./fanFeedTypes";

export interface FeedTextCopy {
  text: Readonly<Record<string, string>>;
}

/** The placeholders a template names. */
export const placeholdersOf = (template: string): string[] => [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

export function fillTemplate(template: string, slots: Readonly<Record<string, string | undefined>>): string {
  return template.replace(/\{(\w+)\}/g, (_, slot: string) => slots[slot] ?? "");
}

/** The finished text of a post; "" when the copy has no such key. */
export function feedTextOf(post: Pick<FeedPost, "variant" | "slots">, copy: FeedTextCopy): string {
  const template = copy.text[post.variant];
  return template === undefined ? "" : fillTemplate(template, post.slots);
}
