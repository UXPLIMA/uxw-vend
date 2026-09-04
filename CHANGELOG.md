# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Rate limits that were not what they said.** Three separate faults.
  `withRateLimit` hit the limiter with the bare client IP as its key, so every
  route wrapped in it shared one counter: a licence server checking keys from
  an office spent the budget the people behind that NAT needed to search the
  site or sign in through Steam, and a route asking for a tighter limit could
  not have one, because the count it read was everybody's. It now takes the
  scope as its first argument, which is what every hand-written call already
  did (`register:`, `gift-redeem:`, `2fa-verify:`). Three modules -
  custom-forms, downloads, help-center - built their key from
  `x-forwarded-for` read straight off the request, which the caller sets: a
  fresh header bought a fresh budget, so the form-spam limit in particular was
  no limit at all. They use `getClientIP`, which only honours that header from
  a peer in `TRUSTED_PROXY_IPS`. And seventeen mutating handlers reachable by
  any signed-in account had no ceiling at all: adding to a cart, placing an
  order, liking a post, editing a forum post. That last one writes a Revision
  row per edit holding the whole previous body, retained for a year, so an
  edit loop was a way for an ordinary member to grow the database without
  bound. A test now walks every handler and fails on a signed-in write path
  with no limit, an unscoped `withRateLimit`, or a key built from a header.

- **No endpoint had a request body limit.** App Router route handlers do not
  carry the 1 MB cap that Pages API routes shipped with, and nothing else in
  the stack supplies one, so every JSON endpoint accepted a body of any size
  and buffered it whole before its own validation could refuse a single field
  of it. The live demo parsed and answered an 8 MB registration body in 140 ms;
  the only unusual thing about that request was its size, and concurrency
  turns it into the heap. `readJsonBody` now reads the body as a stream and
  abandons it the moment it passes the cap, so an oversized request costs the
  cap and no more, and a `content-length` that lies or is missing entirely
  buys nothing. The default is 1 MiB, comfortably above every bound the
  schemas here set; a route that needs more says `{ maxBytes }`. Thirty routes
  that read their body with a bare `request.json().catch(...)` were reading
  without any cap at all, and they now say `{ fallback }` instead, which keeps
  the optional-body contract and keeps the ceiling. `proxy.ts` refuses
  anything above 64 MB - past the upload ceiling in `storage.ts` - before a
  handler runs. A test holds all of it, including the chunked body that
  declares no length.

- **A bad query string answered 500 instead of 400.** Prisma validates its own
  arguments before it builds any SQL and reports a bad one by throwing, which
  in a route handler is an uncaught 500 with no body. Three parameters reached
  it raw. `GET /api/v1/tickets?status=x` and the admin branch of
  `GET /api/v1/blog/articles?status=x` filtered a Prisma enum column on
  whatever the caller typed; the tickets one was reachable by any logged-in
  account. `GET /api/v1/media?page=abc` produced `skip: NaN`, and `?page=-5` a
  negative skip, because that route was the one paginated endpoint that parsed
  its page without the `|| 1` the others have - `Math.min` and `Math.max` both
  pass NaN straight through. Two helpers now do this once: `intParam` clamps a
  number into range and can never return NaN, and `enumParam` returns the 400
  the way `readJsonBody` does, so a caller that forgets the guard fails to
  compile. Each module's status list moved next to its write schema so the
  values the API will set and the values it will search for cannot drift. A
  test walks every route in core and 78 modules and fails when a query
  parameter reaches `skip`, `take` or an enum column unguarded.

- **A model validated on one write path and not the other.** The forum bounds
  a reply at 50000 characters and refuses an empty one when it is posted, then
  wrote the edit straight from the request body: `sanitizeHtml` turns a missing
  field into `""`, so any author could blank their own post with a PATCH
  carrying nothing, or store far more than the cap the create path enforces.
  Popups had the same defect mirrored - its PATCH parsed a schema, its POST
  wrote eight raw body fields, so `title` could be any type or absent (a 500
  from Prisma rather than a 400) and no field had a length at all. Both write
  paths of each model now parse the same schema; the popup schema moved to
  `module-sources/popups/lib/validations.ts` where the two routes share it, and
  it maps a cleared form field to null so an empty date no longer coerces to
  an Invalid Date. A new test walks every write handler in core and 78 modules
  and fails when one pushes body fields into a model that another handler
  validates.

- **Uploaded popup images never rendered.** The popup renderer passes the image
  and link through `safeUrl`, which kept only absolute http(s) urls. The admin
  form uploads its image through `/api/v1/upload`, which hands back a
  site-relative `/uploads/...`, so the image was dropped at render every time
  and the field looked broken. Same-origin paths are now kept; a
  protocol-relative `//host` still is not, since it points off-site.

- **One endpoint handed the request body straight to the database.**
  `PATCH /api/v1/changelog/[id]` built its update as `{ ...body }` and passed
  it to Prisma. Its own POST parses the same fields with a zod schema, so the
  module bounded `version` to 50 characters and required `color` to be
  `#rrggbb` on create and accepted anything on edit, writing the same row both
  ways. The spread also reached columns no edit should: `id`, which orphans
  the revision rows recorded against the old value, and `createdAt`, which is
  what the public changelog is ordered by. A key the model does not have went
  to Prisma too and came back 500, because an unknown column is a validation
  error thrown rather than returned. PATCH now parses with the same schema as
  POST, every field optional, plus the `isActive` and `publishAt` an edit can
  legitimately reach; zod drops anything else. It was the only write of its
  kind in core and 78 modules, and both `validate-module` and a test now say
  so.

- **Sixty six form controls had no accessible name.** A screen reader
  announced them by role alone: "checkbox, unchecked" with no hint of what it
  selects, "combo box" with no hint of what it changes. Among them were the
  select-all and per-row checkboxes in moderation, modules and every admin CRUD
  screen, the role and order-status dropdowns, the media type filter, the
  colour pickers, the custom CSS editor, the hidden file inputs behind every
  Upload button, and the store's sort order.

  A placeholder is not a name: it disappears as soon as anything is typed,
  some assistive technology ignores it, and several of these held an example
  rather than a description - `/path`, `#3b82f6`, `give {player} diamond 64` -
  where repeating it would have said nothing. Controls with a descriptive
  placeholder now carry it as `aria-label` as well, which is what the store's
  search box already did; the rest borrow the visible label sitting beside
  them, and three new strings cover what had no label to borrow. A test holds
  all 313 controls to the rule WCAG states, and does not accept a placeholder
  as a name.

- **Uninstalling a module left its credentials in the database, with no
  screen left to clear them.** Modules keep configuration in the shared
  `Setting` table, one row per key. `Setting.module` says who owns a row and
  is indexed, but nothing ever deleted by it: uninstall removed the module's
  files, its translations and its cron rows and left its settings untouched.
  Removing Cloudflare R2 stripped the admin page that holds its access key and
  secret while the key and secret stayed in the database. That is a different
  call from preserving module-owned tables, which hold what the admin built -
  products, articles, tickets - and should survive a reinstall; a stopped
  integration's credentials should not. Uninstall now deletes the rows the
  module owns and drops the cached public payload. Keys a module writes on
  core's behalf, like `storage_active_provider`, are tagged `core` and stay,
  and storage already falls back to local when its provider is gone.

- **Two modules never said which module their settings belonged to.** `store`
  and `referral` wrote rows without the owner column, so they defaulted to
  `core` and were indistinguishable from the platform's own - nothing could
  have cleaned them up even before uninstall started trying. Both tag their
  rows now, and `validate-module` rejects a settings write that does not.

- **Thirty six endpoints told an anonymous caller it was forbidden rather
  than that it needed to sign in.** 401 and 403 answer different questions:
  "I do not know who you are" and "I know, and you may not". 208 guards across
  the API separate them; these thirty six folded the session test and the
  permission test into one `if` and answered 403 for both. A client that
  renews an expired session keys on 401 - the store, forum and suggestions
  pages each do - so an admin whose session lapsed on one of these endpoints
  was told it was a permission problem and sent to ask for access they already
  had. Every one now checks the session, answers 401, then checks the
  permission and answers 403. Affects broadcasts, warnings, revisions, media,
  themes, resource permissions, moderation and module updates in core, and the
  trophies, cloudflare-r2 and cloudflare-turnstile settings endpoints.

