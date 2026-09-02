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
            // A ratchet, not a target. Set just under the numbers the suite
            // actually produced on 2026-09-02 so an unrelated change cannot
            // quietly remove coverage; raise them when you add tests, never
            // lower them to make a build pass.
            //
            // The two security-critical files carry their own floors. That is
            // the whole reason they are not in `exclude` above — measuring
            // them was pointless while nothing enforced the measurement, and
            // for a long time nothing did: `@vitest/coverage-v8` was not even
            // installed, so `npm run test:coverage` failed on the missing
            // provider and CI ran `npm test` without it.
            thresholds: {
                statements: 76,
                branches: 70,
                functions: 70,
                lines: 78,
                'src/core/lib/permissions.ts': {
                    statements: 85, branches: 90, functions: 72, lines: 80,
                },
                // Reconciling the build against the installed modules is the
                // difference between a module install working and silently
                // doing nothing. Every branch of the drift detection is worth
                // a test, so hold it near the top.
                'src/core/lib/build-state.ts': {
                    statements: 95, branches: 92, functions: 100, lines: 95,
                },
                // The install path: the lock that keeps two installs from
                // racing, and the queue that decides whether a module install
                // is ever served. Two of the three defects fixed in 0.2.0
                // lived here — a restart that always threw and a build whose
                // result nothing recorded — and neither had a test.
                'src/core/lib/install-lock.ts': {
                    statements: 95, branches: 75, functions: 100, lines: 95,
                },
                // SIGTERM is now how the platform restarts itself after an
                // install, so this registry is on the critical path of every
                // module install, not just of `docker stop`.
                'src/core/lib/shutdown.ts': {
                    statements: 95, branches: 95, functions: 100, lines: 95,
                },
                // Irreversible or unrecoverable by nature: an erasure that
                // deletes too much destroys the public record, an export that
                // leaks a password hash cannot be un-sent, and every upload on
                // the instance passes through storage.ts's sniffer.
                'src/core/lib/user-deletion.ts': {
                    statements: 100, branches: 100, functions: 100, lines: 100,
                },
                'src/core/lib/user-data-export.ts': {
                    statements: 100, branches: 100, functions: 100, lines: 100,
                },
                'src/core/lib/module-backup.ts': {
                    statements: 100, branches: 100, functions: 100, lines: 100,
                },
                'src/core/lib/storage.ts': {
                    statements: 95, branches: 95, functions: 100, lines: 95,
                },
                // Both routers walk every installed module's declared paths,
                // so a bug here is cross-module: the loop that throws is
                // walking somebody else's routes. The API matcher used to
                // build an illegal capture group for a catch-all and take the
                // whole router down with it.
                'src/core/lib/path-pattern.ts': {
                    statements: 95, branches: 95, functions: 100, lines: 95,
                },
                // Sanitising happens on write, so anything that gets past
                // this is in the database and every later render serves it.
                'src/core/lib/sanitize.ts': {
                    statements: 100, branches: 100, functions: 100, lines: 100,
                },
                // Consulted by middleware on every request. Too wide a CIDR
                // locks the admin out; a propagated DB error denies everyone.
                'src/core/lib/ip-blocks.ts': {
                    statements: 100, branches: 95, functions: 100, lines: 100,
                },
                // Restore is the most destructive operation the platform has
                // (pg_dump --clean drops every table before reloading), and
                // rotation deletes archives on its own schedule.
                'src/core/lib/backup.ts': {
                    statements: 95, branches: 80, functions: 100, lines: 95,
                },
                // On the boot path since 0.2.0. A ticker that never starts
                // stops backups, the email queue, warning expiry and health
                // alerting, and nothing surfaces it.
                'src/core/lib/scheduler.ts': {
                    statements: 90, branches: 70, functions: 100, lines: 90,
                },
                'src/core/lib/secret-storage.ts': {
                    statements: 92, branches: 80, functions: 100, lines: 92,
                },
                // Every outbound message passes through email.ts, and `to`
                // and `subject` arrive there from user-controlled places. A
                // bare CR/LF that survives sanitisation turns any of them
                // into an arbitrary-recipient Bcc.
                'src/core/lib/email.ts': {
                    statements: 95, branches: 92, functions: 100, lines: 98,
                },
                // The cache layer's whole contract is that it degrades: a
                // flaky Redis has to fall back to memory rather than turn a
                // slow page into a 500.
                'src/core/lib/redis.ts': {
                    statements: 95, branches: 95, functions: 100, lines: 95,
                },
                'src/core/lib/cache.ts': {
                    statements: 95, branches: 90, functions: 100, lines: 98,
                },
                // Maintenance mode is the switch that takes the site offline
                // and setup state is the gate that redirects every request to
                // the wizard. Both must fail *open* on a database error, and
                // both are cheap enough to hold at full coverage.
                'src/core/lib/maintenance.ts': {
                    statements: 100, branches: 100, functions: 100, lines: 100,
                },
                'src/core/lib/setup-state.ts': {
                    statements: 100, branches: 100, functions: 100, lines: 100,
                },
                // Opt-out by default: inverting this either silences every
                // notification or ignores every user's mute.
                'src/core/lib/notif-prefs.ts': {
                    statements: 100, branches: 100, functions: 100, lines: 100,
                },
                // Crossing a warning threshold is what auto-mutes and
                // auto-bans users, via a hook other modules subscribe to.
                'src/core/lib/warnings.ts': {
                    statements: 100, branches: 90, functions: 100, lines: 100,
                },
                // Re-exported through the module SDK, so `slugify` and
                // friends are a published contract third-party modules build
                // on — changing one silently changes their URLs.
                'src/core/lib/utils.ts': {
                    statements: 100, branches: 95, functions: 100, lines: 100,
                },
                // Two separate output paths, only one of which ever runs
                // locally: a break in the production JSON path shows up as
                // "the log aggregator is empty" long after deploy.
                'src/core/lib/logger.ts': {
                    statements: 95, branches: 95, functions: 100, lines: 95,
                },
            },
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
