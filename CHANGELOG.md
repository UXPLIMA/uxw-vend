# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Icons are picked from a list, not typed from memory.** Every icon field in
  the admin - the navbar editor, a module's CRUD form, a module settings form,
  the page builder's card block - now opens a searchable dialog of the whole
  Lucide set with each icon drawn next to its name. The old fields were plain
  text boxes: an admin had to already know a name from lucide.dev, and a typo
  rendered nothing at all with no error to say why. `AdminCrudPage` and
  `SettingsForm` take `type: "icon"` for it, so a module gets the picker by
  naming a field type rather than by shipping a component.

### Changed
- **A public page no longer ships the admin panel's copy.** The locale layout
  handed the whole message catalogue to the client provider, and the `admin`
  namespace is around four fifths of it: every visitor downloaded 42KB of
  strings for screens they cannot open. The admin tree re-provides the full
  catalogue for itself. The homepage went from 120KB to 65KB of HTML (32KB to
  18KB gzipped), the login page from 108KB to 54KB.

### Added
- **`routes[].noindex` in a module manifest.** Keeps a page out of
  `sitemap.xml` and marks it `noindex` for crawlers, for the pages meant to be
  walked through rather than found. The store's cart and order confirmation
  set it. `CORE_API_VERSION` unchanged: this is an optional field on an
  existing entry, and a manifest that omits it behaves exactly as before.

### Fixed
- **The sitemap listed four URLs and none of the site's content.** Core routes
  the home and activity screens; everything a visitor comes for is a module
  page, and a module reached the sitemap only by declaring a `seo`
  contributor, which none of the first-party ones do. Every static public page
  an enabled module routes is published now, dynamic paths still being the
  module's own to enumerate. The two `/auth` entries are gone: robots.txt
  disallows that prefix, so the sitemap was submitting URLs it had just asked
  crawlers to skip. Both files read the same lists now, and a test holds them
  to it.
- **Creating a vote site returned 404.** The vote admin page posted to
  `/api/v1/vote`, which no manifest declared; the handler lives at
  `/api/v1/vote/sites`. Four other modules had the same class of break: store,
  forum, help-center and vote declared a collection route but no `[id]` route,
  so every edit and delete from those admin pages 404'd, and slider had an
  `[id]` handler on disk that no manifest declared - unreachable, since module
  requests are dispatched from the manifest and not from the filesystem.
- **The slider admin could not see an inactive slide.** Its list endpoint
  filtered to active slides for everyone, including the admin whose job is to
  turn one back on.
- **`validate-module` now checks that API routes are wired.** It fails a module
  whose `api/**/route.ts` no manifest declares, whose `AdminCrudPage` posts to
  an undeclared path, or that has a collection route with no `[id]` route
  behind an edit and delete UI. All five bugs above were of a kind no gate
  looked for, which is why they shipped.
- The page builder's card block declared an icon and never drew it.
- **Every unknown URL answered 200, and so did every crash.** Next commits the
  status line when it flushes the shell, and two things were putting the whole
  page inside a Suspense boundary that flushed first: the generated context
  provider registry loaded each module's provider through `next/dynamic` (a
  provider wraps the page, so its boundary contained the entire document), and
  the two catch-all segments carried a `loading.tsx`. A `notFound()` after that
  point could no longer set 404, a thrown error could no longer set 500, and
  the admin redirect for a signed-out visitor went out as 200. Context
  providers are now imported statically, both catch-all `loading.tsx` files are
  gone, and a test guards each shape. The catch-all pages lose their skeleton
  while a module page loads; a correct status is worth more.
- The root `not-found.tsx` called `notFound()` on itself, asking the router to
  render the page that was already rendering. It renders a plain 404 now, with
  no locale to translate it into that far out of the tree.
- **The layout's error boundaries swallowed Next's control-flow signals.** `notFound()` and `redirect()`
  are raised by throwing, and both boundaries caught them like any other
  failure. They rethrow those now and keep catching real render failures.

### Added
- **Sign in with a username, not only an email.** Registration asks for both
  and both are unique, but the login form only ever accepted the email, which
  left anyone who remembered their username locked out of an account whose
  password they knew.