- **Anyone could mint a link on the site's own domain that says whatever they
  want.** A module page is a component in a registry, not a route segment
  file, so it cannot export `generateMetadata` and core's catch-all titled it
  instead, from the last URL segment, whatever that was. That is safe only
  where a URL naming nothing answers 404, because Next then throws the
  metadata away and renders the not-found page's. Only the blog does that.
  Every other dynamic public module page resolves in the browser and answers
  200, so `/store/product/999999/free-nitro-generator` came back 200 with
  `<title>`, `og:title` and `twitter:title` all reading "Free Nitro Generator"
  beside the site's own name, which is exactly what an unfurled link shows in
  Discord or Twitter. With `custom-pages` installed the route is `/[slug]`, so
  it was every unrecognised URL on the site and not just the ones under a
  module. The title now comes from the route the module declared, not the URL
  the visitor typed: that page is "Product", `/player/[username]` is "Player".
  A route gets to name itself from the path only by declaring `titleFromPath`,
  which `validate-module` grants only to a server page that calls
  `notFound()`. The blog declares it and keeps its per-article titles.
  A path nothing serves is now `noindex` as well.

- **One line in one module manifest could turn the CSRF gate off for the whole
  API.** A payment provider posting a webhook has no browser and sends no
  Origin header, so a module marks that endpoint `providerCallback` and core
  generates a pattern the proxy exempts from the same-origin check. That
  pattern was built the same way as the module route map, which is a prefix
  match: right for "this subtree belongs to this module", wrong for "this path
  needs no origin check". A callback declared at `/[provider]` generated
  `/^\/api\/v1\/[^\/]+(?:\/|$)/`, which matches `/api/v1/users/me`,
  `/api/v1/roles`, `/api/v1/settings` and every other route in the product;
  `/[...path]` matched them all too. The only check on these declarations
  looked at whether the handler verified a signature, never at how far the
  exemption reached. Modules install from a ZIP, so the manifest is a trust
  boundary and this was reachable without touching core. The generated pattern
  is now anchored to the end of the declared path, `validate-module` refuses a
  callback whose first segment is dynamic, and a test checks the property both
  of those exist for: that no route core serves itself is exempt. The one
  callback that ships today, the Stripe webhook, is at a literal path and was
  never over-matching.

- **Eleven of the twelve dialogs promised a keyboard behaviour they did not
  have.** `role="dialog"` with `aria-modal="true"` tells assistive technology
  the rest of the page is inert, and nothing in the DOM makes that true. Only
  the confirm dialog trapped Tab. In every other one, Tab walked straight out
  of the dialog and into the page behind the overlay, which was still fully
  interactive and, to a sighted keyboard user, hidden under a black scrim:
  focus landed on controls nobody could see. None of the eleven put focus back
  where it came from either, so closing a dialog dropped focus on the body and
  the next Tab started again at the top of the page. Three had no Escape
  handler at all and could only be closed by clicking their backdrop: the SEO
  page-metadata form, the notification panel, and the dialog that asks whether
  to restore a database backup over the live one. The behaviour now lives in
  `useModalDialog` and all twelve use it, the confirm dialog included, so there
  is one implementation instead of one implementation and eleven omissions.

- **Updating a module never updated its strings.** A module's translations
  live in the manifest, which is what the repo ships, and in the `Translation`
  table, which is what the site renders. Only `syncModuleTranslations` fills
  the table. Install, upload, bulk install and first-run setup all call it;
  `POST /api/v1/modules/update` did not. So a module that gained a key in a new
  release kept rendering the set it shipped with on the day it was first
  installed: the key was in the files and never in the database, and the screen
  either fell back to a hardcoded English literal or rendered the key path.
  Nothing reported a problem, because from the file system's side the upgrade
  had worked. Update syncs now, which refreshes the rows an operator has not
  customised, adds the missing ones, and leaves `isCustom` rows alone.

- **The site's password rules did not apply to the site's own administrator.**
  `enforcePasswordPolicy` is the one function that applies all of the policy:
  ten characters, an uppercase, a digit, not one of the two dozen passwords
  everybody tries first, and whatever higher minimum the operator set. Its own
  file says "every flow that accepts a new password goes through this". Two did
  not. `POST /api/setup`, which creates the first administrator, asked zod for
  eight characters and nothing else, so the most privileged account on a new
  install could be `12345678` or `password` while a visitor registering an
  ordinary account was held to the full policy. `POST /api/v1/users`, where an
  admin creates an account for somebody else, checked length against a separate
  pair of constants in `constants.ts` that had drifted two characters below the
  policy's own. Both go through the policy now, and those two constants are
  gone: a second, looser password length sitting next to the real one is how
  this happened.
- **The setup wizard let the installer past a password the API would refuse.**
  It gated the Next button at eight characters and said "At least 8
  characters", which after the fix above would have meant filling the form,
  walking through four more steps and collecting a 400 at the end, with the
  wizard already past the screen that could fix it. It now applies the same
  policy the API applies and shows the policy's own message under the field.
  `checkPasswordBreach`, the one part of `password-policy.ts` that reaches the
  network and node's crypto, moved to `password-breach.ts` so the policy stays
  safe to import in the browser.

- **Thirty store and blog strings that were English in every language.**
  `t.has(key) ? t(key) : "literal"` is the supported way to render a key that
  may be absent, and it exists for a real case: a module's translations are
  seeded into the database at install time, so an install running an older copy
  has none of the keys a newer release added. The guard is not a substitute for
  writing the key. Where the key is missing from the module's own catalogue as
  well, no install will ever have it, the guard is taken every time, and the
  English literal is what every locale gets. The store shipped its whole cart
  error vocabulary that way (invalid coupon, invalid creator code, checkout
  failed), plus the "added to cart" toast, the cart icon's aria-label, the
  product thumbnail alt text, the option picker and the delete confirmations on
  three admin screens; blog shipped its category delete confirmation the same
  way. All 27 keys are now written in English and Turkish. The guards stay,
  because the stale-install case they were written for is real.

- **A permission the roles screen could not grant.** `custom-forms` declared
  `forms.manage` in its manifest and checked `custom-forms.manage` in
  `can-access-form.ts`. The manifest is the only route a permission name takes
  to the roles screen, and the roles screen is the only place a `Permission`
  row is ever created, so the name the code asked about was one no operator
  could tick. Every non-admin fell through to the granular per-form grant, and
  the module's own manage permission did nothing for anybody. Both halves now
  say `custom-forms.manage`. `help-center` had the milder version of the same
  drift, declaring `help.view` and `help.manage` under a namespace matching no
  module id, which also mis-attributed the `Permission.module` column that
  `roles/route.ts` derives from the part before the dot; it declares
  `help-center.*` now.
- **Two copies of the core permission list.** The names of the four permissions
  core owns were written out once in `modules.ts` and again in the roles screen,
  and only the second copy reached the UI. They come from
  `src/core/lib/permission-names.ts` now, which both read.

### Added
- `useModalDialog`, in `@/core/hooks` and published to modules through
  `@/core/sdk/ui`: Escape, a Tab trap that wraps at both ends and pulls focus
  back when something outside has taken it, focus moved in on open and handed
  back on close. `{ trapFocus: false }` covers a non-modal popover, which wants
  Escape and focus restoration but must leave the page usable. Core API version
  1.6.0.
- `tests/unit/use-modal-dialog.test.tsx` covers the hook's behaviour and
  `tests/unit/dialogs-are-keyboard-usable.test.ts` requires every component
  that draws a `role="dialog"` to use it, reach it through the published SDK if
  it is a module, and keep no hand-rolled Escape listener beside it.
- `tests/unit/module-writes-sync-translations.test.ts` requires every route
  that validates an incoming module manifest, which is what marks a route as
  one that writes a module's files, to put that module's strings in the
  Translation table. Uninstall is the mirror image and is checked to remove
  them instead.
