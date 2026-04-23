# Theme System Redesign — Design Spec

**Date:** 2026-04-22
**Status:** Approved, ready for implementation plan
**Scope:** Full rewrite of the theme subsystem. Pre-launch — no backward
compatibility shim required (confirmed with product owner).

---

## 1. Problem

The current theme system is a thin cosmetic layer — it swaps a handful of
CSS variables and little else. Concrete failings that triggered this
redesign:

1. `/admin/settings/theme` hardcodes a fixed list of color inputs
   (Primary, Secondary, Accent, …). The choice of tokens belongs to the
   theme, not to core. PixelCraft and Flat expose the same form.
2. `/admin/settings/customizer` (Puck-based page builder) duplicates
   what a schema-driven theme settings form should do and adds complexity
   for features nobody uses yet.
3. `Flat` and `Flat Dark` ship as two separate themes. Selecting
   `Flat Dark` does not recolor the UI because the runtime does not merge
   the `parent: "flat"` declaration. Users see two cards for one theme.
4. `/admin/settings/hero` is in core with Minecraft-specific fields
   (`hero_server_ip`, `hero_show_player_count`, `hero_discord_url`). This
   violates the core motto — core must know nothing about any specific
   site type.
5. Slot registry canonicalizes feature-specific slots in core
   (`product.beforeAddToCart`, `profile.tabs`).

### Bigger picture

The platform is designed to host multiple site types (storefront,
Minecraft community site, forum, marketplace). The theme layer needs to
participate in that — today it cannot. A theme should be able to turn the
same installation into a Minecraft community homepage or a marketplace
without core knowing about either.

---

## 2. Boundaries — who owns what

Three layers, strict direction of dependency.

```
CORE     ← knows nothing about site type
MODULES  ← feature layer, independent of theme
THEME    ← presentation + composition, independent of modules
```

**Core** owns: auth, RBAC, i18n, navigation/footer link structure, SEO
metadata, maintenance mode, health, file upload, rate limiting, and the
three truly site-type-agnostic slots (`layout.beforeMain`,
`layout.afterMain`, `head.extra`).

**Modules** own: features (store, mc-stats, forum, chat, …). DB models,
APIs, pages, hooks, their own slot declarations. No knowledge of the
active theme.

**Theme** owns: visual tokens (colors/fonts/radius/space), modes
(light/dark), component overrides (Navbar/Footer/Hero/…), admin settings
pages for presentation-level content (hero text, landing sections),
slot contributions, and optional module recommendations.

### Invariants

- Modules never call `useTheme()` or read theme state. They consume
  visual tokens exclusively through CSS variables (`var(--uxw-primary)`).
- Themes never import module code by name. A theme reaches module
  functionality only through slots declared by modules.
- Switching the active theme is non-destructive — module data and module
  settings are untouched. Only presentation changes.

---

## 3. Manifest v2

`schemaVersion: 2`. No v1 support — the three existing themes
(`flat`, `flat-dark`, `pixelcraft`) are migrated in place as part of
this work.

