# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-01

First public release: a modular, plugin-based platform with a marketplace of
first-party modules and a schema-driven theme system. The entries below record
what the release contains, and — where a defect was found and corrected before
shipping — what it no longer does.

### Added
- **One-command install.** `install.sh` installs Docker if missing, generates
  every secret, writes `.env`, pulls the published image, starts the stack,
  waits for `/api/health`, and prints the URL and admin password. Three
  questions, each with a default; fully scriptable with flags. Re-running it
  is an upgrade and never overwrites an existing `.env`.
- **`uxwvend` management command** — `update`, `backup`, `restore`, `logs`,
  `restart`, `stop`, `start`, `status`, `version`.
- **Automatic HTTPS.** With a domain, a Caddy container (compose profile
  `tls`) obtains and renews a Let's Encrypt certificate. Replaces the manual
  Nginx + Certbot steps.
- `docker-compose.build.yml` (build from source) and `docker-compose.debug.yml`
  (republish Postgres/Redis on `127.0.0.1` for troubleshooting) overrides.
- `SITE_NAME` is now read at runtime for the authenticator issuer and
  outbound e-mail "from" name.
- **`UXWVEND_MARKETPLACE_BASE`** points the in-app marketplace at a fork or an
  internal mirror. Validated as http(s) — the response is unzipped onto disk.
- **`log` is exported from `@/core/sdk/server`**, so a module's cron jobs and
  hook listeners can emit structured logs with a correlation id.
- **`validate-module.ts --all`** validates every module in one process (1.2s,
  down from minutes of per-module `tsc` runs).
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue/PR templates, Dependabot, and
  CodeQL scanning for the open-source release.
- Docker Compose now bootstraps the database (schema push + seed) on first boot
  via a one-shot `migrate` service, so `docker compose up` yields a working
  login out of the box.
- `SECRET_ENCRYPTION_KEY`, `INTERNAL_API_SECRET`, `DEMO_MODE`, and
  `POSTGRES_PASSWORD` documented in `.env.example` and `docs/DEPLOYMENT.md`.
- `trophies` module: ships with starter trophies that seed on first boot from
  within the module (no longer coupled to the core seed).

### Changed
- `docker-compose.yml` runs the published image
  (`ghcr.io/uxplima/uxw-vend`) instead of building from source. Build with the
  `docker-compose.build.yml` override.
- **CI now runs the gates that already existed.** `typecheck:modules`,
  `validate:module` and the 18 Playwright specs were written, wired into npm
  scripts, and then never executed by any workflow. All three run on every push
  and pull request.
- **`typecheck:modules` no longer tolerates a baseline.** It builds a throwaway
  Prisma client from core plus every module schema and demands zero errors,
  where it previously tolerated 503. Two real bugs were hiding in that baseline.
- **The two largest files are split.** The setup wizard (851 lines) becomes an
  orchestrator plus one file per step; the admin modules screen (800) sheds its
  modal, helpers and types and moves its state into `useAdminModules()`.
- **Operational logs are structured.** Cron results, broadcasts, shutdown and
  module snapshots go through `logger.ts` with fields instead of interpolated
  strings. `hooks.ts` and `module-loader.ts` deliberately keep `console` — both
  are reachable from client bundles, and the logger imports `next/headers`.
- **1,419 lines of dead code removed**, including seven orphaned copies of
  `settings-form.tsx` and three unreferenced module libraries.
- **The published image no longer carries the build cache.** `next build`
  leaves ~580MB in `.next/cache`; the runner stage copied `.next` wholesale
  and `next start` never reads it. 3.03GB down to 1.99GB per pull.

### Fixed
- **The in-app marketplace fetched from the old repository.** Eight route
  handlers and one component carried their own copy of the catalogue URL,
  none of them updated when the project moved. A fresh install pulled its
  modules from one repository and its updates from another. Now one module,
  resolved at request time.
- **`hooks.d.ts` promised a non-null `authorId`** for blog article hooks, but
  the column is nullable with `onDelete: SetNull` — an article outlives the
  account that wrote it, so every listener typed against that contract could be
  handed a null it was told it would never see.
- **The E2E suite could only ever run on one machine.** It hardcoded an admin
  password that `prisma/seed.ts` only produces if you set `SEED_ADMIN_PASSWORD`
  to exactly that value. Credentials and base URL now come from the
  environment.
- **The README CI badge pointed at a workflow that does not exist**, so it had
  been rendering as "no status".
- **Backup download and audit-log CSV export navigated the page.** They relied
  on the endpoint sending `Content-Disposition`; when it didn't — an expired
  session, a 500 with an HTML body — the admin lost the page and its filters.
- **`@prisma/client` and the `prisma` CLI had drifted apart** (7.8.0 vs 7.10.0
  from the same range), a skew that surfaces as confusing schema errors.
