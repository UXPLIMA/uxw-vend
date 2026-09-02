# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **A module installed one at a time came up enabled with none of its
  tables.** Twenty-five of the twenty-six modules that ship a `schema.prisma`
  ship no `migrations/` directory, which is what `docs/MIGRATIONS.md`
  prescribes: migrations exist to alter a module's schema *after* it is
  deployed, and `prisma db push` is what creates its tables the first time.
  The deferred build pipeline in `install-lock.ts` had dropped that push — its
  migration step was commented "replaces db push" — so a module installed at
  runtime never got one. `db push` still ran in the `migrate` service at
  container start, but that is a one-shot service that does not re-run when
  the app restarts itself after an install. The result was a module the admin
  UI showed as installed and enabled whose every API route answered 500 with
  Prisma `P2021`, and whose cron job logged the same error once a minute
  indefinitely. Verified against a real install: `BlogArticle`, `BlogComment`,
  `BlogCategory` and `BlogTag` did not exist. The first-run setup wizard had
  the same gap.
  Bulk install pushed and worked, which is how this stayed invisible — the
  same asymmetry as the manifest-ref bug below, on the same two routes.
  The push is skipped if the schema merge before it failed: pushing a stale or
  core-only schema is how you drop the tables of every installed module.
- **Fourteen of the forty-two first-party modules could not be installed at
  all.** The marketplace-install, ZIP-upload and update routes each checked
  that the files a manifest names exist by comparing the ref to the disk
  verbatim — so `components/BlogNewsSection` was reported missing while
  `components/BlogNewsSection.tsx` sat right next to it. That extensionless
  form is not a mistake: `scripts/generate-registry.ts` strips the extension
  off every ref and emits a bare import specifier, leaving the bundler to pick
  the file, so the two spellings mean the same thing everywhere else in the
  system. `blog`, `store`, `popups`, `currency` and ten others tripped it and
  came back `400 Manifest references missing files`.
  `scripts/validate-module.ts` — the CI gate — did not catch this because it
  was a fourth, separate implementation of the same check: extension-tolerant,
  but only across five of the twenty-one manifest keys that can carry a ref,
  and verbatim for `routes`, `adminRoutes` and `api`. All four callers now
  share `src/core/lib/module-ref-resolver.ts`, which resolves a ref the way
  the build does and reports escapes and misses separately.
- **Bulk install accepted a module no other path would have.** "Install all"
  in the admin module list posts to a separate route, and that route validated
  nothing: it `JSON.parse`d the manifest without running it through
  `moduleManifestSchema`, skipped the reserved-id list, skipped
  `validateZipEntries` (so no symlink, entry-count or zip-bomb check), and
  never confirmed the files the manifest names exist or that the manifest's
  own `id` matched the one requested. Installing the same module one at a time
  went through all of those. Two doors into `src/modules/` with different
  locks; they now carry the same ones.
- **CI validated module manifests without ever running them through the
  manifest schema.** `validate-module.ts` checked ids, fields and referenced
  files by hand but never called `moduleManifestSchema`, so a manifest the
  install route would reject outright — a `component` containing `..`, for
  instance — passed every check in the script. It is now the first thing the
  script checks after the id.
- **Four marketplace modules shipped a stale manifest for the whole 0.2.0
  cycle.** `module-marketplace/` holds ZIPs built from `module-sources/`, and
  both are committed, but nothing compared one against the other. The
  published `blog`, `forum`, `help-center` and `store` ZIPs predated the
  `searchProviders[].indexes` block their sources had gained — the exact
  capability `CORE_API_VERSION` was raised to 1.1.0 for. Results were still
  correct — the provider's `to_tsvector` query runs either way — but the four largest content tables never got their GIN
  full-text indexes created, so every site search on a marketplace install
  fell back to a sequential scan that recomputes a `tsvector` for every row. Rebuilt; the other 38 were already in sync.
