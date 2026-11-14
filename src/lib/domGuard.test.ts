import { describe, expect, it } from "vitest";
import { guardDomProto, wrapperWithin, type GuardNode, type GuardProto } from "./domGuard";

/** A minimal DOM: the native calls throw exactly where the browser's do. */
class FakeNode implements GuardNode {
  parentNode: FakeNode | null = null;
  children: FakeNode[] = [];
  constructor(public name: string) {}

  removeChild(child: FakeNode): FakeNode {
    const i = this.children.indexOf(child);
    if (i < 0) throw new Error("NotFoundError: The node to be removed is not a child of this node.");
    this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }

  insertBefore(node: FakeNode, reference: FakeNode | null): FakeNode {
    const i = reference ? this.children.indexOf(reference) : this.children.length;
    if (i < 0) throw new Error("NotFoundError: The node before which the new node is to be inserted is not a child of this node.");
    node.parentNode?.removeChild(node);
    this.children.splice(i, 0, node);
    node.parentNode = this;
    return node;
  }

  append(...nodes: FakeNode[]): this {
    for (const n of nodes) this.insertBefore(n, null);
    return this;
  }
}

const names = (n: FakeNode) => n.children.map((c) => c.name);

/** What page translation does: the text node moves inside `<font><font>`, which takes its place. */
function translate(parent: FakeNode, text: FakeNode): FakeNode {
  const outer = new FakeNode("font");
  const inner = new FakeNode("font");
  parent.insertBefore(outer, text);
  outer.append(inner);
  inner.append(text);
  return outer;
}

/** The guard patched onto a fresh subclass, so each test starts unpatched. */
function guarded(): typeof FakeNode {
  class Guarded extends FakeNode {}
  Guarded.prototype.removeChild = FakeNode.prototype.removeChild;
  Guarded.prototype.insertBefore = FakeNode.prototype.insertBefore;
  expect(guardDomProto(Guarded.prototype as unknown as GuardProto)).toBe(true);
  return Guarded;
}

describe("the DOM guard (v2.0.14: page translation no longer crashes React)", () => {
  it("unpatched, removing a translated text node throws: the launch crash", () => {
    const parent = new FakeNode("div");
    const text = new FakeNode("#text");
    parent.append(text);
    translate(parent, text);
    expect(() => parent.removeChild(text)).toThrow(/not a child/);
  });

  it("removes the translator's wrapper in place of the text node it swallowed", () => {
    const N = guarded();
    const parent = new N("div");
    const text = new N("#text");
    const sibling = new N("span");
    parent.append(text, sibling);
    translate(parent, text);
    expect(parent.removeChild(text)).toBe(text);
    expect(names(parent)).toEqual(["span"]);
  });

  it("inserts before the wrapper when the reference node was swallowed", () => {
    const N = guarded();
    const parent = new N("div");
    const first = new N("b");
    const text = new N("#text");
    parent.append(first, text);
    translate(parent, text);
    parent.insertBefore(new N("new"), text);
    expect(names(parent)).toEqual(["b", "new", "font"]);
  });

  it("a node that left the parent altogether: removal is a no-op, insertion goes to the end", () => {
    const N = guarded();
    const parent = new N("div");
    const stays = new N("a");
    parent.append(stays);
    const gone = new N("#text");
    expect(() => parent.removeChild(gone)).not.toThrow();
    parent.insertBefore(new N("new"), gone);
    expect(names(parent)).toEqual(["a", "new"]);
  });

  it("leaves ordinary calls alone, and patches a prototype once", () => {
    const N = guarded();
    const parent = new N("div");
    const a = new N("a");
    const b = new N("b");
    parent.append(a, b);
    parent.insertBefore(new N("c"), b);
    parent.removeChild(a);
    expect(names(parent)).toEqual(["c", "b"]);
    expect(guardDomProto(N.prototype as unknown as GuardProto)).toBe(false);
  });

  it("looks for the wrapper a few levels up only", () => {
    const parent = new FakeNode("div");
    let node = new FakeNode("#text");
    const leaf = node;
    for (let i = 0; i < 12; i++) {
      const wrap = new FakeNode("x");
      wrap.append(node);
      node = wrap;
    }
    parent.append(node);
    expect(wrapperWithin(parent, leaf)).toBeNull();
    expect(wrapperWithin(parent, node)).toBe(node);
  });
});
