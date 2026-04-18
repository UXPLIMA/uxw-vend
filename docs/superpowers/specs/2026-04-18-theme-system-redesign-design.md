# Theme System Redesign — checkout-style Schema-Driven Customization

## Problem

The current theme system is hardcoded at the wrong layer. Themes are TypeScript configs that expose a fixed set of 13 color tokens, three font slots, one radius, and a raw CSS blob. Everything else — copy, imagery, toggles, layout variants — lives either in modules or in the hand-written React components of the theme. An admin who buys a premium theme cannot change the hero headline, swap the logo, hide a section, or tweak typography without editing TypeScript.

Concrete pain:
- The `ThemeColors` interface pins 13 tokens. Adding a new token requires type + provider + registry changes — three files minimum — so themes don't evolve.
- `theme.config.ts` is TypeScript, so third-party theme authors need a TS toolchain and recompile cycle. Theme marketplaces sell flat assets; ours can't.
- `ThemeSlot` only ships in one theme (`pixelcraft`) and only overrides one component (`NewsGrid`). It isn't a general named-slot system for module integration.
- The customizer saves every token value as an override, base-value equal or not — storage bloat and a painful reset UX.
- Live preview posts with `postMessage("*")` — any cross-origin iframe on the customizer page can forge theme overrides.
- Theme upload accepts an arbitrary `css` field with no sanitization — a rogue theme can hide the UI (`body { opacity: 0 }`) or exfiltrate via CSS.
- There is no template override hierarchy. A child theme cannot ship a different `product/[id]` page without duplicating the core route.

Competitors (a hosted checkout, another platform, NamelessMC, WordPress block themes, Shopify OS 2.0) converge on the same pattern: a declarative JSON manifest drives both the rendered CSS variables and the admin UI. We need that shape.

## Goals

- **Schema-driven customization.** A theme declares its tokens AND its content fields in one `theme.json`. The admin customizer UI is generated from that schema; no hand-rolled admin forms per theme.
- **Replace TypeScript-only authoring with a JSON + React split.** Theme authors ship a `theme.json` plus React templates. Non-developers can edit values; developers still own structure.
- **Rich field types.** Not just colors. Images, rich text, toggles, number sliders, select dropdowns, font pickers — the set a hosted checkout / WordPress / Shopify all settled on.
- **Named slot registry.** Module manifests already declare `homepageSections`, `navbarComponents`, `layoutComponents`, `widgets`. Unify these into a single named slot surface that templates and modules both speak.
- **Parent/child theme inheritance** (two levels max, WordPress rule). Template files, tokens, config schema, and translations all cascade child → parent → core fallback.
- **Live preview kept — made safe.** Iframe stays; `postMessage` gains explicit origin whitelist.
- **Secure theme upload.** CSS sanitization, color-format validation, same Zod + magic-byte rigor the module upload route already has.
- **Backwards-compatible migration.** `flat`, `flat-dark`, and `pixelcraft` convert to the new format without breaking running installs.

## Non-goals

- **Block-based page composition.** No admin drag-drop page builder. The existing Puck-based `custom-pages` module already covers "admin-composable arbitrary page" and stays separate.
- **JSON page templates.** Pages remain Next.js App Router routes (`.tsx` files). Only the *content fields* inside those routes are schema-driven.
- **Runtime section reordering.** Section order is fixed by the template author. Admins toggle visibility; they don't reorder via the admin UI.
- **Theme scripts / JS execution.** Themes may ship CSS, images, fonts, and React components. They do not ship arbitrary JavaScript that runs in the app shell (security).
- **Deep inheritance (grandchildren).** Two-level parent→child only, to keep the resolver deterministic.
- **Rewriting every existing page.** Core pages keep working; templates only overlay content fields and named slots.

## Architecture Overview

Five layers, each with a single responsibility:

| Layer | Artifact | Role |
|-------|----------|------|
| 1. Manifest | `theme.json` | Declarative tokens + config schema + parent reference |
| 2. Templates | `templates/*.tsx` | React components that read config via `useThemeConfig()` |
| 3. Slots | `<Slot name="…" />` | Named injection points modules contribute to via manifest |
| 4. Customizer | `/admin/themes/customizer` | Admin UI auto-generated from theme.json + live preview |
| 5. Runtime | `ThemeProvider` + token CSS | CSS custom-property injection + config context |

