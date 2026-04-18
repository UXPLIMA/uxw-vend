import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // CommonJS bootstrap files (PM2 ecosystem config, etc.) use require() by
  // spec — disable the TS "no-require-imports" rule for .cjs only.
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated artifacts — never owned by humans.
    "src/core/generated/**",
    "src/generated/**",
    // First-party module source + its runtime copy are NOT subject to the
    // core platform's lint bar. Each module has its own quality profile; we
    // enforce lint on src/core, src/app, src/proxy.ts, and scripts/ — the
    // parts that DO share a standard. Module sources are linted separately
    // by their module authors.
    "module-sources/**",
    "src/modules/**",
  ]),
]);

export default eslintConfig;