- **"Keep me signed in."** Without it a session lasts a day, as it always has;
  with it, thirty. The deadline is absolute and stamped on the token itself, so
  a session started on a shared machine ends whether or not the tab stayed
  open.
- **Every password field has a reveal toggle** - login, register, reset,
  first-run setup and the profile's delete confirmation.

### Added
- **Six more logins for the rest of the world**: VK and Yandex, Kakao and
  Naver, LINE, and Sign in with Apple. Apple takes a signed token rather than a
  client secret, so that module holds the `.p8` key and mints one at startup
  instead of asking an admin to paste in a token that silently expires after
  six months.
- **Eleven more ways to sign in**, each its own module: Battle.net, Epic Games
  and Xbox/Microsoft for games; Patreon, Kick, Reddit and Spotify for creators;
  Facebook, X, TikTok and Instagram for social accounts. Battle.net, Epic
  Games, Kick and Instagram build their own provider - a region issuer, two
  hosts, OAuth 2.1 with mandatory PKCE, and an API Meta replaced - and the rest
  name one Auth.js already ships.
- `authProviders[].standardCallback` lets a module that builds its own provider
  say that provider still returns through Auth.js's own callback, so the admin
  panel can show the redirect URL to register instead of nothing.
  `CORE_API_VERSION` 1.3.0 -> 1.4.0.
- **Payments are a contract, not a branch.** The store used to carry Stripe and
  PayPal itself, which is why "write your own gateway" was not true. It now
  asks through six filters - `payment.providers`, `payment.session`,
  `payment.settled`, `payment.voided`, `payment.refunded` and
  `subscription.changed` - and knows nothing about who answers. The four a
  gateway fires are filters rather than actions so a webhook nobody handled
  fails and the provider retries, instead of being acknowledged and lost.
- **Twelve more payment gateways**, each a module of its own: iyzico, PayTR and
  Param for Turkey; Coinbase Commerce, NOWPayments and CoinPayments for crypto;
  Mollie, paysafecard and Paymentwall for Europe; Razorpay, Mercado Pago and
  Midtrans for India, Latin America and Indonesia. Each offers itself only in
  the currencies it can actually settle, so a lira order does not draw a button
  that would refuse it, and each verifies its own callbacks: an HMAC where the
  provider signs one, and a read-back with the site's own credentials where it
  does not.
- Filters can declare what they are asked *about*, not just what flows through
  them. `UxwVendFilterContexts` types the second half of a filter contract at
  the call site and in every listener; filters that declare nothing behave
  exactly as before. `CORE_API_VERSION` 1.2.0 -> 1.3.0.
- The server panel knows Hytale, CS2, Garry's Mod and Unturned as server
  types, alongside the Minecraft, FiveM, Rust, ARK and CS:GO it already had.
- Modules can ship their own sign-in provider. `authProviders` takes a
  `factory` plus the env vars that gate it, instead of naming a provider
  Auth.js already has, and `oauthButtons` takes a same-origin `href` for a flow
  Auth.js cannot start. `CORE_API_VERSION` 1.1.0 -> 1.2.0.
- **Steam login** (`steam-auth`), the first module built on that. Steam speaks
  OpenID 2.0, so the module runs the OpenID half itself and hands Auth.js a
  single-use ticket. Set `AUTH_STEAM_API_KEY`.
- Sign in with **Roblox, Twitch, GitHub and FACEIT**.
- **Minecraft account linking** (`minecraft-link`). A player types their in-game
  name on the site, the server whispers them a six-character code over RCON,
  and they type it back. No server plugin: the proof is that only that account
  could read the whisper, and only while it was online. Fires
  `minecraft.account.linked` / `.unlinked` for other modules to follow.
- **License keys** (`license-keys`). Digital products hand out a key when the
  order completes: one per item, per seat, or in a bundle, with an optional
  term and an activation limit per machine. Software checks and activates over
  a public, rate limited endpoint that says the same thing about a wrong key as
  about one that never existed. Keys are stored hashed for lookup and encrypted
  for display, so a dumped table is not a bag of usable keys, and only the
  owner can read one back.