- `tests/unit/password-writes-follow-policy.test.ts` requires every route that
  writes a password onto a user row to have run it through
  `enforcePasswordPolicy` first, and fails if a second password length
  reappears in `constants.ts`. It keys on the write rather than on
  `bcrypt.hash`, because API keys and two-factor backup codes are hashed too
  and answer to nothing here. The setup route's own tests cover the refusals
  end to end.
- `tests/unit/module-translation-keys.test.ts` gained a second rule: a key a
  module guards with `t.has` must exist in that module's shipped catalogue. The
  existing rule deliberately skips guarded keys, since a guard is the correct
  way to render a key that may be missing at runtime, and that exemption was
  the blind spot the store's English strings lived in.
- `tests/unit/permissions-are-declared.test.ts` pins the two halves of a
  permission name together: a name a module's code checks must be declared in
  that module's manifest, and a declared name must sit under its own module id
  (or `admin`, the namespace core owns). It also pins the inventory of the 33
  permissions that are declared, offered as a checkbox, and enforced by
  nothing, because every admin route gates on `isAdmin` instead. That list may
  shrink as permissions get wired up. It may not grow, so a new declaration has
  to arrive with the check that gives it meaning.

- **Paid for, marked paid, and granted nothing.** `settleOrder` is what every
  payment gateway calls once the money has moved. It marked the order
  COMPLETED, re-read it, created a chest item and an ownership row per line
  one at a time, then wrote the payment - four sets of round trips after the
  order already said it was paid. A process that died anywhere in the middle
  left a buyer who had paid with a COMPLETED order and an empty chest, and the
  duplicate guard at the top of the function then answered every webhook retry
  with "already settled", so nothing ever went back and fixed it. The read at
  the top is also a snapshot, so a gateway retry and a reloaded return URL
  arriving together both saw PENDING and both granted the same order. The
  credits path at checkout had already learned all of this and debits the
  balance with a conditional write; the gateway path had not, and neither had
  the free-order path beside it or either half of a subscription change - a
  cancelled plan whose ownership row survived the crash left the subscriber
  with the product they had stopped paying for, and a new plan whose grant did
  not land left them paying every month for nothing, because the retry found
  the subscription row and only updated its status. Credit top-ups were the
  same shape again: `findFirst` on `description: { contains: providerRef }` -
  a scan of the whole ledger - then an increment, so two deliveries of one
  webhook credited the account twice. Every one of these is now a single
  transaction claimed with a condition, and a top-up's ledger row carries a
  deterministic id so the primary key refuses the second write. The grants
  went from two statements per line item to two per order, and the delivery
  commands from one query per item to one per order, which a gateway webhook
  with a timeout will notice.

- **A malformed request body answered with a 500.** `request.json()` throws
  when the body is not JSON - truncated, wrong content, or absent - and an
  uncaught throw in a route handler is a bare 500. Eighty-seven routes
  answered that way, and twenty more let a broad handler `catch` turn it into
  their own "Internal server error" or "Failed to create page". The fault is
  the caller's, so the answer is a 400; and this platform ships an OpenAPI
  document and API keys, so its callers are not only its own forms. Filing a
  bad request as a server error also puts it in front of the health alerting.
  Eleven routes had already worked this out and hand-rolled the same
  `let body: unknown; try { … } catch { return 400 }` block, in four
  different wordings. That block is now `readJsonBody`, in
  `@/core/sdk/server`, and all a hundred and eighteen call sites use it:

      const body = await readJsonBody(request);
      if (body instanceof NextResponse) return body;

  A route that treats the body as optional keeps `.json().catch(() => ({}))`,
  which is a different contract and stays legal - a POST with nothing to send
  must not become a 400. A gate holds the rest: no bare `request.json()`, the
  sentinel checked at every call, modules reaching the helper through the SDK
  rather than core internals, and one wording for the error. CORE_API_VERSION
  is 1.5.0 and the twenty-seven modules involved are bumped.

- **Every page 500'd for the first request after each cache expiry.** The
  translation service accumulates the nested message tree into
  `Object.create(null)` records - a deliberate second lock against a dotted
  key reaching the prototype chain. next-intl then hands that tree to a
  client provider, and React will not serialize an object with a null
  prototype from a Server Component to a Client one: "Only plain objects,
  and a few built-ins, can be passed to Client Components". A cache hit
  returned `JSON.parse` of the cached string, which is plain, so the same
  URL was a 200 while the two-minute cache was warm and a 500 on the first
  request after every expiry, install, enable or admin edit. On the demo
  `/en` was warm and `/tr` was serving a 500. The cold path now returns the
  round-tripped copy it already builds for the cache, so both paths hand
  back the same shape, and the accumulators keep the prototype they never
  had. Tests cover both paths and hold the pollution guard in place.

- **The production build broke, and only the production build knew.** The
  auth challenge landed with the three auth forms importing one constant,
  `CHALLENGE_FIELD`, from `auth-challenge.ts`. Those forms are client
  components, so everything that file reaches is compiled for the browser -
  and its other export dynamically imports the hook bus, which reaches the
  database, the logger and the storage layer. `npm run build` failed with
  three errors and seven import traces: `next/headers` in a browser bundle,
  and no `async_hooks` or `fs/promises` to resolve. Typecheck, lint and the
  full test suite were green throughout, because none of them builds a
  bundle. The client-safe names - the field, the action union, the wire
  parser - now live in `auth-challenge-shared.ts`, which imports nothing;
  `auth-challenge.ts` keeps the server half. A new gate walks the same graph
  the bundler does, from every `"use client"` file, through static and
  dynamic imports alike, and fails on the same edge in a second instead of
  three minutes into a build. It models barrels the way a bundler does, so
  `@/core/sdk` stays importable from client code - `formatDate` pulls in
  `utils.ts` and nothing else - and it holds that barrel to being nothing
  but re-exports, since one declaration of its own would drag the hook bus
  into all eleven module client components that import it.

- **The bot check that was switched on and did nothing.** The
  cloudflare-turnstile module shipped an admin page with `enableOnLogin` and
  `enableOnRegister`, saved both to the settings table, and stopped there. No
  widget was rendered anywhere in the app, and `verifyTurnstileToken` had no
  callers at all. An administrator who turned bot protection on got a page
  that said it was on and a site exactly as open as before, which is worse
  than no module: a security control that reports success without acting.
  It could not have worked either, because core had nowhere to put it - a
  module cannot add a field to the login form or refuse a request that core
  owns. Core now provides both halves and still knows nothing about CAPTCHAs:
  `auth.form.challenge`, a slot inside the login, register and
  forgot-password forms whose contributions get an `onField` callback and
  report whatever they need sent; and `auth.challenge`, a filter run before
  credentials are checked or an account is created, carrying those fields,
  the action and the caller's IP. With no module installed the slot renders
  nothing, the filter has no listeners, and the three forms behave exactly as
  they did. A listener that throws is treated as passing, so a broken module
  cannot lock everyone out of the site. Turnstile now draws its widget in
  that slot and refuses in that filter, an unconfigured install still lets
  everything through, a missing token is refused as firmly as a bad one, and
  the module ships the strings for the codes it invents rather than core
  carrying words for a thing it does not have.

- **Bulk install left every module it installed with no strings.** The single
  install seeded translations into the Translation table, which is where the
  app reads them from. Bulk install called a local `mergeTranslations` that
  wrote JSON files into a `messages/` directory at the project root. That
  directory does not exist: core keeps its own catalogue in `messages-core/`
  and everything else in the table. Every write threw ENOENT straight into a
  `catch { /* skip */ }`, so a module installed through the bulk path
  rendered raw keys like `store.adm_products` on every one of its pages.
  Nothing failed and nothing logged, and installing the same module one at a
  time worked. Bulk install now calls the same seeder, and a gate holds the
  two paths to the same three things: one seeder, no writes to a directory
  that is not there, one manifest schema.
