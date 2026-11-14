/**
 * v2.0.14 — the DOM guard: React no longer crashes when something else moved its nodes.
 *
 * Page translation (Chrome, Edge, Firefox) and some extensions wrap a text node in
 * their own element (`<font>`), or take it out of the document. React still believes
 * the node sits under its original parent, so the next `removeChild` / `insertBefore`
 * on it throws `NotFoundError` in the middle of a commit. The route's error boundary
 * then tries to clear the same broken subtree, fails again, and the page falls through
 * to the bare global error: a dark, empty screen. Launch data (12–14/11/2026): 44 of 95
 * screen errors, 16 players, 10 % of the career players with a French browser against
 * 0.6 % of the English ones (docs/POSTLAUNCH-2.0-REPORT.md).
 *
 * The guard keeps the two calls from throwing. When the node React names is no longer
 * a direct child, it acts on the wrapper that now stands in its place (so the translated
 * text leaves or the new node lands at the right spot); when the node is nowhere under
 * the parent, the removal is a no-op and the insertion goes to the end.
 *
 * Known limit: a text React later UPDATES inside a translated wrapper can stay stale on
 * screen until the next navigation. That is a wrong label, not a dead page.
 */

/** How far up to look for the wrapper. Translators nest two elements; extensions rarely more. */
const MAX_WRAPPER_DEPTH = 6;

/** The slice of `Node` the guard needs (structural, so the test can use plain objects). */
export interface GuardNode {
  parentNode: GuardNode | null;
}

export interface GuardProto {
  removeChild(this: GuardNode, child: GuardNode): GuardNode;
  insertBefore(this: GuardNode, node: GuardNode, reference: GuardNode | null): GuardNode;
  __rocketDraftDomGuard?: true;
}

/** The ancestor of `node` that is a direct child of `parent` (the wrapper around it), or null. */
export function wrapperWithin(parent: GuardNode, node: GuardNode | null): GuardNode | null {
  let current = node;
  for (let depth = 0; current && depth <= MAX_WRAPPER_DEPTH; depth++) {
    if (current.parentNode === parent) return current;
    current = current.parentNode;
  }
  return null;
}

/** Patch `removeChild` / `insertBefore` on a Node prototype. Idempotent. Returns true when it patched. */
export function guardDomProto(proto: GuardProto): boolean {
  if (proto.__rocketDraftDomGuard) return false;
  const removeChild = proto.removeChild;
  const insertBefore = proto.insertBefore;

  proto.removeChild = function guardedRemoveChild(this: GuardNode, child: GuardNode): GuardNode {
    if (child && child.parentNode !== this) {
      const wrapper = wrapperWithin(this, child);
      if (wrapper) removeChild.call(this, wrapper);
      return child;
    }
    return removeChild.call(this, child);
  };

  proto.insertBefore = function guardedInsertBefore(this: GuardNode, node: GuardNode, reference: GuardNode | null): GuardNode {
    if (reference && reference.parentNode !== this) {
      return insertBefore.call(this, node, wrapperWithin(this, reference));
    }
    return insertBefore.call(this, node, reference);
  };

  proto.__rocketDraftDomGuard = true;
  return true;
}

/** Install on the browser's `Node.prototype`. Safe on the server and when called twice. */
export function installDomGuard(): void {
  try {
    if (typeof Node !== "function" || !Node.prototype) return;
    guardDomProto(Node.prototype as unknown as GuardProto);
  } catch {
    // a guard must never be the thing that breaks the page
  }
}

// Installed when this module is evaluated: LocaleRoot imports it, so it runs with the
// root layout's chunk, before React hydrates or commits anything.
installDomGuard();