### Changed
- `npm run validate:module` lets a provider callback that authenticates by
  calling the provider back say so, with `@provider-callback: <why>`. The auth
  check knew how to recognise a signature check and nothing else, which is a
  gap for Mollie and Mercado Pago, whose callbacks carry only an id.
- **`stripe-gateway` and `paypal-gateway` are real modules.** They were a
  manifest and a settings page while the store did the work; they now own their
  own keys, their own tables and their own webhooks, and the store owns
  settling an order once somebody reports the money. Removing a gateway removes
  its payment method from the checkout, which is what installing modules is
  supposed to mean. The checkout page draws its buttons from whatever answers
  `payment.providers`, so a third gateway needs no change to the store.
- **Twelve setup presets**, covering Minecraft, Hytale, Rust, ARK, CS2,
  Garry's Mod, Unturned, FiveM, Roblox, an online store, digital products, and
  picking modules by hand. The game presets now name the sign-in module that game's
  players actually have, and the digital-products preset installs the new
  license keys module. A test resolves every preset through the installer, so
  a preset can no longer name a module whose dependency is missing.
- **RCON lives in one place.** The store and servers modules each carried a
  copy of the client, and the copies had drifted. The servers module owns it
  now and answers a `server.command` filter; the store asks through that hook
  and reports "no installed module can reach a game server" when nothing does.
- **RCON is configured per server.** The global `rcon_host` / `rcon_port` /
  `rcon_password` settings are gone - they held a second copy of the password
  in plaintext and could only describe one server. An install still carrying
  them has them moved onto a `GameServer` row, encrypted, the first time RCON
  is used; the settings rows are then deleted.

### Fixed
- **A fresh install showed raw translation keys.** Module strings live in the
  `Translation` table, and only the marketplace installer ever wrote them
  there. Modules chosen in the first-run wizard - which is how most installs
  get theirs - arrived with none, so the store rendered `store.title` and
  `store.cartEmpty` instead of words. The wizard now loads each module's
  strings as it installs it, and the Docker bootstrap seeds core's on both a
  fresh database and an upgrade, so a new release's new keys exist before
  anything renders them.
- **A dependency with a version range always read as missing.** The modules
  screen compared the whole spec (`store@^2.0.0`) against installed module ids,
  which never matches, so every payment gateway advertised a missing
  prerequisite on an install that had the store enabled. The range is now
  parsed and checked, and a module installed at the wrong version says so
  rather than claiming to be absent.
- **Admin search linked to `/admin/admin/...`.** The spotlight built a result's
  URL by putting `/admin` in front of a module route's path, which the registry
  already stores with the prefix on it, so every module page found through
  search led to a 404. Five modules also wrote the prefix into their own
  `settingsCards[].href`. One function now builds these URLs, the manifest
  schema refuses an admin path that carries its own prefix, and the five
  manifests are corrected.
- **The leaderboard and player profiles only compiled with a forum.** Both read
  the forum module's tables directly, and the leaderboard read the vote
  module's, without depending on either - so on any install that left one out,
  Prisma's client had no such model and the whole app failed to build. Both now
  ask for those tables in a way that can come back empty, the leaderboard
  offers only the boards its site can fill, and a profile reports only the
  statistics it can actually count rather than a row of zeroes.
- **An empty widget column pushed the page off centre.** Widgets decide for
  themselves whether they have anything to show, so a site with no orders yet
  reserved a third of the homepage for widgets that all rendered nothing. The
  column now collapses and the content spans the full width, and comes back on
  its own if a widget later has something to say.
- **OAuth sign-up could not create an account.** Auth.js's Prisma adapter writes
  the user shape Auth.js documents (`name`, `image`, nothing required beyond
  the email); core's `User` has `username` - required and unique - and
  `avatar`, and neither `name` nor `image`, so the insert was rejected and
  every first sign-in through an OAuth provider failed. The adapter is now
  wrapped: the display name becomes a unique username, the picture becomes the
  avatar, and a provider that hands over no email address (Battle.net, Epic,
  Kick, Reddit, TikTok, Instagram, X) gets a placeholder in the reserved
  `.invalid` TLD, which is what steam-auth already did for itself. Fields a
  provider returns that core has no column for - GitHub's
  `refresh_token_expires_in` is the usual one - no longer break account
  linking.

