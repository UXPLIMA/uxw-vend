import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // React 19 added a family of stricter hook rules (set-state-in-effect,
    // purity, no-deriving-state-in-effects, etc.) that didn't exist when
    // this codebase was authored. The rewrites they want are functional
    // refactors — not a safe automated sweep. Until the dedicated React 19
    // migration pass lands, these rules stay off so legitimate pre-existing
    // `useEffect(() => { setState(...) }, [deps])` flows don't drown every
    // other lint signal.
    //
    // react-hooks/exhaustive-deps stays at "warn" because those cases are
    // mostly a missing `t` from useTranslations (stable reference) and can
    // be fixed per-site when touched.
    {
        plugins: { "react-hooks": reactHooks },
        rules: {
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/purity": "off",
            "react-hooks/no-deriving-state-in-effects": "off",
            "react-hooks/static-components": "off",
            "react-hooks/preserve-manual-memoization": "off",
            "react-hooks/immutability": "off",
            "react-hooks/refs": "off",
            "react-hooks/error-boundaries": "off",
            "react-hooks/set-state-in-render": "warn",
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    // CommonJS bootstrap files (PM2 ecosystem config, etc.) use require() by
    // spec — disable the TS "no-require-imports" rule for .cjs only.
    {
        files: ["**/*.cjs"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
    // Underscore-prefixed identifiers are the conventional opt-out for
    // "intentionally unused" (params we keep for interface shape, catch
    // bindings we don't inspect, destructured keys we skip). The TS rule
    // doesn't honor that by default — configure it explicitly.
    {
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
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