- **A module declaring a catch-all API route would have taken down the whole
  module API router.** `matchApiRoute` built its own regex and turned
  `[...rest]` into the capture group `(?<...rest>…)`, which is not a legal
  group name, so `new RegExp` threw a `SyntaxError` from inside the loop that
  walks every installed module's routes — every route behind the offender was
  lost too. Nothing in the manifest schema forbids that path; no first-party
  module happened to declare one. Both matchers now share
  `src/core/lib/path-pattern.ts`, which handles catch-alls, escapes regex
  metacharacters in literal segments (`/store/v1.0` no longer matches
  `/store/v1X0`), and returns `null` instead of throwing on a malformed
  pattern.

### Added
- Tests for the paths where a bug cannot be undone: the shutdown registry and
  the install lock (now on the critical path of every module install), the
  GDPR erasure and export, the pre-install snapshot, the upload funnel, the
  HTML sanitiser, the IP blocklist, the backup/restore/rotate lifecycle, and
  the scheduler's tick loop and cluster claim.
- Tests for the paths that fail quietly rather than loudly: the outbound email
  queue and its SMTP header-injection defence, the Redis client and its
  fall-back-to-memory contract, the read-through cache, the structured
  logger's production JSON path, maintenance mode and setup state (both of
  which must fail *open* on a database error), notification preferences, the
  warning-threshold crossing that auto-mutes users, and the shared formatting
  helpers the module SDK re-exports.
- Tests for the rest of the untested surface: the health watchdog and its
  debounce, the module loader's tolerance of one bad manifest among many,
  the module registry's fail-closed enable check (the deliberate opposite of
  module-cache's fail-open one), email broadcasts, content revisions, the
  request-metrics window, and the SEO builders' `</script>` escaping.
- Coverage thresholds raised from 49/48/42/50 to 84/80/79/86 across three
  passes, with per-file floors on every module named above. The suite is
  1401 tests over 92 files, up from 644.
- `scripts/check-marketplace-sync.ts`, wired into CI: every published ZIP is
  unpacked and compared file-by-file against `module-sources/`, and
  `index.json` is checked against the manifests. The comparison is
  content-based rather than byte-based, because rebuilding a ZIP rewrites its
  embedded timestamps even when nothing inside changed. It was verified to
  fail on each drift it is meant to catch — an edited source file, a bumped
  version, a source with no ZIP, a malformed manifest — not just to pass.
  `module-marketplace/` was the only committed build artifact without such a
  gate; the merged Prisma schema, the module registry and the OpenAPI spec are
  all gitignored and regenerated on every build.

### Changed
- The four places in `src/` that still built their own
  `path.join(process.cwd(), "src/modules")` now import `MODULES_DIR` from
  `runtime-paths.ts`. The value is identical; the point of the helper is its
  single `turbopackIgnore` hint, and an unbounded `process.cwd()` join
  anywhere in the import graph is exactly what it exists to keep out — each
  one pulls the whole project into whichever bundle reaches it.
- CI actions moved to their current majors: `actions/checkout` 5→7,
  `actions/setup-node` 5→7, `docker/login-action` 3→4,
  `docker/metadata-action` 5→6 and `github/codeql-action` 3→4 (v3 is
  deprecated). All five are runner/Node-runtime bumps with no input changes.
  These had been sitting as separate Dependabot pull requests since June;
  applying them together produces one CI cycle instead of five conflicting
  rebases.

### Verified
- The published install path, end to end, for the first time: `install.sh`
  piped from `main` as a new user would run it, pulling
  `ghcr.io/uxplima/uxw-vend:latest` from the now-public registry rather than
  building locally. The image digest matched the 0.2.0 release, the stack came
  up healthy, and the `uxwvend` CLI it installs worked. CI's smoke test builds
  the image itself, so this leg had never actually been exercised.

## [0.2.0] - 2026-09-01

A correctness release. Every user-visible entry below is a defect that shipped
in 0.1.0 and that no gate could have caught, because every gate ran against the
source tree and none of them ran the image people install.

The minor bump (rather than a patch) is for one breaking contract change:
`coreVersion` is now required in `module.json`. `CORE_API_VERSION` moves to
1.1.0 for the new optional `searchProviders[].indexes` capability; every
first-party module's `^1.0.0` range still resolves.