- **Server status only ever described one Minecraft server.** It asked
  mcsrvstat.us about a host kept in the settings table, ignoring the
  `GameServer` rows the admin panel edits, so a site with a Rust server showed
  offline forever. Status now reads those rows and speaks the protocol the
  server speaks: Minecraft's Server List Ping, A2S_INFO over UDP for the Source
  games, and FiveM's `dynamic.json`. No third party in the middle, every server
  asked in parallel, answers cached for twenty seconds. Hytale reports itself
  as not queryable rather than as down, because it ships no status protocol.
- **The module validator's TypeScript check passed everything.** It compiled
  against the main tsconfig, which excludes `module-sources/` outright, so the
  program contained none of the files being validated. It now runs the same
  typecheck as `npm run typecheck:modules`, and a module kept outside
  `module-sources/` is reported as skipped instead of passed.
- **Sign-in modules asked for credentials they could not use.** Six of them
  offered a form for a client id and secret, saved it to the settings table
  under keys nothing reads, and reported success - Auth.js assembles its
  providers from the environment at startup. They share one read-only setup
  panel now, and a test fails if a sign-in module grows a credentials form
  again.
- **No module could be picked during first-run setup.** The wizard's module
  step fetched `/api/v1/modules/marketplace`, and the setup gate in `proxy.ts`
  answers every path outside `/api/setup` with 503 until a user exists. The
  fetch failed on the one install the wizard exists to serve, the step caught
  the error, and it rendered "No modules available yet" with all 42 modules
  unreachable behind the gate. The theme step had the identical defect and was
  fixed earlier by adding `/api/setup/themes`; the module counterpart was never
  written. It exists now, and the catalog loader is shared rather than copied.
- A theme card in the wizard read "Suggests: [object Object]".
  `suggestedModules` is declared in `theme.json` as `{id, reason}` objects and
  the wizard typed it as `string[]`, so `join()` stringified them. TypeScript
  could not catch it because the response is cast, not validated.
- The wizard ignored the active theme: twenty-one hardcoded Tailwind blues
  across its six steps. They are theme tokens now.
- The wizard's step bar drifted out of line whenever a label wrapped to two
  lines. The connector was placed with a negative margin inside a row centred
  on the whole column, so a taller column pushed its connectors down.

### Changed
- The site-type presets are rebuilt around the site kinds people actually
  arrive with: `minecraft`, `roblox`, `fivem`, `unturned`, `ecommerce`,
  `license-sales` and `software-sales`, replacing the three generic ones.
  Selecting one still preselects a theme and a module set and still opens the
  remaining steps for editing; only the catalog changed, not the flow. The
  wizard now renders each preset's declared Lucide icon, which the schema had
  documented as rendered while nothing drew it.
- The default `flat` theme is rebuilt on a neutral gray palette. Its dark mode
  used Tailwind slate, which measures H222 S47% at the background token and
  reads as blue rather than gray. Two further problems came out of the audit:
  `card` and `muted` were the same colour, so cards had no separation from
  muted fills, and `primary` on `background` sat at 3.45:1, below the WCAG AA
  floor. Both modes now use a neutral warm gray family with a single blue
  accent, and every foreground/background pair was measured and passes AA.
  `primaryForeground` also became an editable token; it was the one brand
  colour missing from the theme editor.
- Every em dash in the repository is now a hyphen, 1308 of them across 385
  files, and `npm run check:style` fails CI if one comes back. The gate reads
  the whole tracked tree rather than being an ESLint rule, because most
  occurrences were in JSON translations, Markdown and shell.
  `scripts/patch-next-agent-rules.ts` rewrites the agent-rules template inside
  the `next` package, which `next dev` writes into `AGENTS.md` on every start
  and which would otherwise re-dirty the file after each dev boot.