- **Modules declared five languages the site could never show.** Seventy-seven
  of the seventy-eight shipped en, tr, de, es, fr, ru and pt in their
  manifests. Core ships two, and `seed-translations` filters every row
  through the i18n config before writing, so twelve thousand seven hundred
  and twenty keys had never reached a page and never could. They rotted too,
  because nothing checked them: thirty-five modules were missing keys in
  those locales that en and tr had, the store a hundred and forty of them.
  They are gone, and a gate now keeps a manifest from declaring a locale core
  does not ship, or omitting one it does. Adding a language is one decision
  in one place again.
- **What the code scanner found.** Forty-five CodeQL alerts, three of them
  genuinely wrong code. `/^[a-zA-Z][a-zA-Z0-9.-_]*$/` in the module
  scaffolding CLI: inside a character class `.-_` is a range from `.` to `_`,
  so a hook or slot name could contain `/`, `\`, `:`, `<`, `>`, `@`, `[` or
  `]`. Five check-then-read pairs across the install, update and upload
  routes, where `fs.access` asked whether a manifest existed and `fs.readFile`
  then read it, leaving a gap the file could change in; one read answers both
  questions. The thirty path-injection alerts were unreachable - every route
  checks its id against `/^[a-z0-9-]+$/` first - but the check and the
  `path.join` sat two hundred lines apart, so `resolveWithin()` now puts the
  containment where the path is built rather than where the input arrives.
  The two objects built from request keys accumulate into `Object.create(null)`
  now, so a key the check ever misses has no prototype to reach.

- **Sixty-one buttons and links had no name at all.** Each rendered nothing
  but a Lucide icon, and an icon is an `<svg>` with no text in it, so a screen
  reader read every one of them as "button" and a voice-control user had
  nothing to say to click one: the delete and edit buttons on every admin
  list, the back arrow at the top of a dozen detail pages, every pagination
  arrow, the copy buttons on the API key, media, gift code and referral
  screens, the close button in four dialogs, the reply-send button on the
  profile messages tab. All sixty-one now carry an `aria-label` taken from
  core's `common` namespace, which already held delete, edit, back, close,
  remove, previous and next for exactly this vocabulary; `copy`, `send`,
  `previousPage` and `nextPage` joined it. The gate decides "renders no text"
  the way a browser would, by looking at what survives once the child tags
  are stripped, so `{count}` counts as a name and `{copied ? <Check/> :
  <Copy/>}` does not. It is a companion to the input gate rather than a
  replacement: one covers what you type into, the other what you press.
- **Fourteen more admin strings were still written in English.** The module
  update badge announced "3 module updates available" and pluralised itself
  in JSX, the developer page titled three cards in English, the system
  metrics strip read "Total: 412 requests", the user delete dialog said "Type
  <name> to confirm", and the custom-form submissions and store coupon
  screens carried a page counter, a user id and a minimum-purchase label.
  Every one of them sat next to an interpolation or inside a template
  literal, which is exactly what the admin copy gate could not see: it
  matched `>Text<` and `title="Text"` and nothing else. It now also reads a
  text run that stops at an interpolation, one that starts after it, and the
  same attributes written as a template literal.

- **The modules' admin screens were in English, and dates were formatted in
  Turkish for everyone.** Two defects in the same corner. The admin
  translation gate covered core's `(admin)` tree only, so every module's own
  `pages/admin` sat outside it: the blog's article status labels and category
  dialog, the custom form builder's field types and wizard buttons, the
  help-center's icon and image pickers, the SEO settings' OpenGraph fields
  and their hints, the store's coupon and variable-type screens, the trophy
  editor's placeholders, the ticket staff badge, the CSV importer's column
  hint. The gate now walks `pages/admin` in every module, with a documented
  allowance for the format tokens (`{name}`, `YYYY-MM-DD`) that are examples
  rather than prose.
- **Twenty-two admin screens formatted their timestamps as `tr-TR` outright**,
  so an English admin read Turkish dates on the cron page, the email queue,
  the audit log, the backup list, observability, moderation, warnings,
  broadcasts, IP blocks, API keys, revisions, activity log, analytics, the
  user list and detail, the module update list, the sessions tab and the
  activity feed widget, plus the punishments, staff, player-profile, trophy,
  ticket, store, referral, webhook-log, suggestion, custom-form and credit
  screens. Thirty-one more files hand-rolled `locale === "tr" ? "tr-TR" :
  locale` to avoid exactly that, and ten called the shared `formatDate()`
  without its locale argument, so its `en-US` default rendered English dates
  on the public blog and the store order screens no matter who was reading.
  The mapping is now `dateLocaleTag()` in `src/core/lib/utils.ts`, re-exported
  from the module SDK, and a gate keeps it the only copy: no BCP 47 tag
  written inline at a call site, no second mapping, `formatDate()` always
  given a locale, and modules reaching it through `@/core/sdk`. Currency
  formatting is deliberately left pinned to `en-US` - a price rendering the
  same way in every language is a currency decision, not a date one.

- **The modules' own visitor-facing screens were in English, and no gate
  watched them.** The public translation gate covered core's `(public)` tree
  and chrome, the admin gate covered `(admin)`, and everything a module
  renders to a visitor sat outside both. The whole of the public ticket page
  was English - the breadcrumb, the sidebar's created and updated rows, the
  staff badge, the reply box, the login prompt, the loading and error states.
  So were the referral tab on a user's profile, the custom page's 404, the
  announcement banner's dismiss button, the store's payment-goal banner and
  the empty states of four page-builder blocks. Most of the keys already
  existed in every locale of the module's own manifest: the translations had
  been written and the components had simply never been wired to them. The
  gate now walks every module's `pages/public`, `blocks`, `slots`, `widgets`
  and `components`.
- **A hundred and fifty form controls had no name a screen reader could
  read.** Each sat under a `<label>` or `<Label>` carrying no `htmlFor` and
  wrapping nothing, next to an input carrying no `id` and no `aria-label`.
  The text was on the screen and the association was not, so the whole of the
  SEO settings, the site settings, the role editor, the warning form, the
  setup wizard, the audit log filters, the IP block form, the store's coupon,
  category and gift-code screens, the cart's player-name field and the
  product page's per-variable inputs announced as "edit text, blank". Twelve
  labels in the same codebase were written correctly, so the rule was known
  and simply not applied. Every control is named now, and a gate walks the
  app, the shared components and all seventy-eight modules to keep it that
  way. The fix uses `aria-label` rather than `htmlFor` and `id` because a
  third of these render inside a `.map()`, where a single id would be
  emitted once per row; `htmlFor` stays welcome anywhere else.
- **The admin spotlight removed its focus ring and put nothing back.** A
  keyboard user tabbing between the search field and its close button had no
  way to see where they were. It has a focus-visible ring and a name now, and
  the gate fails any `outline-none` without a replacement.
- **The two-factor module guarded four strings against keys that exist.**
  `t.has("currentPassword") ? t("currentPassword") : "Current password"` and
  three more like it carried untranslated English branches that every locale
  in the manifest already made unreachable.
- **Auth failures were answered in English, whatever language the page was
  in.** Every endpoint under `/api/v1/auth` replied with an English sentence
  and nothing else, and every screen wrote that sentence straight into the
  page. A Turkish visitor whose username was taken, whose reset link had
  expired, whose password turned up in a breach corpus, or who had simply
  tried once too often, read the whole thing in English on an otherwise
  Turkish page - and there was no machine-readable signal to translate from,
  so no screen could have done better. Each response now carries a stable
  `code` alongside the English string, which stays on the wire for API
  clients and logs; the catalogue carries `auth.err.<code>` in both locales;
  and `authErrorMessage` is what register, forgot password, reset password,
  verify email and the profile screen call. An unrecognised code falls back
  to the screen's own generic message rather than the server's English. A
  gate fails the build if an auth endpoint answers without a code, if a code
  has no message in every locale, if the locales disagree on the set, if a
  message is orphaned, or if a screen renders `data.error` again.
- **The sign-in tree was covered by no translation gate at all.** The public
  gate watched `(public)` and the chrome, the admin gate watched `(admin)`,
  and `(auth)` - the most-read pages on a fresh install - sat between them.
  That is how the register form kept `you@example.com` and `johndoe` as
  hardcoded placeholders while its sibling login page had translated its own
  years ago. Both are translated now and the gate covers the tree.
- **The most common OAuth error had no message to show.** The auth error page
  guarded `OAuthAccountNotLinked` with `t.has(...)` and fell back to an
  English sentence, because the key it guarded for was never added to the
  catalogue. Signing in with a provider whose email already belongs to an
  account is the single likeliest OAuth failure, so that fallback was not a
  rare path. The key exists in both locales now and the guard is gone.
- **The module enabled flag meant two different things.** Core documents one
  convention - `getModuleStates()` returns a row per module that has a
  `ModuleConfig`, an empty map when the database is unreachable, and an absent
  entry means enabled, because failing open beats 404ing every module the
  moment the database blinks. The proxy and `isModuleEnabled` follow it.
  Twenty-two UI call sites did not: they hand-rolled `states[id] === true`,
  which reads an absent entry as disabled. The two agree while every module
  has its row and diverge exactly when it matters, so a database blip left the
  proxy serving `/blog` while the navbar, footer, homepage, mobile nav, admin
  analytics, login page OAuth buttons and every slot quietly dropped their
  module content. The comparison now lives in one helper, `isEnabledIn`, and a
  gate fails the build if anyone writes it out by hand again.
- **Three registries were read without consulting the flag at all.** Admin
  search offered settings cards and admin pages belonging to disabled modules,
  every one of which the proxy then answered with a 404 - a search result that
  could only dead-end. The notification preferences page listed event types
  from disabled modules, so users were shown toggles for notifications that
  can never fire; saved preferences are untouched, and re-enabling the module
  brings the type and the choice straight back. The dashboard customizer
  offered widgets from disabled modules that render blank. A second gate now
  walks every consumer of a generated registry and requires it either to
  honour the flag or to be listed with the reason it must not - the GDPR
  export owes a user every row regardless, the Puck block config drives the
  public renderer as well as the editor, activity log titles must survive a
  module being turned off, and Auth.js assembles its providers at module load,
  before a database round-trip is possible.
- **The root layout queried module states on every page render.** It ran its
  own `moduleConfig.findMany` rather than the shared cache, so each render
  paid for an uncached round-trip that Redis was already holding, and a
  database blip threw the whole layout away instead of failing soft.
- **Disabling a module did not stop its scheduled jobs.** Cron jobs are
  registered once, at bootstrap, and the scheduler has no reset path.
  Toggling a module off updates `ModuleConfig`, drops the caches and calls
  `resetHooks()` so the hook registry rebuilds from the new state, and it
  deliberately schedules no rebuild, because disabling is meant to be instant.
  Nothing told the scheduler. Every other subsystem honours the flag - the
  proxy refuses the module's routes, `bootstrapHooks` skips its listeners,
  search drops its provider, the sitemap leaves out its pages - and this was
  the one that did not, so a disabled blog went on publishing scheduled
  articles, a disabled currency module went on calling an exchange rate API on
  a timer, and the admin panel showed nothing to say so. A tick now reads the
  module states once and skips a disabled module's jobs without claiming their
  slot, so the toggle takes effect immediately rather than at the next
  restart, and running one by hand from the cron page is refused with the
  reason. Core's own jobs are never gated, and an unreadable config leaves
  every job eligible, matching what `getModuleStates` promises everywhere
  else.
- **Uninstall left a module's cron bookkeeping behind.** The scheduler keys a
  `CronRun` row per job as `<moduleId>:<jobId>`; uninstall cleared the config
  row and the translations but never those, and a running demo was carrying
  rows for three modules that had not been installed in some time. Inert while
  the module is gone, but a reinstall inherits the stale `lastRunAt` and a
  monthly job then sits out the rest of an interval that elapsed while it did
  not exist. Module-owned tables are still preserved for reinstall: that is
  the admin's data, and a scheduling timestamp is not.

- **The documented external cron trigger did not drive the scheduler.**
  `docs/DEPLOYMENT.md` tells an operator to point a system cron at
  `POST /api/v1/admin/cron` with an API key, and said the endpoint "runs
  maintenance tasks registered by installed modules (expiring coupons, closing
  stale tickets, etc.)". It did nothing of the kind. It called
  `runScheduledTasks()`, a task list living beside the scheduler that knew
  about one core cleanup and nothing about a registered job, core's or a
  module's. Only the in-process ticker ever ran those. So an operator who
  followed the deployment guide, on the sort of host where an in-process
  ticker is exactly what you cannot rely on, ran none of the jobs they had
  been told they were running. The endpoint now performs one real tick: every
  registered job whose interval has elapsed, through the same `CronRun` claim
  the ticker uses, so the two triggers together can never run a job twice.
- **Expired password reset and verification tokens were never deleted.** The
  prune existed, and it was the one thing that stray task list held, so it ran
  only when someone posted to that endpoint by hand. The admin panel never
  does: its cron page runs jobs one at a time through
  `/admin/cron/[key]/run`. Email verification and password reset both write a
  `VerificationToken`, and both leave the row behind whenever the person never
  finishes, so the table had been growing since it existed. The prune moved
  into the daily retention sweep, which is scheduled.
- **Core pruned a table it does not own.** Retention deleted `WebhookLog` rows
  behind an `in prisma` guard, because the model belongs to the `webhook-logs`
  module - and that module has always run its own daily cron over the same
  table with the same thirty day window. Core was doing a module's work twice
  a day while naming a model it has no business knowing. Removed; the module
  keeps its own house.

- **Core's CSP was a fixed list no module could reach.** It named two payment
  gateway origins, `https://api.sandbox.paypal.com` and `https://js.stripe.com`,
  which is core knowing about modules, and it was wrong twice over: both
  gateways are server to server and load neither, and the PayPal entry was not
  a frame host at all but the REST API's, spelled differently from the one the
  module actually calls. Meanwhile every origin a module did need was blocked.
  The Discord widget's iframe points at `https://discord.com` and rendered an
  empty box; the Google Analytics tag pulls gtag from
  `https://www.googletagmanager.com` and loaded nothing, so last release's fix
  to that module got it as far as a request the browser then refused. A blocked
  subresource raises no server error and no client error, only a console line
  nobody reads, so both had shipped that way from the start. A module now
  declares its origins under `csp` in the manifest, the registry collects them
  from the installed set, and every fetch directive is composed from core's own
  sources plus those. Only fetch directives, and only concrete https origins: a
  keyword or a bare scheme is refused by the schema, so no module can undo the
  policy, and `default-src`, `frame-ancestors`, `form-action`, `base-uri` and
  `object-src` stay literal with nothing to add to. `validate-module` fails a
  module that loads an origin it did not declare.
