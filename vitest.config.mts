import { defineConfig } from 'vitest/config';
import fs from 'fs';
import path from 'path';

// `.mts` so Vite loads this as real ESM. As `.ts` it was loaded as CommonJS,
// which Vite warns about on every single run and plans to stop supporting —
// hence `import.meta.dirname` rather than `__dirname` below.
const rootDir = import.meta.dirname;

/**
 * Tests for a module live in `tests/modules/<moduleId>/` and are included only
 * when that module is actually installed.
 *
 * The platform ships with zero modules, so `src/modules/` is normally empty. A
 * test that imports `@/modules/<id>/...` cannot even be transformed in that
 * state — it fails at collection, not as an assertion. Gating the glob on what
 * is installed keeps `npm test` green on a clean checkout while still running
 * these tests on a machine where the module is present.
 */
const modulesDir = path.resolve(rootDir, 'src/modules');
const installedModules = fs.existsSync(modulesDir)
    ? fs.readdirSync(modulesDir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && fs.existsSync(path.join(modulesDir, e.name, 'module.json')))
          .map((e) => e.name)
    : [];
const installedModuleTestGlobs = installedModules.map(
    (id) => `tests/modules/${id}/**/*.test.{ts,tsx}`,
);

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: [
            'tests/unit/**/*.test.{ts,tsx}',
            'tests/integration/**/*.test.{ts,tsx}',
            ...installedModuleTestGlobs,
        ],
        coverage: {
            provider: 'v8',
            include: ['src/core/lib/**/*.ts'],
            // Only db.ts (a Prisma client singleton, no logic) and auth.ts (the
            // NextAuth config — can't be imported outside the Next bundler, see
            // tests/integration/two-factor-flow.test.ts) are excluded.
            //
            // The two most security-critical files — permissions.ts (the admin
            // authorization gate) and secret-storage.ts (at-rest secret crypto)
            // — are deliberately NOT excluded so their coverage is measured and
            // can be enforced. Do not add them here.
            exclude: ['src/core/lib/db.ts', 'src/core/lib/auth.ts'],
        },
    },
    resolve: {
        alias: {
            // Order matters: Vite tries alias entries in sequence and '@'
            // matches as a prefix, so the specific entry has to come first.
            //
            // Everything that reaches `@/core/lib/auth` — including any test
            // that touches `@/core/sdk/server`, whose `activity-log` re-export
            // imports it — gets a stub instead. See tests/stubs/core-auth.ts
            // for why the real module cannot be imported outside Next.
            '@/core/lib/auth': path.resolve(rootDir, 'tests/stubs/core-auth.ts'),
            '@': path.resolve(rootDir, 'src'),
        },
    },
});