```jsonc
{
  "schemaVersion": 2,
  "id": "pixelcraft",
  "name": "PixelCraft",
  "description": "Pixel-art gaming theme",
  "version": "1.0.0",
  "author": "uxwVend",
  "preview": "preview.png",

  // 1+ modes. `default` must be one of the keys in `available`.
  "modes": {
    "default": "dark",
    "available": {
      "light": { "tokens": { "colors": { "primary": "#3ea72d", "...": "..." } } },
      "dark":  { "tokens": { "colors": { "primary": "#3ea72d", "...": "..." } } }
    }
  },

  // Token DEFINITIONS — shape of the customizer. Per-mode defaults live
  // in `modes.available[mode].tokens`; this block names the fields and
  // declares their input type.
  "tokens": {
    "colors": {
      "primary":    { "type": "color", "group": "Brand" },
      "background": { "type": "color", "group": "Surface" }
    },
    "fonts":  { "heading": { "type": "font" }, "body": { "type": "font" } },
    "radius": { "type": "select", "options": [...] },
    "space":  { "type": "slider", "min": 0, "max": 16 }
  },

  // Theme-owned admin pages. Each group becomes one admin page with a
  // schema-driven form. Data persists to ThemeSetting.
  "settings": {
    "hero": {
      "label": "Hero Banner",
      "icon": "Image",
      "fields": {
        "title":      { "type": "text", "label": "Title", "default": "Welcome" },
        "background": { "type": "image" },
        "cta_label":  { "type": "text" },
        "cta_href":   { "type": "url" }
      }
    }
  },

  // Component override map. Path is relative to the theme root.
  "components": {
    "Navbar": "components/Navbar.tsx",
    "Footer": "components/Footer.tsx",
    "Hero":   "components/Hero.tsx"
  },

  // Slot declarations owned by this theme.
  "slots": [
    { "name": "home.beforeHero" },
    { "name": "hero.belowCta" }
  ],

  // Render into slots (either own or module-owned).
  "slotContents": [
    { "slot": "home.afterHero", "component": "components/FeatureGrid.tsx", "order": 10 }
  ],

  // Sidebar label/icon for the whole "Theme" group.
  "adminNav": { "label": "PixelCraft Theme", "icon": "Palette", "order": 80 },

  // Custom admin pages (escape hatch when `settings` schema is not enough).
  "adminRoutes": [
    { "path": "/theme/advanced", "component": "admin/Advanced.tsx" }
  ],

  // Opt-in install suggestions. NEVER auto-installs. UI shows a banner.
  "suggestedModules": [
    { "id": "mc-stats", "reason": "Live server status on hero" }
  ],

  "translations": {
    "tr": { "hero": { "title": "Başlık" } }
  }
}
```

### Validation rules (Zod)

- `schemaVersion === 2`
- `modes.available` has at least one entry; each key matches `/^[a-z][a-z0-9-]*$/`
- `modes.default` exists in `modes.available`
- `settings.*.fields.*.key` matches the SAFE_KEY regex; max 50 fields per group
- `components.*` path must resolve under theme root (zip-slip guard);
  file must exist at install time
- `adminRoutes[].path` matches `/^\/[a-z0-9/-]+$/`
- `suggestedModules[].id` matches module SAFE_ID
- Form field types supported: `color`, `font`, `select`, `slider`,
  `toggle`, `text`, `url`, `richtext`, `image`, `number`

### What v2 removes

- `type: "light" | "dark"` top-level field — replaced by `modes`.
- `parent` — inheritance is gone. Every theme is complete on its own.
- Old `config` block — replaced by `settings` (which now maps to admin
  pages, not generic key-value).

---

## 4. Data model

### Prisma changes

```prisma
// CHANGE — customization becomes mode-aware so light/dark overrides
// don't collide.
model ThemeCustomization {
  id          String   @id @default(cuid())
  themeId     String
  mode        String
  overrides   Json                        // token-level overrides only
  updatedById String?
  updatedAt   DateTime @updatedAt
  @@unique([themeId, mode])
}

// NEW — theme-owned settings (hero text, landing content, etc).
model ThemeSetting {
  id          String   @id @default(cuid())
  themeId     String
  group       String
  key         String
  value       Json
  updatedById String?
  updatedAt   DateTime @updatedAt
  @@unique([themeId, group, key])
  @@index([themeId, group])
}

// NEW — active theme + active mode, singleton.
model ThemeState {
  id        Int      @id @default(1)
  themeId   String
  mode      String
  updatedAt DateTime @updatedAt
}
```

Theme **existence** is still purely a filesystem + codegen fact; no
`ThemeConfig` row. `ThemeState`/`ThemeSetting`/`ThemeCustomization` are
pure data.

### Delete semantics

`DELETE /api/v1/themes/{id}`:

1. Guard: reject if `ThemeState.themeId === id` (cannot delete active theme).
2. Transaction: `deleteMany ThemeCustomization`, `deleteMany ThemeSetting`,
   filesystem `rm -rf src/themes/{id}`.
3. Regenerate theme-registry.

Switching themes does **not** delete data — old customizations stay and
reappear if the user switches back.

### Read path (SSR)

Three queries, all cacheable:

1. `ThemeState.findFirst()` (singleton)
2. `ThemeCustomization.findUnique({ themeId_mode })`
3. `ThemeSetting.findMany({ where: { themeId } })`

Cache keys: `theme:active`, `theme:{id}:custom:{mode}`, `theme:{id}:settings`.
TTL 5 min, invalidated on write. Falls back to in-memory if Redis absent
(same pattern as rate-limit.ts).