- **Two Swagger UIs, and the reachable one was blank.** `/api/docs` served a
  second copy as raw HTML pulling its bundle and stylesheet from unpkg on a
  floating `@5` tag. No third-party script origin is allowed, so the page had
  only ever rendered an empty div, and the spec it fetches answers 401 to
  anyone but an admin anyway. `/admin/api-docs` does the same job with the
  bundle shipped in the app, behind the admin session, under its own policy.
  The dead route is gone and `docs/API.md`, which had been pointing readers at
  it, now names the one that works.

- **The schema indexed the wrong columns.** Two rules, both of which the
  schema already stated in one place and broke in forty others. `IpBlock`
  carries the comment "No `@@index([ip])` - `@unique` already creates a B-tree
  on `ip`", and it was the only model that held to it: thirty-four other
  indexes duplicated a unique constraint they can never beat, each one a second
  B-tree maintained on every insert, update and delete for no read it could
  answer better. The mirror of that was twelve foreign keys with no index at
  all. Postgres does not index a foreign key for you, and a referential action
  has to find the rows that reference the row going away: deleting one user
  meant a sequential scan of `Account`, `ForumTopicLike`, `ForumPostLike`,
  `StaffMember`, `TicketMessage`, `GiftCode` and both theme tables, and
  deleting a product meant `OrderItem`, `CartItem` and `Subscription`.
  Confirmed on the demo, where `EXPLAIN` on `Account` by `userId` planned a Seq
  Scan. `VoteLog` gained a composite that answers the vote cooldown read whole,
  ordering included, instead of only its `userId`. A gate now holds both rules
  over every schema, core and module alike. Note that an existing install picks
  up the new indexes on its next start, since they are additive, but keeps the
  redundant ones until a `db push` reconciles the database.

