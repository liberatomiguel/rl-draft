/**
 * The SHARED PATH stays off the dataset (rc.26, #60). The root layout runs on
 * every page, and the home and content pages need no dataset, so none of them
 * may reach the `@/data` barrel through STATIC imports: the bundler would put
 * the dataset chunk (~62 KB gz) back on every page. The game pages below load
 * it on purpose. A dynamic `import()` is fine — it loads on demand
 * (`store/lazyRunStore.ts`, the home quiz modal).
 *
 * Under src/data, so it runs in `validate:data`: a regression fails `npm run build`.
 * Fixing one usually means a light module (`./catalog`, `./counts`,
 * `lib/dailyPlan`, `engine/quizState`…) instead of the barrel.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(srcDir, "app");
const BARREL = join(srcDir, "data", "index.ts");

/** Route folders that play with the dataset (they static-import it on purpose). */
const GAME_ROUTES = ["play", "challenges", "collection", "profile", "quiz", "career"];

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(srcDir, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (base === null) return null; // a package
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

/** Static VALUE imports of a module. Skips `import type`, all-type named imports
 *  (erased by the compiler) and dynamic `import()`. */
function staticImports(file: string): string[] {
  if (!/\.tsx?$/.test(file)) return [];
  const text = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const specs: string[] = [];
  for (const [, clause, spec] of text.matchAll(/^\s*import\s+([^"';]*?)\s+from\s*["']([^"']+)["']/gm)) {
    if (/^type\s/.test(clause)) continue;
    const named = clause.match(/^\{([\s\S]*)\}$/);
    const names = named?.[1].split(",").map((s) => s.trim()).filter(Boolean);
    if (names?.length && names.every((s) => s.startsWith("type "))) continue;
    specs.push(spec);
  }
  for (const [, spec] of text.matchAll(/^\s*export\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s*["']([^"']+)["']/gm)) {
    specs.push(spec);
  }
  for (const [, spec] of text.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) specs.push(spec);
  return specs.map((s) => resolveSpec(file, s)).filter((p): p is string => p !== null);
}

/** The static import chain from `entry` to the barrel, or null when there is none. */
function chainToBarrel(entry: string): string[] | null {
  const parent = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    for (const dep of staticImports(file)) {
      if (parent.has(dep)) continue;
      parent.set(dep, file);
      if (dep === BARREL) {
        const chain: string[] = [];
        for (let n: string | null = dep; n; n = parent.get(n) ?? null) chain.unshift(relative(srcDir, n));
        return chain;
      }
      queue.push(dep);
    }
  }
  return null;
}

const lightPages = (readdirSync(appDir, { recursive: true }) as string[])
  .map((rel) => rel.replace(/\\/g, "/"))
  .filter((rel) => /(^|\/)page\.tsx$/.test(rel))
  .filter((rel) => !GAME_ROUTES.includes(rel.split("/")[0]))
  .sort();

describe("shared path stays off the dataset (#60)", () => {
  it.each(["layout.tsx", "error.tsx", ...lightPages])("app/%s reaches no @/data barrel", (rel) => {
    expect(chainToBarrel(join(appDir, rel))).toBeNull();
  });

  it("the guard sees the barrel where a game page uses it (not vacuous)", () => {
    expect(lightPages).toContain("page.tsx");
    expect(chainToBarrel(join(appDir, "play", "page.tsx"))).not.toBeNull();
  });
});