---

## 5. Runtime

### Codegen outputs (`src/core/generated/`)

| File | Purpose |
|------|---------|
| `theme-registry.tsx` | Full manifests keyed by id (existing, extended) |
| `theme-components.tsx` | `{ [themeId]: { [name]: dynamic(...) } }` — component overrides |
| `theme-admin-routes.tsx` | Generated admin route list per theme |
| `theme-tokens.css` | CSS variables per theme × mode (existing, extended) |

### Component override

Every core component that a theme might replace wraps itself in a
lookup:

```tsx
// src/core/components/layout/Navbar.tsx
export function Navbar(props) {
  const { themeId } = useTheme();
  const Override = getThemeComponent(themeId, "Navbar");
  return Override ? <Override {...props} /> : <DefaultNavbar {...props} />;
}
```

Default components stay in core so a theme that declares no overrides
still renders.

### Schema-driven admin page

One generic catch-all page handles every theme settings group:

```
src/app/[locale]/(admin)/admin/theme/[group]/page.tsx
```

It reads `manifest.settings[params.group]` and renders
`<SchemaDrivenForm fields={...} />` — reused from the existing
customizer form. Submit hits `PUT /api/v1/themes/{id}/settings/{group}`
and upserts `ThemeSetting` rows.

Theme authors write **zero React** for a settings page; they declare the
field schema in `theme.json`. The escape hatch (`adminRoutes` with a
component path) stays for cases the schema does not cover.

### Sidebar

```
- Dashboard
- Users & RBAC
- Modules
- Theme                              ← shown whenever a theme is active
    ├─ Appearance                    (always — theme picker, mode, tokens)
    ├─ <group>                       for each key in manifest.settings
    └─ <adminRoutes entry>           for each custom route
- Settings
    ├─ Site (name, logo, favicon, meta)
    ├─ Navigation (navbar + footer link lists)
    ├─ Custom CSS
    ├─ General / i18n
    └─ Infra (rate-limits, alerting, maintenance, moderation)
- <module nav groups injected>
```

### Active mode priority

1. `ThemeState.mode` (admin-forced if set)
2. User cookie `uxw_mode`
3. `prefers-color-scheme` via next-themes
4. `manifest.modes.default`

If the theme declares only one mode, the toggle UI is hidden and the
single mode wins regardless of cookie / system preference.

---

## 6. Core purge map

### Removed from core

| Artifact | Replacement |
|----------|-------------|
| `/admin/settings/hero` (MC-specific fields) | Theme-owned `settings.hero` for generic fields (title, bg, CTA); MC fields migrate to the `mc-stats` module |
| `/admin/settings/customizer` (Puck) | Deleted wholesale; replaced by `settings.*` schema + SchemaDrivenForm |
| Hardcoded color grid at `/admin/settings/theme` | Schema-driven from `manifest.tokens.colors` |
| `src/core/components/layout/HeroBanner.tsx` (default) | Gone; homepage renders `<Slot name="home.hero" />`; theme fills it |
| Canonical slot `product.beforeAddToCart` | Moved to `store` module manifest |
| Canonical slot `profile.tabs` | Moved to `user-profile` module manifest |

### Kept in core

| Artifact | Reason |
|----------|--------|
| `/admin/settings/site` | Site meta (name, logo, favicon) — agnostic |
| `/admin/settings/navbar` + `/footer` | Link structure is data, not presentation. Theme only restyles. |
| `/admin/settings/css` | Custom CSS escape hatch |
| `/admin/settings/maintenance`, `/rate-limits`, `/alerting`, `/moderation`, `/general` | Infra + i18n — theme-agnostic |
| Slots `layout.beforeMain`, `layout.afterMain`, `head.extra` | The only truly core slots |

---

## 7. Cross-registry conflict rules

| Collision | Resolution |
|-----------|-----------|
| Theme `components.X` + default core `X` | Theme wins (the point of overrides) |
| Two modules into the same slot | Sort by `order`, both render |
| Theme + module into the same slot, equal `order` | Module renders first (module is functional, theme is cosmetic) |
| Theme `adminRoutes` + module `adminRoutes` path collision | Registry generation fails; the later install is rejected |
| Theme declares slot already declared by a module | Registry generation fails with a clear message |