- The README leads with the install command and explains, above the module
  catalog, that module pages are compiled into the Next build, so an install
  rebuilds the app and replaces the process. That is the fact an operator most
  needs before deploying and it was documented only in `docs/DEPLOYMENT.md`.
  The commands section, the docs index and `docs/CONTRIBUTING.md`'s CI
  checklist were brought back in line with what the repository actually has.
- The deferred-build diagram in `docs/DEPLOYMENT.md` and `docs/MIGRATIONS.md`
  omitted `apply-schema-additions`, which has been in the pipeline since it
  replaced `prisma db push`. Leaving it out made the surrounding text read as
  if migrations created a new module's tables.
- The last three CI actions still on the deprecated Node 20 runtime moved to
  their Node 24 majors: `docker/setup-buildx-action` 3→4,
  `docker/build-push-action` 6→7 and `actions/upload-artifact` 4→7. The
  release run for 0.2.1 flagged them - the runner was already forcing them
  onto Node 24, so this only removes the warning. None of the inputs these
  workflows pass were among the ones the new majors dropped, and
  `build-push-action`'s `digest` output, which the release summary reads, is
  unchanged.

### Removed
- The `db:migrate:prisma` script. `docs/MIGRATIONS.md` says twice, in bold and
  again under anti-patterns, never to run `prisma migrate dev` against this
  repository, and `package.json` offered it as a script anyway. Nothing
  referenced it.

### Security
- **Four modules served their admin analytics to anyone who asked.** `blog`,
  `forum`, `tickets` and `store` each declare a `statsApi` that the admin
  dashboard reads, and none of the four handlers checked who was calling. An
  unauthenticated `GET /api/v1/store/stats` returned lifetime revenue, order
  counts and the newest orders with the customer usernames on them; forum
  returned recent topics with their authors, and tickets returned open support
  tickets with usernames and departments. All four call `isAdmin()` now and
  answer 401 to a signed-out caller, 403 to a signed-in non-admin. Module
  versions: blog 1.0.1, forum 1.0.2, tickets 1.0.1, store 2.0.3.
- **`validate-module` now checks that a `statsApi` is admin only.** The
  existing auth gate only inspected the write methods, so a route whose entire
  job is reading admin data walked past it every time. A module that declares
  `statsApi` and reaches the handler without `isAdmin()`, `isStaff()` or
  `hasPermission()` fails the gate, and a unit test applies the same rule to
  `module-sources/` so `npm test` alone catches a regression.

## [0.2.1] - 2026-09-02

### Fixed
- **A module installed one at a time came up enabled with none of its
  tables.** Twenty-five of the twenty-six modules that ship a `schema.prisma`
  ship no `migrations/` directory, which is what `docs/MIGRATIONS.md`
  prescribes: migrations exist to alter a module's schema *after* it is
  deployed, and the schema itself is what creates its tables the first time.
  The deferred build pipeline in `install-lock.ts` had no step that did that -
  its migration step was commented "replaces db push" - so a module installed
  at runtime never got one. `prisma db push` still ran in the `migrate`
  service at container start, but that is a one-shot service that does not
  re-run when the app restarts itself after an install. The result was a
  module the admin UI showed as installed and enabled whose every API route
  answered 500 with Prisma `P2021`, and whose cron job logged the same error
  once a minute indefinitely. Verified against a real install: `BlogArticle`,
  `BlogComment`, `BlogCategory` and `BlogTag` did not exist. The first-run
  setup wizard had the same gap.
  Bulk install pushed and worked, which is how this stayed invisible - the
  same asymmetry as the manifest-ref bug below, on the same two routes.
