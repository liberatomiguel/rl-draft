import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Links must go through AppLink (intent-only prefetch). Next 16's default
  // viewport prefetch costs ~5 requests per visible link in the static export.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/AppLink.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: "Use AppLink from @/components/ui/AppLink (intent-only prefetch).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // wrangler dev scratch output
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