### Fixed
- **Installing a module had no effect until the app was restarted by hand.**
  After the build, `scheduleBuild()` called `npx pm2 restart uxwvend` inside a
  try/catch that swallowed the failure — and pm2 is in neither the Docker image
  nor `package.json`, so the call always failed. `next start` reads its route
  and build manifests once at boot, so the rebuild changed nothing the running
  process could serve. The restart is now a `SIGTERM` to ourselves, which runs
  the shutdown registry and lets the supervisor (compose `restart:
  unless-stopped`, systemd, or pm2 for anyone who does run it) start the
  process again. Four more copies of the same dead pm2 call — module
  uninstall, module update, bulk install and theme install — now go through
  the same debounced `scheduleBuild()` path, which also stops them holding an
  HTTP request open for the length of a build.
- **Installed modules disappeared after `uxwvend update`.** The new image
  carried a build made with zero modules while the `modules` volume still held
  the admin's modules, and nothing reconciled the two. `scripts/reconcile-build.ts`
  now runs before the server binds a port: it fingerprints `src/modules/`,
  compares it against the fingerprint recorded beside the build, and rebuilds
  when they disagree. A failed rebuild is loud but keeps the previous build
  serving, so the admin UI stays reachable.
- **An in-container rebuild produced a stylesheet Tailwind never processed.**
  `postcss.config.mjs` was not copied into the runner stage, so the rebuild
  that runs on module install silently skipped Tailwind. `next-env.d.ts` was
  missing for the same reason, and `/app` itself was root-owned, so the
  rebuild could not write the files Next.js writes at the project root.
- `coverage/` is now excluded from ESLint. CI only escaped this because it
  lints before it runs the suite; on any machine that had run
  `npm run test:coverage`, `npm run lint -- --max-warnings=0` failed on
  vendored report helpers.

### Added
- **Boot-time build reconciliation** (`src/core/lib/build-state.ts`,
  `scripts/reconcile-build.ts`, `scripts/docker-entrypoint.sh`). The build and
  the installed module set can no longer silently disagree. 16 unit tests cover
  the four ways they can drift.
- **`src/instrumentation.ts`** — a real process lifecycle entry point. Hook,
  scheduler and search-index bootstrap used to hang off the root layout, so
  they ran on a render: per-request, per-locale, and never at all for a
  container serving only API routes, which left it without a scheduler.
- **CI now boots the published image.** A new job builds the image, runs the
  real compose stack, installs a module into the volume, restarts, and asserts
  the module is served and survives container recreation. Every previous gate
  ran against the source tree, so nothing tested the artifact people install —
  and both bugs above lived exactly there.
- **`docs/DEPLOYMENT.md` — "The Build Lifecycle"**, including the
  single-process scaling ceiling that compiling module pages into the app
  implies, stated plainly for the first time.
- **`docs/PLUGIN_SDK.md` — "The trust model"**: installing a module grants it
  the same database credentials, filesystem and secrets as core. There is no
  sandbox, the manifest `permissions` key is not enforced against module code,
  and the document now says so instead of implying otherwise.
- **`docs/PLUGIN_SDK.md` — "What uninstall does to your data"**: module tables
  and their rows are deliberately kept, with the SQL to remove them on purpose.

### Changed
- **`coreVersion` is now required in `module.json`.** Omitting it used to mean
  "compatible with every core version there will ever be" — the one default a
  compatibility gate must not have. All 42 first-party modules already declared
  it.
- **`src/core/lib/module-sandbox.ts` → `module-safe-call.ts`.** It is an error
  boundary, not a sandbox, and the old name claimed a security property the
  file does not provide.
- **The Docker image drops the test and lint toolchain.** The packages the
  runtime build genuinely needs (typescript, tailwind, tsx, prisma, dotenv,
  the `@types`) moved from `devDependencies` to `dependencies` — accurate,
  because this image rebuilds itself on module install — which lets the
  builder run `npm prune --omit=dev`.
- `uxwvend update` waits up to 15 minutes for health instead of 3, and says
  why, because a post-update boot with modules installed recompiles them
  first.