- **`prisma db push` could not have been the fix, and was removed from the
  paths that already used it.** It reconciles the whole database to the merged
  schema, and uninstall deliberately leaves a module's tables behind so a
  reinstall keeps the admin's data - so after any uninstall the database
  legitimately holds tables the schema no longer declares. Both of push's
  answers to that are wrong, and both were reproduced against a real install:
  a leftover *empty* table is dropped silently at exit 0, quietly breaking the
  preserved-for-reinstall promise; a leftover table *with rows* makes the push
  refuse to run at all, which under the fix above would have left the module
  being installed with no tables either. The second case also means that
  today, uninstalling a module that has data makes the next `docker compose
  up` fail in the `migrate` service and the app never start - so the Docker
  bootstrap's upgrade branch now applies the additive pass first and treats
  push's data-loss refusal as a warning it names rather than a fatal error.
  Every other push failure stays fatal, and a fresh database still pushes
  outright: there is nothing there to lose.
  `scripts/apply-schema-additions.ts` replaces it on every runtime path: it
  asks Prisma for the same diff with `migrate diff --script` and runs only the
  statements that add - `CreateEnum`, `CreateTable`, `CreateIndex`,
  `AddForeignKey`, and an `AlterTable` that neither drops nor retypes a
  column. Prisma annotates each statement with the operation that produced it,
  so the filter reads annotations rather than parsing SQL, and an operation it
  does not recognise is skipped rather than guessed at. Everything applies in
  one transaction. Verified live in the exact scenario that defeats `db push`:
  two missing module tables created, a populated undeclared table untouched.
- **Fourteen of the forty-two first-party modules could not be installed at
  all.** The marketplace-install, ZIP-upload and update routes each checked
  that the files a manifest names exist by comparing the ref to the disk
  verbatim - so `components/BlogNewsSection` was reported missing while
  `components/BlogNewsSection.tsx` sat right next to it. That extensionless
  form is not a mistake: `scripts/generate-registry.ts` strips the extension
  off every ref and emits a bare import specifier, leaving the bundler to pick
  the file, so the two spellings mean the same thing everywhere else in the
  system. `blog`, `store`, `popups`, `currency` and ten others tripped it and
  came back `400 Manifest references missing files`.
  `scripts/validate-module.ts` - the CI gate - did not catch this because it
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
  install route would reject outright - a `component` containing `..`, for
  instance - passed every check in the script. It is now the first thing the
  script checks after the id.
- **Four marketplace modules shipped a stale manifest for the whole 0.2.0
  cycle.** `module-marketplace/` holds ZIPs built from `module-sources/`, and
  both are committed, but nothing compared one against the other. The
  published `blog`, `forum`, `help-center` and `store` ZIPs predated the
  `searchProviders[].indexes` block their sources had gained - the exact
  capability `CORE_API_VERSION` was raised to 1.1.0 for. Results were still
  correct - the provider's `to_tsvector` query runs either way - but the four largest content tables never got their GIN
  full-text indexes created, so every site search on a marketplace install
  fell back to a sequential scan that recomputes a `tsvector` for every row. Rebuilt; the other 38 were already in sync.
- **A module declaring a catch-all API route would have taken down the whole
  module API router.** `matchApiRoute` built its own regex and turned
  `[...rest]` into the capture group `(?<...rest>…)`, which is not a legal
  group name, so `new RegExp` threw a `SyntaxError` from inside the loop that
  walks every installed module's routes - every route behind the offender was
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
  fail on each drift it is meant to catch - an edited source file, a bumped
  version, a source with no ZIP, a malformed manifest - not just to pass.
  `module-marketplace/` was the only committed build artifact without such a
  gate; the merged Prisma schema, the module registry and the OpenAPI spec are
  all gitignored and regenerated on every build.

### Changed
- The four places in `src/` that still built their own
  `path.join(process.cwd(), "src/modules")` now import `MODULES_DIR` from
  `runtime-paths.ts`. The value is identical; the point of the helper is its
  single `turbopackIgnore` hint, and an unbounded `process.cwd()` join
  anywhere in the import graph is exactly what it exists to keep out - each
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
  try/catch that swallowed the failure - and pm2 is in neither the Docker image
  nor `package.json`, so the call always failed. `next start` reads its route
  and build manifests once at boot, so the rebuild changed nothing the running
  process could serve. The restart is now a `SIGTERM` to ourselves, which runs
  the shutdown registry and lets the supervisor (compose `restart:
  unless-stopped`, systemd, or pm2 for anyone who does run it) start the
  process again. Four more copies of the same dead pm2 call - module
  uninstall, module update, bulk install and theme install - now go through
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
- **`src/instrumentation.ts`** - a real process lifecycle entry point. Hook,
  scheduler and search-index bootstrap used to hang off the root layout, so
  they ran on a render: per-request, per-locale, and never at all for a
  container serving only API routes, which left it without a scheduler.