- **Upgrades left the database behind.** `scripts/docker-bootstrap.ts` was a
  no-op on an initialized database, so pulling a newer image never merged
  schemas, pushed them, or applied module SQL migrations. It now runs the full
  upgrade sequence, and the `migrate` service mounts the modules volume so the
  merged schema includes installed modules.
- **Redis was never actually usable.** The `redis` package was declared as an
  *optional peer dependency*, so it was in no lockfile and no install had it —
  yet `docs/DEPLOYMENT.md` said setting `REDIS_URL` was enough. Every
  deployment silently ran on the in-memory rate limiter (which
  `.env.example` itself calls "process-local and trivially bypassable") and
  `/api/health` reported `degraded` forever. The Docker stack made this
  concrete: it ships a Redis container, wires `REDIS_URL` to it, and the app
  logged `Cannot find module 'redis'`. `redis` is now a regular dependency.
  It is still loaded lazily and only when `REDIS_URL` is set, so installs that
  do not want Redis are unaffected.
- **Canonical URLs were frozen at build time.** `sitemap.xml`, `robots.txt`
  and every OpenGraph/canonical tag were built from `NEXT_PUBLIC_*`
  variables, which `next build` inlines into the bundle — in a prebuilt image
  they cannot vary per installation, so every install would have published
  `http://localhost:3001`. These now resolve from `AUTH_URL` at runtime via
  `src/core/lib/app-url.ts`. `robots.txt` and `sitemap.xml` needed a second
  fix: they were the only two routes Next prerendered at build time, so the
  URL was baked into the image regardless of where it was read from. Both now
  touch a request-time API to opt out; the sitemap keeps its one-hour cache
  through an in-process memo instead of `revalidate`.
- Docker build no longer aborts: the builder and `postinstall` now call the
  correct `generate-theme-registry.ts` script.
- `npm run db:seed` on a fresh clone no longer references a module-owned model
  (core seed produces only roles + permissions + admin user).
- SEO `robots.txt`/`sitemap.xml` now read the documented `NEXT_PUBLIC_APP_URL`
  (falling back to `NEXT_PUBLIC_SITE_URL`) instead of silently defaulting to
  `localhost`.
- Marketplace ZIPs rebuilt from current sources.
- **The two module test suites had never run.** Vitest collects
  `tests/modules/<id>/` only when that module is installed, and `src/modules`
  is empty on a normal checkout — so they were silent everywhere except the
  CI job that seeds modules, which had itself never run the suite. All three
  faults they were hiding are fixed: `next` ships no `exports` map so
  next-auth's `import "next/server"` cannot resolve outside Next's bundler
  (any test reaching `@/core/sdk/server` died at collection), `activity-log`
  imported auth relatively where the rest of the tree uses `@/core/lib/auth`,
  and the Stripe webhook fixture returned an order without the `status` its
  own handler had just written.
- **`next build` failed on any installation that had modules.** Not on a clean
  checkout, where `src/modules` is empty — which is how it went unnoticed
  until CI, which seeds modules, got far enough to reach the build step. The
  generated `module-registry.tsx` carried both the module page components and
  the module API handlers, and client components import that file, so the
  bundler traced server-only code into the browser graph and failed on
  `fs/promises`, `async_hooks` and `next/headers`. Page and API registries now
  have their own generated files, each consumed only by server code.

### Security
- **Postgres and Redis are no longer published to the host.** The compose file
  mapped `5432:5432` and `6379:6379`, putting both on the public internet of
  every server the stack was installed on. They are now reachable only from
  inside the compose network.
- **Vulnerability reports were being sent to the wrong repository.**
  `SECURITY.md` and the issue-template config pointed at the project's previous
  GitHub location, so anyone following the documented disclosure path was
  filing where nobody would read it.
- **Both moderate advisories cleared** (uuid via `@measured/puck`), with an
  override rather than npm's suggested major downgrade of Puck. The two
  remaining are low: quill's HTML-export XSS has no upstream fix, and editor
  content is already sanitized on write and again on render.
- **Password-reset and verification URLs are no longer logged in production**
  when no mail transport is configured. They stay in dev, where a developer
  without SMTP needs them to finish the flow.
- Admin update handlers (downloads, popups, staff) now validate input against an
  explicit allowlist instead of spreading the raw request body (mass-assignment).
- Store product/category descriptions and blog titles are sanitized at write
  time; JSON-LD output is escaped against `</script>` breakout.
- The discord-integration webhook sender enforces the same hostname allowlist as
  core; the punishments API key check is now constant-time.

[Unreleased]: https://github.com/UXPLIMA/uxw-vend/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/UXPLIMA/uxw-vend/releases/tag/v0.1.0