- **Full-text search indexes are declared by the module that owns the table.**
  `scripts/ensure-search-indexes.ts` held a hardcoded list of four module
  tables — `BlogArticle`, `ForumTopic`, `HelpArticle`, `Product` — inside core,
  the exact coupling the architecture forbids, and it logged an error for every
  one of them that was not installed on every boot. Modules now declare
  `searchProviders[].indexes` as plain identifiers (validated against
  `^[A-Za-z][A-Za-z0-9_]*$`); core builds the `tsvector` expression, so a
  module never supplies SQL. The index names and expressions are byte-identical
  to the old ones, so existing indexes are reused rather than duplicated.
- **Documentation corrected where it described behaviour the code does not
  have**: `docs/API.md` said an unconfigured rate limiter returns 503 and falls
  back to memory (it returns 429 and denies); PM2 cluster mode was recommended
  in `docs/DEPLOYMENT.md` and is now documented as unsupported, with the
  symptoms it produces; `SECURITY.md` now states that what an installed module
  can do is out of scope, and that the install pipeline is firmly in scope;
  `docs/ADMIN_GUIDE.md` now tells admins the site restarts after an install and
  that a module is not sandboxed.
- **Dependencies updated**: `@aws-sdk/client-s3`, `lucide-react`,
  `isomorphic-dompurify` 3 → 4, `redis` 5 → 6, `jsdom` 29 → 30,
  `@types/node` 25 → 26, `@testing-library/jest-dom` 6 → 7.

  Three were held back deliberately, each for a blocker that is reproducible
  rather than a matter of taste:
  - **ESLint 10** — `eslint-config-next` bundles an `eslint-plugin-react` that
    calls the ESLint 9 context API; every lint run dies with
    `contextOrFilename.getFilename is not a function`. Upstream fix required.
  - **TypeScript 7** — compiles the tree cleanly, but `typescript-eslint`
    refuses to run against the TS 7 API (their issue #10940). The documented
    workaround is a second, aliased TypeScript 6 for the linter, which would
    mean two type checkers disagreeing about one codebase. Revisit when
    `typescript-eslint` supports TS ≥ 7.1.
  - **Prisma 8** — `8.0.0-rc.12` is a release candidate. npm reports it as
    `latest` because of the dist-tag; it is not a released version, and the ORM
    is not where this project takes that bet.
- **`mysql2` pinned to `>= 3.22.0` via `overrides`** (GHSA-3f6p-5ww8-9rcr, auth
  plugin downgrade leaking plaintext credentials). It arrives through the
  Prisma CLI and is only reachable by a MySQL datasource, which this project
  does not use — but the advisory is high severity and the audit gate is not
  something to argue with. The remaining moderate advisory on `quill` has no
  fixed release; rich-text HTML is sanitized server-side with DOMPurify on
  write, so the export path it concerns never reaches stored content.

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
- **The Redis requirement was documented as a multi-worker concern.** It is
  not: with `NODE_ENV=production` and no `REDIS_URL`, the rate limiter fails
  closed and answers *every* rate-limited request with 429 — `/api/health`
  included, so the site reads as down. `docs/DEPLOYMENT.md` and
  `.env.example` said it mattered only for PM2 cluster or multi-pod setups,
  and the troubleshooting entry named the wrong status code. The E2E job
  found this the first time it managed to start a server.
- **Three E2E specs asserted on text and routes the app does not have.** They
  looked for an "API Rate Limits" heading (the page reads "Rate Limits" once
  translations are seeded, and only falls back to the longer string when they
  are not), an "Email Broadcasts" heading and a "Compose" button (the page
  says "Broadcasts" and "New"), and manifest-driven colour inputs on
  `/admin/settings/theme`, which is the theme library — they live on
  `/admin/theme/appearance`. None of it had ever been executed.

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

[Unreleased]: https://github.com/UXPLIMA/uxw-vend/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/UXPLIMA/uxw-vend/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/UXPLIMA/uxw-vend/releases/tag/v0.1.0