- **CI now boots the published image.** A new job builds the image, runs the
  real compose stack, installs a module into the volume, restarts, and asserts
  the module is served and survives container recreation. Every previous gate
  ran against the source tree, so nothing tested the artifact people install -
  and both bugs above lived exactly there.
- **`docs/DEPLOYMENT.md` - "The Build Lifecycle"**, including the
  single-process scaling ceiling that compiling module pages into the app
  implies, stated plainly for the first time.
- **`docs/PLUGIN_SDK.md` - "The trust model"**: installing a module grants it
  the same database credentials, filesystem and secrets as core. There is no
  sandbox, the manifest `permissions` key is not enforced against module code,
  and the document now says so instead of implying otherwise.
- **`docs/PLUGIN_SDK.md` - "What uninstall does to your data"**: module tables
  and their rows are deliberately kept, with the SQL to remove them on purpose.

### Changed
- **`coreVersion` is now required in `module.json`.** Omitting it used to mean
  "compatible with every core version there will ever be" - the one default a
  compatibility gate must not have. All 42 first-party modules already declared
  it.
- **`src/core/lib/module-sandbox.ts` → `module-safe-call.ts`.** It is an error
  boundary, not a sandbox, and the old name claimed a security property the
  file does not provide.
- **The Docker image drops the test and lint toolchain.** The packages the
  runtime build genuinely needs (typescript, tailwind, tsx, prisma, dotenv,
  the `@types`) moved from `devDependencies` to `dependencies` - accurate,
  because this image rebuilds itself on module install - which lets the
  builder run `npm prune --omit=dev`.
- `uxwvend update` waits up to 15 minutes for health instead of 3, and says
  why, because a post-update boot with modules installed recompiles them
  first.
