import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party component copied in as published (by guglielmogiannattasio.it). Kept untouched so it can be
    // updated from the source; it writes to refs while rendering, which our stricter React rules flag.
    "components/ui/liquid-sculpture-hero.tsx",
  ]),
]);

export default eslintConfig;