Data flow:
```
theme.json (source of truth)
   │
   ├──► scripts/generate-theme-registry.ts ──► src/core/generated/theme-registry.tsx
   │                                               (tokens, schema, component imports)
   │
   ├──► admin customizer UI  ──► Setting.theme_customizations (DB)
   │                                   │
   └──► build-time CSS  ──► @theme { --uxw-color-primary: ... }
                                       │
                                       ▼
                              <html style="--uxw-color-primary: <override>"> + <ThemeConfigProvider>
                                       │
                                       ▼
                              Templates + Slots render
```

## `theme.json` Schema

Frozen v1 shape. A Zod schema (`src/core/lib/theme-manifest-schema.ts`) validates every upload.

```jsonc
{
  "$schema": "https://uxwvend.dev/schemas/theme-v1.json",
  "schemaVersion": 1,
  "id": "pixelcraft",
  "name": "PixelCraft",
  "description": "Pixel-art gaming theme",
  "version": "1.0.0",
  "author": "uxwVend",
  "type": "dark",
  "parent": "flat",                     // optional, one level only

  "preview": "assets/preview.png",      // marketplace thumbnail

  "tokens": {
    "colors": {
      "primary":   { "type": "color", "default": "#6366f1", "group": "Brand" },
      "secondary": { "type": "color", "default": "#1f2937", "group": "Brand" },
      "accent":    { "type": "color", "default": "#f472b6", "group": "Brand" },
      "surface":   { "type": "color", "default": "#0f172a", "group": "Surface" }
      /* any number; no fixed 13-token ceiling */
    },
    "fonts": {
      "heading": { "type": "font", "default": "Inter", "options": ["Inter","Poppins","Press Start 2P"] },
      "body":    { "type": "font", "default": "Inter" }
    },
    "radius": { "type": "select", "default": "md", "options": [
      { "value": "none", "label": "Square" },
      { "value": "sm",   "label": "Subtle" },
      { "value": "md",   "label": "Rounded" },
      { "value": "lg",   "label": "Soft"    }
    ]},
    "space": { "type": "slider", "default": 4, "min": 2, "max": 8, "step": 1 }
  },

  "config": {
    "hero": {
      "label": "Hero Section",
      "fields": {
        "enabled":        { "type": "toggle",   "default": true,  "label": "Show hero" },
        "logoImage":      { "type": "image",    "aspectRatio": "16:9", "maxKb": 500 },
        "headline":       { "type": "text",     "max": 100, "default": "Welcome to our server" },
        "subtitle":       { "type": "text",     "max": 200 },
        "backgroundUrl":  { "type": "image",    "maxKb": 1000 },
        "ctaLabel":       { "type": "text",     "default": "Get started" },
        "ctaHref":        { "type": "url",      "default": "/store" },
        "showPlayerCount":{ "type": "toggle",   "default": true }
      }
    },
    "footer": {
      "label": "Footer",
      "fields": {
        "copyrightText":  { "type": "text", "max": 200 },
        "showDiscord":    { "type": "toggle", "default": true },
        "richBlurb":      { "type": "richtext", "max": 2000 }
      }
    }
    /* any top-level group; dot-path access at runtime: useThemeConfig("hero.headline") */
  },

  "slots": [
    /* slot names this theme exposes. Modules declare what they contribute
       in module.json; the registry merges both sides. */
    { "name": "home.beforeHero" },
    { "name": "home.afterHero" },
    { "name": "home.sidebar" },
    { "name": "footer.extra" }
  ],

  "translations": {                      // optional; merged into the Translation table
    "en": { "pixelcraft": { "heroHeadline": "Welcome, Player" } },
    "tr": { "pixelcraft": { "heroHeadline": "Hoş geldin" } }
  }
}
```

### Field types

| `type` | Stored | Admin control |
|--------|--------|---------------|
| `color` | hex string | color picker |
| `font` | string (family) | family select |
| `select` | option value | dropdown |
| `slider` | number | range input with label |
| `toggle` | boolean | switch |
| `text` | string (maxLen enforced) | text input |
| `url` | string (same-origin or http/https) | url input |
| `richtext` | HTML (sanitized via DOMPurify) | WYSIWYG |
| `image` | URL string (must come from our storage provider) | image uploader that hands off to `/api/v1/upload` |

Everything above is first-class in the Zod schema and in the customizer form renderer.

## File Layout

```
src/themes/<id>/
  theme.json                         # manifest (required)
  templates/                         # React overrides (optional)
    home.tsx                         # renders the home route
    product/[slug].tsx               # per-product page
    layout.tsx                       # root wrapper override
    auth/login.tsx
  parts/                             # reusable theme-level components
    Header.tsx
    Footer.tsx
    Hero.tsx
  assets/                            # static files served from public
    preview.png
    fonts/PressStart2P.woff2
  messages/                          # optional, merges into DB
    en.json
    tr.json
```