- **Two module settings that nothing could ever read.**
  `/api/v1/public-settings` serves an allow-list of core's own keys, and its
  comment says a module's public values belong in the module's own API. Two
  modules read from it anyway, for keys the allow-list has never carried, and
  an absent key on a JSON object is not an error - so both failed in silence.
  Google Analytics looked up `google_analytics_id` there: an admin could type a
  measurement ID in, see it saved, and no page was ever tracked. Its other path
  read `NEXT_PUBLIC_GA_ID`, which is frozen into the bundle at build time and
  so unreachable on an install running the prebuilt image. The module now
  serves `/api/v1/google-analytics/config` itself, honours the on/off setting,
  and the setting is a select rather than a box asking the admin to type the
  word "true". The measurement ID also stopped being interpolated raw into the
  inline gtag script. The store's live purchase toast read
  `live_purchase_toast`, a key nothing writes and no admin screen offers, and
  it polled an authenticated orders endpoint that returns the viewer's own
  orders - or, for an admin, everyone's, names and all. It was registered as a
  layout component on every page and had never once fired. It is removed;
  real purchase social proof needs a public, anonymised feed and a deliberate
  decision to publish it, not this. A gate now fails any module that reads
  core's public settings, and any core reader of a key the allow-list omits.

- **Public search took any query, at any rate.** `/api/v1/search` is the one
  anonymous endpoint that fans out: it hands the caller's string to every
  enabled module's search provider, and each provider spends a
  `plainto_tsquery` parse or an ILIKE scan on it. Nothing bounded the string
  and nothing limited the rate, so one request could be turned into as many
  expensive queries as the install has providers, as often as the caller
  liked. The query is now capped at `SEARCH_QUERY_MAX_LENGTH` before any
  provider sees it - rejected rather than truncated, since results for a query
  the caller did not ask for are a wrong answer dressed as a real one - and the
  endpoint is rate limited like the rest of the public API. The search page's
  input carries the same constant, so the UI cannot produce a request the
  server will refuse.

- **No payment could ever settle.** The proxy runs a same-origin CSRF check
  over every `/api/` request and exempts three literal prefixes: `/api/auth/`,
  `/api/v1/webhook/` and `/api/webhook/`. Those are core's own routes. A
  payment gateway is a module, and it serves its callback wherever its manifest
  says - `/api/v1/mollie/webhook`, `/api/v1/paytr/callback`, and Stripe at
  `/api/v1/webhooks/stripe`, plural, where the exemption reads singular. A
  provider posts server to server, so it sends no `Origin` and no `Referer`,
  which is exactly what `checkCsrf` rejects: all twelve gateways answered 403
  `csrf_rejected` before their handler ran, and an order stayed pending however
  many times the provider retried. Core cannot know a module's callback paths,
  so the module now declares them: `providerCallback: true` on an `api[]` entry
  puts that route into the generated `providerCallbackRoutes`, and the proxy
  consults it alongside the three literals. Skipping the origin check is only
  safe for a handler that authenticates the request itself, so
  `validate-module` fails a `providerCallback` entry whose handler verifies no
  signature, and a unit gate holds the reverse: a callback-shaped endpoint that
  does verify one must declare the flag.

- **A hundred and thirteen unreachable translation fallbacks, and eleven
  strings with no key at all.** Fifteen admin screens wrote
  `t.has(key) ? t(key) : "English"` for keys that were in the catalogue the
  whole time, so the English branch could never run and only made the code look
  as though a translation might be missing. `t.has` still guards the dynamic
  keys, where a module may or may not have contributed one. Separately, the
  admin copy gate only read `.tsx`, and the modules screen keeps its logic in a
  `.ts` hook: every toast and confirmation it raised was written in English
  there. Both classes are gated now.
- **Bulk install says what it pulled in.** The API reports the dependencies it
  added on the operator's behalf, and the screen names them instead of quietly
  installing more modules than were ticked.

- **Uninstalling a module could brick the next build.** Disabling one refuses
  while an enabled module depends on it. Uninstall is the same operation with
  the files deleted too, and it had no such check, so removing `store` while
  `leaderboard` was installed took the `Order` model out of the merged Prisma
  schema while `leaderboard/api/route.ts` went on calling `prisma.order`. The
  rebuild uninstall schedules then failed and the site sat on its last good
  build, with the module it would need to reinstall being the one whose files
  were gone. Fifteen of the shipped modules depend on `store`, so this was one
  click away on any real install. Uninstall now refuses and names the
  dependents; every module on disk counts, enabled or not, because the schema
  merge and the registry read the filesystem rather than `ModuleConfig`.
- **Bulk install skipped the dependency resolution the wizard has always
  done.** The first-run wizard expands a module selection through
  `resolveInstallPlan` on the client, to show what a tick pulls in, and again
  on the server so the answer is not the client's to decide. The admin
  marketplace's bulk install did neither, so ticking Leaderboard without
  ticking Store installed Leaderboard alone and the rebuild failed the same
  way. It plans first now, installs dependencies before dependents, reports
  what it added on the operator's behalf, and takes each module's zip name from
  the catalog rather than from the caller.
- **The update route never took the install lock.** Install, bulk install and
  uninstall all serialize on it, and the uninstall route's own comment
  described it as the lock "install/update use". Update staged the replacement
  files and swapped them into the module directory with nothing stopping a
  concurrent uninstall from running `fs.rm` over the same path, which can leave
  a module directory with no `module.json` - registry generation fails on that,
  and the next build fails with it.

- **Controls that only a mouse could reach.** The store's breadcrumb hung its
  click handler on a `<span>`, so a visitor navigating by keyboard could not go
  back up a category, and the setup wizard hung one on the `<div>` around each
  theme card - making the theme step every install goes through impossible
  without a pointer. Both are buttons now. Three dialogs closed only by
  clicking their backdrop, which is not something a keyboard can do: the media
  detail panel, the dashboard customizer and the footer language selector all
  close on Escape, and the selector tells assistive tech that it opens a list.
  The dashboard customizer had also put `role="dialog"` on the backdrop that
  dismisses it rather than on the panel. Guards cover all of it.

- **Three of the nine documented slots rendered nothing.** `CANONICAL_SLOTS`
  advertises `layout.beforeMain`, `layout.afterMain` and `head.extra` as the
  generic injection points - the way a module adds a banner, a modal or a head
  tag without touching core React - and core rendered none of them. A module
  targeting any of the three got silence, with nothing to say why. All three
  are now rendered from the root layout; `head.extra` goes through a new
  `<ServerSlot>` because it sits above the module provider that `<Slot>` reads
  its enabled-module states from. `layout.overlay` had the opposite problem -
  core renders it and a shipped module targets it, but it was missing from the
  list - so it is declared now. A gate fails either kind of drift.
- **The popups module drew two popups.** It contributed the same popup twice:
  `PopupModal` through `layoutComponents`, and `PopupRenderer` through
  `slotContents` on `layout.overlay`. Both render from the root layout, so
  installing the module stacked two modals over every public page, and since
  one stored dismissal as a session-wide flag and the other as a per-popup key,
  dismissing one did not dismiss the other. One renderer survives.
- **A popup's link and image are checked before they reach the DOM.** The
  surviving renderer was the one that did not validate them, so a `javascript:`
  URL in a popup link ran with the viewer's session on every public page. The
  popups permission is not full site admin, so this was a real privilege step
  up. Only http(s) gets through now, and the popup closes on Escape rather than
  only on a backdrop click.

