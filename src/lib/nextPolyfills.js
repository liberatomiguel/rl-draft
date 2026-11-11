/**
 * Stands in for Next's `polyfill-module` (v2.0, WEB-02; next.config.ts aliases
 * it). Next ships that module in the main chunk for every browser: trimStart /
 * trimEnd, Symbol.description, Array flat / flatMap / at, Promise.finally,
 * Object.fromEntries / hasOwn and URL.canParse. Every browser this site
 * supports (package.json "browserslist": Chrome/Edge/Firefox 111+, Safari
 * 16.4+) has all of them natively except URL.canParse (Safari 17, Chrome 120,
 * Firefox 115), so that one stays. PageSpeed reported the rest as "legacy
 * JavaScript". Raise the browserslist floor → drop this too.
 */
if (!("canParse" in URL)) {
  URL.canParse = function canParse(url, base) {
    try {
      return !!new URL(url, base);
    } catch {
      return false;
    }
  };
}