No `*.ts` config file. `theme.json` is the manifest, React files are the renderable artifacts, nothing else.

## Template Resolution + Inheritance

When the app renders a route like `/store/product/123`:

1. Core resolver checks `src/themes/<active>/templates/product/[slug].tsx` — if present, renders it.
2. Otherwise falls back to `src/themes/<parent>/templates/product/[slug].tsx` (one level only).
3. Otherwise falls back to the core `/src/app/[locale]/store/product/[...]/page.tsx` route.

Implemented via a small `resolveThemeTemplate(route)` helper invoked from a wrapper route. Core routes already exist — the theme layer is an optional overlay. No dynamic imports in hot paths; a build-time codegen step emits `src/core/generated/theme-templates.ts` with the resolved import map, same pattern as the existing module registry generator.

Tokens, config schema, and translations cascade the same way: child first, then parent, then core defaults (from the active theme only — other themes stay isolated).

## Named Slot Registry

A new `slots` field in `module.json` lets a module contribute a component to any named slot:

```jsonc
// module.json (new field, added alongside existing fields)
"slots": [
  { "name": "home.afterHero", "component": "sections/FeaturedProducts", "order": 10 },
  { "name": "navbar.right",   "component": "components/CartIcon",        "order": 20 }
]
```

Core declares the canonical slot names (`home.afterHero`, `navbar.right`, `footer.extra`, …) in `src/core/lib/slots.ts`. Themes may declare additional slots in `theme.json#slots[]`. Modules may contribute to any slot name.

`<Slot name="home.afterHero" />` renders:
1. All module contributions to that slot, sorted by `order`.
2. An optional fallback passed as `children`.

Build-time codegen emits `src/core/generated/slot-registry.tsx` with the dynamic imports, mirroring how `module-registry.tsx` works today.

Existing module-manifest fields (`homepageSections`, `navbarComponents`, `layoutComponents`, `widgets`) stay put and keep working. Internally, the codegen treats each as an alias that maps to a canonical slot name (`home.*`, `navbar.right`, `layout.*`, `home.sidebar`). Over time modules can migrate to the unified `slots` field, but no existing module needs to change for this spec to ship.

## Customizer Admin Panel

Route: `/admin/themes/customizer`.

Layout: two-pane (form left, iframe right). Already present.

What changes:
- Form is rendered from `theme.json#tokens + theme.json#config` — no per-theme hand-rolled forms.
- Form renderer lives at `src/core/components/admin/theme-customizer/` and dispatches on field `type`.
- On blur or slider-release, parent posts a debounced `{ type: "uxwvend:theme-preview", overrides }` to the iframe. Iframe validates `event.origin === window.location.origin` before accepting.
- On save, diff against defaults is computed client-side; **only non-default values are persisted** to `ThemeCustomization`. Reset-to-default is a single row-delete.
- Device preview simulates viewport width via iframe resizing. Server-side device-aware layouts are an explicit non-goal for this pass.

## Runtime

### CSS token propagation

Tokens → CSS custom properties at build time. `scripts/generate-theme-registry.ts` reads every theme's `theme.json` and emits a Tailwind v4 `@theme {}` directive per theme inside `src/core/generated/theme-tokens.css`:

```css
@theme {
  --uxw-color-primary: #6366f1;
  --uxw-color-secondary: #1f2937;
  /* …all tokens, with `--uxw-` namespace */
}
```

Tailwind v4 picks this up and makes `bg-primary`, `text-primary`, `ring-primary` work across the app.

Admin overrides layer on top at runtime. The root layout reads `ThemeCustomization.overrides` and emits a scoped inline `<style>` that sets the same custom properties with new values:

```html
<style>
  html { --uxw-color-primary: #ff00aa; }
</style>
```

No FOUC: the style is in the SSR head, before any content paints.

### Config propagation

Server components: `getThemeConfig()` reads the active theme + overrides from DB, returns the merged config object.

Client components: `<ThemeConfigProvider value={...}>` wraps the tree; `useThemeConfig(path)` hook reads by dot-path.

Both APIs live in `src/core/lib/theme-config.ts`.

## Packaging + Installation

ZIP layout = the `src/themes/<id>/` tree from above. Upload flow:

1. `POST /api/v1/themes/upload` (admin only, CSRF-guarded — proxy already enforces).
2. Same ZIP validator used for modules (`validateZipEntries`) — magic bytes, symlink/bomb/forbidden-name blocks.
3. `theme.json` validated with Zod; color values regex-checked (`#[0-9a-fA-F]{3,8}`); richtext/CSS sanitized.
4. Extracted to `src/themes/<id>/` (id format `[a-z0-9-]+`, reserved list identical to modules: `flat`, `flat-dark`, `core`, `admin`).
5. `generate-theme-registry.ts` invoked to rebuild `theme-registry.tsx` + `theme-tokens.css`.
6. `Theme` row upserted with `manifestHash` + `installedByUserId` + `installedAt`, same audit pattern as `ModuleConfig`.
7. Does NOT auto-activate. Admin activates via `/admin/themes`.

Marketplace: existing `theme-marketplace/*.zip` catalog stays, built via `scripts/build-theme-marketplace.sh` (mirror of `build-marketplace.sh`).

## Migration Path

Ship the new system alongside the old for one release:

- `scripts/migrate-theme-to-v1.ts` converts each existing `src/themes/<id>/theme.config.ts` to `theme.json`. Deterministic mapping: `colors.primary` → `tokens.colors.primary`, etc. CSS blob (`config.css`) sanitized and preserved.
- `flat`, `flat-dark`, `pixelcraft` migrated in-repo in the same commit. Old `theme.config.ts` removed.
- `ThemeSlot` component renamed / generalized to `Slot`; `pixelcraft`'s one override rewritten as a module-style slot contribution.
- `ThemeColors` TypeScript interface deleted. Consumers (`ThemeProvider`, customizer) switch to `Record<string, string>` via the merged config.
- No user-visible data migration — `Setting.theme_overrides` rows are read once and re-persisted to the new `ThemeCustomization` table with the diff-only format.

A single feature flag is not used. The whole change lands atomically; the build verifies `npm run generate:themes && npm run build` passes before merge.

## Security Requirements

Carrying forward hardening already applied elsewhere:

- **CSS sanitizer** (`src/core/lib/css-sanitizer.ts`) runs on theme.json `css` fields AND on `richtext` values server-side at save time (defense in depth alongside the existing client sanitize).
- **Color validator** in the Zod schema: `/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/`.
- **`postMessage` origin check** on both sides of the customizer. Plain `"*"` is banned; we compare to `window.location.origin`.
- **Image fields** hand off to the existing `/api/v1/upload` flow — magic-byte detection, dimension cap, SVG sanitize all already enforced.
- **Theme manifest hash + installedBy audit trail**, mirroring the module install audit added in commit e949c98.
- **Fallback chain**: active theme missing → parent → `flat` → synthetic default theme (never crashes the app).

## Verification

Shipped when:

- `npm test` passes; new suite `tests/unit/theme-manifest-schema.test.ts` covers every field type and the Zod edge cases.
- `npm run build` passes with the three migrated themes; `theme-tokens.css` non-empty; `theme-templates.ts` non-empty.
- Customizer manual QA: change hero headline → iframe updates within 500ms; save → reload shows persisted value; reset → DB row cleared.
- Theme upload manual QA: fresh ZIP of a fourth theme activates without restart; malformed `theme.json` rejected with a field-level error; oversized `richtext` rejected.
- Admin docs (`docs/CONTRIBUTING.md`) describe theme authoring end-to-end with a walkthrough.

## Out of scope (follow-ups)

These are intentionally left for a later pass so this spec stays focused:

- **Block-based page composition** (Shopify OS 2.0 sections). Promoted to a separate initiative if demand emerges.
- **Theme presets / color schemes** (one theme bundling multiple pre-selected color sets). Data model supports it (multiple `ThemeCustomization` rows per theme), but the admin UX is deferred.
- **Visual device simulator** beyond viewport width — full user-agent and touch-event simulation.
- **Third-party theme marketplace storefront** (buying / selling themes). Out of core; a commerce module would own it.
- **`JSON.parse(JSON.stringify(config))` refactor** in `ThemeProvider`. Cosmetic perf, done alongside but not part of the contract.

## Verification of this spec

Self-checks before handing back:
- No TBDs / TODOs.
- Architecture (5 layers) maps to the file layout, the resolution order, and the runtime sections.
- Security requirements enumerate every attack surface the audit flagged: postMessage origin, CSS sanitization, color validation, upload path validation, audit trail, fallback chain.
- Non-goals explicitly exclude block composition so the scope doesn't expand during implementation.
- Migration section names every existing artifact (`flat`, `flat-dark`, `pixelcraft`, `ThemeSlot`, `ThemeColors`, `theme_overrides`) and maps each to a disposition.