### Removed
- **Seven files under `src/core` that nothing could reach.** Two duplicated
  something core already had, one was left behind by the rewrite that replaced
  it, and one was a back-compatibility shim for an API with no callers - all
  deleted. Two more were worse than dead: `Breadcrumb` and
  `ActivityFeedSection` both described themselves as pieces a module or theme
  could render, and the SDK boundary made that impossible, so the store went
  and hand-rolled its own breadcrumb - the copy whose crumbs a keyboard could
  not reach. Both are exported through the SDK now. The seventh was core's
  Turnstile widget, unreachable and reading a `NEXT_PUBLIC_` site key that the
  prebuilt image freezes at build time, so it could not have worked on a real
  install either. A gate fails any new unreachable file under `src/core`.

- **The generated `slot-registry.tsx`, which nothing imported.** It was written
  on every build and read by no component, which made the canonical `slots:`
  manifest field a no-op and made the file actively misleading to read - it
  listed contributions that were never going to render. `slots:` now feeds the
  same registry `<Slot>` reads. The generator's aliases from
  `navbarComponents`, `layoutComponents`, `homepageSections` and `profileTabs`
  into slot names went with it: each of those fields already has its own render
  path, and contributing them twice is exactly what produced the double popup.

### Changed
- Two existing gates skipped any directory named `modules`, which was meant to
  exempt `src/modules` (installed-module state, regenerated on install) but also
  quietly exempted `src/app/[locale]/(admin)/admin/modules`, core's own screen
  for managing them. Both now skip by full path. Nothing was hiding there, but
  the next thing would have been.
- **The admin panel is readable in Turkish.** Ninety strings across twenty-three
  admin screens were written in English directly in the JSX, so an operator who
  had set the panel to Turkish still read "Refresh", "Save changes", "No results
  found" and the rest in English. Twenty-four of them already had a key sitting
  unused in the catalogue - the spotlight's four hint labels, the sidebar search
  placeholder, the appearance heading - meaning the translation had been written
  and then never wired up. All ninety now read from the `admin` namespace, with
  about sixty new keys added in both locales, and a gate fails any new hardcoded
  English JSX text or `placeholder`/`title`/`aria-label` literal under the admin
  tree so the panel cannot drift back one screen at a time.

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
- **A public page no longer ships a module's admin copy either.** Dropping the
  core `admin` namespace left the operator wording modules ship, because a
  module owns one namespace and puts both its storefront and its admin screen
  in it - the whole `store` catalogue, `adm_products` and all, went to every
  visitor. `publicMessages()` (was `withoutAdminNamespaces`) now also drops the
  `setup` namespace, which only the first-install wizard renders, and every key
  a module prefixes `adm_`. The public catalogue went from 36KB to 25KB. The
  setup wizard gets its own layout that re-provides the full catalogue, the way
  the admin tree already did, and `validate-module` fails a module that renders
  an `adm_` key outside `pages/admin/` so the prefix keeps meaning what core
  assumes it means.
- **The skip-to-content link is translated.** It was the one string in the
  locale layout still written in English inline, so a Turkish visitor tabbing
  into the page got "Skip to content".
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

### Security
- **Credits could be spent twice.** Checkout read the balance, compared it to
  the order total, and decremented inside a transaction. Two checkouts
  submitted together both read the same balance, both passed the comparison,
  and both got their goods while the balance went negative. A transaction does
  not close that: under read committed both decrements simply apply. The paid
  wheel spin had the same shape. Both debit conditionally now
  (`updateMany` with `creditBalance: { gte: ... }`) and answer the losing call
  the way the balance check already did.
- **A single-use coupon could be used twice.** Same read-then-write, and
  `usageLimit: 1` is the common case, not the rare one: the welcome coupon and
  the wheel's coupon prize are both issued that way. Checkout and the orders
  route claim the use conditionally now.
- **A one-seat licence could be activated on two machines.** The unique index
  covers two launches of the same machine; two different machines activating
  together both saw a free seat. The count is settled after the insert now,
  oldest rows keeping their seats, so exactly `maxActivations` machines win and
  the rest are rolled back.
- **A vote reward could be claimed twice.** The cooldown check and the reward
  sat in one transaction with a comment saying that prevented the race. It does
  not: two claims both read no recent vote log and both awarded credits. The
  invariant is "no row newer than the cutoff", which no conditional write can
  express, so the transaction is serializable now and Postgres keeps exactly
  one. The abort is answered as a retry, not a 500.
- **A chest item could be redeemed twice.** The route read the row, saw
  `isRedeemed: false`, ran the RCON delivery, and marked the row redeemed
  afterwards. Two requests that arrived together both passed the read and both
  delivered, so the player received the item as many times as they could
  overlap the call. It claims the row first now, with the same conditional
  `updateMany` the gift-code route has always used, and gifting is conditional
  too so a gift racing a redeem cannot both win. A test fails the file if the
  claim moves back behind the delivery.
- **Five endpoints answered "was this guess right?" without a ceiling.** The
  profile route's password-change branch compared the current password with
  `bcrypt.compare` on every request, unlimited: an online password oracle
  against a stolen session, and a bcrypt round at cost 12 of CPU per request
  besides. The account-deletion route beside it has always had that ceiling.
  The two-factor module's disable, verify and regenerate-codes routes took
  unlimited password and TOTP attempts against a secret that never changes.
  All five are capped per user now.
- **A gift code could be walked.** Redeeming took unlimited attempts and the
  reply says whether a code exists, over a code space of `randomBytes(4)` -
  32 bits, and each hit is worth credits. Redemption is capped at 10 per 15
  minutes and new codes carry 64 bits.
- **`rateLimitStrict` is what a module reaches for now.** The SDK exposed only
  `rateLimitForRole`, which scales its budget by the caller's role and treats
  a multiplier of 0 as unlimited. That is right for throughput and wrong for a
  brute-force ceiling, which has to hold for every role. `validate-module`
  fails a handler that compares a secret without one, and the same rule runs
  over core under `npm test`.

### Fixed
- **The mobile bottom bar covered the end of every page.** It is
  `fixed bottom-0` and `sm:hidden`, and nothing left room for it, so below the
  sm breakpoint the last 3.5rem of a page was simply unreachable: a footer, the
  last row of a list, the submit button under a form. The page clears it now,
  plus the home indicator on top of that. The `safe-area-bottom` class the nav
  had carried all along was never defined anywhere, which is why the bar sat
  under the home indicator; it is a real rule now.
- **Three tables were cut off on a phone instead of scrolling.** The support
  ticket list is six columns wide inside a wrapper with `overflow-hidden`,
  which clips rather than scrolls, and the ticket and punishment admin tables
  were the same. Core's tables have always used `overflow-x-auto`. A test walks
  every table in the tree and fails one with no scrolling ancestor. The ticket
  list also drew its row dividers in a hardcoded light grey, which on a dark
  theme was a set of near-white lines; it uses the theme token now, and no
  module may hardcode one again.
- **The ticket admin dashboard put four stat cards in one row on a phone.**
  `grid-cols-4` with no responsive prefix. Two rows of two below `lg` now.
- **Deleting an account could split a conversation in two.** The lookup for an
  existing 1:1 thread asked only that every participant be one of the two
  people, which is vacuously true for a thread with no participants and true
  for one whose only participant is the sender. `softDeleteUser` deletes the
  leaving user's participant rows, so those orphans are the normal result of
  someone exercising the right to be forgotten. `findFirst` has no order to
  fall back on, so it could return an orphan, and the caller then started a
  second conversation with someone it already had one with. The clause now
  requires both people to be present as well.
- **Four write endpoints had no budget.** Starting a conversation and replying
  to one both write into somebody else's inbox with the recipient named by the
  sender; checkout and buying credits each open a session at the payment
  gateway whether or not anyone pays. All four are capped per user through
  `rateLimitForRole`, which is the right tool here: this is throughput, so an
  operator's role multipliers still apply.