Module-to-module path collisions are already an install-reject condition;
we extend the same check to cover theme-vs-module.

---

## 8. Theme install / uninstall

### Install (ZIP upload)

```
1. Zod-validate manifest (schemaVersion === 2)
2. zip-slip + file-ref existence check
3. extract to src/themes/{id}/
4. run scripts/generate-theme-registry.ts
   - on failure: rm -rf src/themes/{id}, return error
5. scheduleBuild() — same deferred build pipeline as modules
6. if manifest.suggestedModules: surface banner in admin UI (no auto-install)
```

No `ThemeConfig`-style DB row — theme presence is filesystem + regen.

### Uninstall

```
1. Guard: ThemeState.themeId !== id
2. Transaction: delete ThemeCustomization + ThemeSetting for that id
3. rm -rf src/themes/{id}
4. Regenerate theme-registry
```

---

## 9. Migration steps (existing themes)

1. Write `scripts/migrate-themes-v2.ts`:
   - Reads `src/themes/*/theme.json`
   - Merges `flat` + `flat-dark` into one `flat/theme.json` with
     `modes: { default: "light", available: { light, dark } }`
   - Upgrades PixelCraft to `modes: { default: "dark", available: { dark } }`
   - Deletes `src/themes/flat-dark/`
2. Prisma migration adds `ThemeCustomization.mode`, `ThemeSetting`,
   `ThemeState`. Backfill:
   - Existing `ThemeCustomization` rows get `mode = 'light'`
   - `Setting WHERE key = 'active_theme'` → one `ThemeState` row; old row deleted
3. Delete `/admin/settings/hero` and `/admin/settings/customizer` pages
   plus their API routes.
4. MC-specific legacy settings (`hero_server_ip`, `hero_show_player_count`,
   `hero_discord_url`) migrate based on whether `mc-stats` is installed:
   - Installed: upsert into that module's own settings store
   - Not installed: write a single admin-dashboard notification with the
     orphaned key/value pairs so the operator can move them manually.
     The migration script never drops values silently.
5. Purge `src/core/lib/slot-registry.ts` CANONICAL_SLOTS down to the
   three layout/head entries.
6. Move `product.beforeAddToCart` into `store` module manifest; move
   `profile.tabs` into `user-profile` module manifest.

---

## 10. Design decisions (final)

1. **Themes can import `@/core/*` (hooks/utilities) but not Prisma
   directly.** Database access goes through core APIs.
2. **Themes cannot import module code by name.** Cross-module/theme
   communication is slot-based only.
3. **Theme translations** sync to the `Translation` table on install
   with `module = "theme:{id}"`, same lifecycle as module translations.
4. **Dev mode:** `npm run dev`'s existing `predev` hook regenerates the
   theme registry. Authors editing `src/themes/{id}/` get live reload.
5. **No backward compatibility shim.** v1 manifests are not accepted —
   the three existing themes are migrated in place as part of this work.

---

## 11. Out of scope

Explicitly **not** part of this spec:

- Drag-and-drop page builder (removed wholesale)
- Theme marketplace remote install UX changes (current flow stays)
- Per-user theme selection (global `ThemeState` only)
- A/B theme preview to unauthenticated users
- Nested themes / theme inheritance
- Module auto-install from `suggestedModules` (opt-in banner only)

---

## 12. Acceptance criteria

Implementation is done when:

1. Manifest v2 Zod schema exists and rejects v1 input.
2. Flat's light and dark modes live in one `theme.json`; `flat-dark/`
   directory no longer exists.
3. Selecting Dark in the mode toggle actually recolors the UI for every
   theme, PixelCraft included.
4. `/admin/settings/theme` form fields are generated from the active
   theme's `manifest.tokens.colors` — no hardcoded list.
5. `/admin/settings/customizer` returns 404.
6. `/admin/settings/hero` returns 404; the equivalent form lives under
   `/admin/theme/hero` and is driven by the active theme's manifest.
7. Slot registry CANONICAL_SLOTS has exactly three entries.
8. Uninstalling a theme deletes its `ThemeCustomization` + `ThemeSetting`
   rows atomically; switching themes does not.
9. A theme with a custom `components.Navbar` replaces the core Navbar
   at runtime; removing the override falls back to core Navbar.
10. `suggestedModules` surfaces as a non-blocking banner; it never
    auto-installs.