- **Full-text search indexes are declared by the module that owns the table.**
  `scripts/ensure-search-indexes.ts` held a hardcoded list of four module
  tables - `BlogArticle`, `ForumTopic`, `HelpArticle`, `Product` - inside core,
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
  - **ESLint 10** - `eslint-config-next` bundles an `eslint-plugin-react` that
    calls the ESLint 9 context API; every lint run dies with
    `contextOrFilename.getFilename is not a function`. Upstream fix required.
  - **TypeScript 7** - compiles the tree cleanly, but `typescript-eslint`
    refuses to run against the TS 7 API (their issue #10940). The documented
    workaround is a second, aliased TypeScript 6 for the linter, which would
    mean two type checkers disagreeing about one codebase. Revisit when
    `typescript-eslint` supports TS ≥ 7.1.
  - **Prisma 8** - `8.0.0-rc.12` is a release candidate. npm reports it as
    `latest` because of the dist-tag; it is not a released version, and the ORM
    is not where this project takes that bet.
- **`mysql2` pinned to `>= 3.22.0` via `overrides`** (GHSA-3f6p-5ww8-9rcr, auth
  plugin downgrade leaking plaintext credentials). It arrives through the
  Prisma CLI and is only reachable by a MySQL datasource, which this project
  does not use - but the advisory is high severity and the audit gate is not
  something to argue with. The remaining moderate advisory on `quill` has no
  fixed release; rich-text HTML is sanitized server-side with DOMPurify on
  write, so the export path it concerns never reaches stored content.

## [0.1.0] - 2026-09-01

First public release: a modular, plugin-based platform with a marketplace of
first-party modules and a schema-driven theme system. The entries below record
what the release contains, and - where a defect was found and corrected before
shipping - what it no longer does.

### Added
- **One-command install.** `install.sh` installs Docker if missing, generates
  every secret, writes `.env`, pulls the published image, starts the stack,
  waits for `/api/health`, and prints the URL and admin password. Three
  questions, each with a default; fully scriptable with flags. Re-running it
  is an upgrade and never overwrites an existing `.env`.
- **`uxwvend` management command** - `update`, `backup`, `restore`, `logs`,
  `restart`, `stop`, `start`, `status`, `version`.
- **Automatic HTTPS.** With a domain, a Caddy container (compose profile
  `tls`) obtains and renews a Let's Encrypt certificate. Replaces the manual
  Nginx + Certbot steps.
- `docker-compose.build.yml` (build from source) and `docker-compose.debug.yml`
  (republish Postgres/Redis on `127.0.0.1` for troubleshooting) overrides.
- `SITE_NAME` is now read at runtime for the authenticator issuer and
  outbound e-mail "from" name.
- **`UXWVEND_MARKETPLACE_BASE`** points the in-app marketplace at a fork or an
  internal mirror. Validated as http(s) - the response is unzipped onto disk.
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
  strings. `hooks.ts` and `module-loader.ts` deliberately keep `console` - both
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
  the column is nullable with `onDelete: SetNull` - an article outlives the
  account that wrote it, so every listener typed against that contract could be
  handed a null it was told it would never see.
- **The E2E suite could only ever run on one machine.** It hardcoded an admin
  password that `prisma/seed.ts` only produces if you set `SEED_ADMIN_PASSWORD`
  to exactly that value. Credentials and base URL now come from the
  environment.
- **The README CI badge pointed at a workflow that does not exist**, so it had
  been rendering as "no status".
- **Backup download and audit-log CSV export navigated the page.** They relied
  on the endpoint sending `Content-Disposition`; when it didn't - an expired
  session, a 500 with an HTML body - the admin lost the page and its filters.
- **`@prisma/client` and the `prisma` CLI had drifted apart** (7.8.0 vs 7.10.0
  from the same range), a skew that surfaces as confusing schema errors.
- **Upgrades left the database behind.** `scripts/docker-bootstrap.ts` was a
  no-op on an initialized database, so pulling a newer image never merged
  schemas, pushed them, or applied module SQL migrations. It now runs the full
  upgrade sequence, and the `migrate` service mounts the modules volume so the
  merged schema includes installed modules.
- **Redis was never actually usable.** The `redis` package was declared as an
  *optional peer dependency*, so it was in no lockfile and no install had it -
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
  variables, which `next build` inlines into the bundle - in a prebuilt image
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
  is empty on a normal checkout - so they were silent everywhere except the
  CI job that seeds modules, which had itself never run the suite. All three
  faults they were hiding are fixed: `next` ships no `exports` map so
  next-auth's `import "next/server"` cannot resolve outside Next's bundler
  (any test reaching `@/core/sdk/server` died at collection), `activity-log`
  imported auth relatively where the rest of the tree uses `@/core/lib/auth`,
  and the Stripe webhook fixture returned an order without the `status` its
  own handler had just written.
- **`next build` failed on any installation that had modules.** Not on a clean
  checkout, where `src/modules` is empty - which is how it went unnoticed
  until CI, which seeds modules, got far enough to reach the build step. The
  generated `module-registry.tsx` carried both the module page components and
  the module API handlers, and client components import that file, so the
  bundler traced server-only code into the browser graph and failed on
  `fs/promises`, `async_hooks` and `next/headers`. Page and API registries now
  have their own generated files, each consumed only by server code.
- **The Redis requirement was documented as a multi-worker concern.** It is
  not: with `NODE_ENV=production` and no `REDIS_URL`, the rate limiter fails
  closed and answers *every* rate-limited request with 429 - `/api/health`
  included, so the site reads as down. `docs/DEPLOYMENT.md` and
  `.env.example` said it mattered only for PM2 cluster or multi-pod setups,
  and the troubleshooting entry named the wrong status code. The E2E job
  found this the first time it managed to start a server.
- **Three E2E specs asserted on text and routes the app does not have.** They
  looked for an "API Rate Limits" heading (the page reads "Rate Limits" once
  translations are seeded, and only falls back to the longer string when they
  are not), an "Email Broadcasts" heading and a "Compose" button (the page
  says "Broadcasts" and "New"), and manifest-driven colour inputs on
  `/admin/settings/theme`, which is the theme library - they live on
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

[Unreleased]: https://github.com/UXPLIMA/uxw-vend/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/UXPLIMA/uxw-vend/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/UXPLIMA/uxw-vend/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/UXPLIMA/uxw-vend/releases/tag/v0.1.0