- **Blog comments never loaded and could not be posted.** `CommentSection`
  fetched `/api/v1/blog/${id}/comments`, a path the manifest never declared.
  The dispatcher answers only declared paths, so the read 404'd and the
  component's `.then` swallowed it into an empty list, and posting a comment
  404'd with the error handler ignoring it: every article showed
  "Comments (0)" and a form that did nothing. It now calls the route that
  exists, `/blog/comments?articleId=`, sends the article id in the POST body,
  reads the array and the comment object the route actually returns, and tells
  the author when a comment is held for approval instead of showing it as
  live. Its copy is translated too, and dates follow the visitor's locale
  rather than always `tr-TR`. `validate-module` gained a check that fails a
  module whose components fetch a path it does not route, with the same rule
  mirrored under `npm test`.
- **An article's whole comment history came back in one response.** The list is
  anonymous-readable and grows with every visitor who posts. It is capped at 50
  now, `?limit=` up to 200.
- **A conversation returned every message it had ever held.** Each one is up to
  10000 characters and a thread grows without limit, so both the query and the
  response were unbounded on every open. The newest 200 come back, still oldest
  first.
- **A failing root layout showed Next's built-in error screen.**
  `[locale]/layout.tsx` is this app's root layout, and an error boundary never
  catches its own segment's layout, so a failure there (the database
  unreachable while it reads settings and messages) had no page of ours to land
  on. `src/app/global-error.tsx` now supplies one, self-contained the way the
  root not-found page is: its own document, inline styles, no locale to resolve.
- **The root error page printed the error's message to the visitor.** Next
  redacts a server error's message in production, but an error thrown in a
  client component keeps its real text, which is written for whoever reads the
  logs. It is now shown only in development, matching the locale error page.
- **`t("key") || "fallback"` never reached its fallback.** next-intl returns
  the key path for a missing message, and a key path is a non-empty string, so
  the error boundary would have rendered "common.error_title" as its heading
  rather than the English behind the `||`. Nine of them across the error
  boundary and the custom-forms admin page are gone, the boundary guards with
  `t.has()`, and a test fails the pattern anywhere in the repo.
- **The Redis rate limiter's expiry test was flaky.** It opened a 20ms window
  and slept 30ms; a loaded machine took longer than 20ms to get between the two
  awaits inside the window, so the second request started a fresh window and
  the test read a limiter that never blocks. The fake server's clock is now
  driven by the test rather than by wall time.
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
- **A dot in the path skipped every gate the platform has.** `src/proxy.ts`
  holds the CSRF check, the IP blocklist, maintenance mode, the setup wizard
  gate, the module-enabled check and the demo write gate, and two separate
  places decided a request was a static file because its path contained a dot:
  the `config.matcher` that decides whether the proxy runs at all, and
  `isStaticAsset()`. An API id is allowed to contain a dot, and the store
  resolves a product with `Number(id)`, so `DELETE /api/v1/store/products/1.`
  reached the same row as `products/1` from outside all of it - the plain path
  answered 403 `csrf_rejected`, the dotted one reached the handler and
  answered 401. Every `/api` path now goes through the proxy, and
  `isStaticAsset()` never calls one static.
- **The Redis rate limiter did not count a burst.** It read the counter, added
  one in Node and wrote it back, which is two round trips: requests that
  overlap between them all read the same number and all write the same number
  back. Replaying the old code against a server that yields per command, ten
  simultaneous requests against a limit of five were all allowed and the
  server recorded one hit. A burst is the only traffic a rate limiter exists
  to stop. Counting is now a single server-side script (`INCR`, `PEXPIRE` on
  the first hit of the window, `PTTL` for the reset time), so the same ten
  requests are counted ten times and five are refused. Keys moved from `rl:`
  to `rlc:` because the old ones hold JSON that `INCR` cannot touch.
- **An alert webhook could be pointed at the loopback in IPv6 spelling.** The
  generic channel refuses a URL that only resolves inside the network, and it
  checked IPv6 literals against `::1`, `::`, `fc00::/7` and `fe80::/10`. None
  of those match `[::ffff:127.0.0.1]`, which reaches the loopback exactly as
  `127.0.0.1` does and which the URL parser hands back in its normalized form,
  `::ffff:7f00:1`. Both spellings are unpacked to their IPv4 address now and
  run through the IPv4 rules, so `[::ffff:169.254.169.254]` is refused with
  the plain form.

### Fixed
- **Pages showed the translation key where the text belongs.** next-intl does
  not throw on a missing message: it logs and renders the key path, so the
  store's public VIP page read `store.vip_title` as its heading, with
  `store.vip_buy` on every button. The same held for both store profile tabs,
  the live purchase toast, the bulk-discount, creator-code, custom-forms and
  servers admin screens - 50 renders of keys no manifest declared. All of them
  are declared now in English and Turkish. A few of these read
  `t("key") || "fallback"`, which never fires: `t()` returns the key path, not
  a falsy value. The supported form is `t.has(key) ? t(key) : "fallback"`, and
  the ones already written that way were left alone.
- **`validate-module` now checks that a rendered key is declared.** It fails a
  module for any unguarded `t("literal")` whose key is missing from the
  module's own catalogue in a locale core ships, for each of the locales in
  `messages-core/`. Keys core owns still resolve, since the runtime catalogue
  is core merged with the enabled modules, and a `t.has()` guard is left
  alone. A unit test applies the same rule so `npm test` catches it too.
  Module versions: store 2.0.4, custom-forms 1.0.1, servers 1.1.1.
- **A setup test failed by machine load rather than by code.** The three
  install-planning cases run vitest's 5s default while the route hashes the
  admin password with bcrypt at cost 12, the one thing in that file which is
  not mocked. With the rest of the suite running in parallel they timed out,
  and a case that times out mid-install leaves its recorded calls for the next
  one to trip over, so a third assertion failed for a reason of its own. The
  file states the budget the work actually needs.
- **Icon-only controls announced nothing.** A `<button>` or `<Link>` whose
  whole body is an icon reaches a screen reader as "button", with nothing to
  say what it does. The auth pages' home link, the breadcrumb's home crumb,
  the store's gallery arrows and quantity stepper, the cart's two "remove this
  code" buttons, the store search's clear button, the slider arrows, the
  announcement banner's dismiss, the popup's close, the media dialog's close,
  the admin search and spotlight closes and the product image chips all carry
  a translated `aria-label` now, and the icon inside each is
  `aria-hidden`. A test walks the app, the shared components and all 78
  modules and fails on a new one.
- **Two public search fields had no accessible name.** The store's product
  search and the punishments search carried a placeholder and nothing else, so
  a screen reader announced an unlabelled text box. Both take the placeholder
  text as their `aria-label`.
- **The homepage had no `h1`.** Its content is a stack of module sections and
  none of them is the page's own title, so the document outline started at
  `h2` and a screen reader landed on the page with nothing naming it. The site
  name is announced now without being drawn, since the design has no room for
  it. Module versions: announcements 1.0.1, popups 1.0.1, punishments 1.0.1,
  slider 1.0.2, store 2.0.5.
- **The public chrome still had English baked into it.** A Turkish visitor
  read "Under Maintenance" on the maintenance screen and "Activity Feed" on
  the activity page, and the activity page put the English title and
  description in its metadata as well, which is what a crawler indexes for
  both locales. The homepage activity section, the file upload control and
  the impersonation banner were English throughout, and the navigation
  landmarks a screen reader reads to tell one nav from another were labelled
  "Primary", "Mobile", "Social media" and "Community" in English on every
  locale. All of it now comes from `messages-core`, including a new
  `maintenance` namespace. A test walks the public tree and fails on a new
  English literal; brand names and a word the user has to type back verbatim
  are the deliberate exceptions. `app/error.tsx`, `app/not-found.tsx` and the
  two error boundaries stay in English on purpose, since they render with no
  provider to ask.
  Two labels the guard could not see went with them: the profile menu button
  glued the English word "menu" onto a translated one, and sonner names its
  own toast region "Notifications" on every locale unless it is told
  otherwise.

### Removed
- `seedCoreTranslations` from the translation service. Nothing called it, and
  it upserted with `update: { value }`, which would have overwritten an
  operator's own wording on every run. `scripts/seed-translations.ts` is the
  path that seeds core, and it does the two-pass write that leaves
  `isCustom` rows alone.

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
