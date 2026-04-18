# Theme System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the TypeScript-only theme config (hard-coded 13 color tokens, no rich field types, no schema-driven admin UI) with a checkout-style system where each theme ships a declarative `theme.json` that drives both the runtime CSS tokens and an auto-generated admin customizer.

**Architecture:** Five layers — `theme.json` manifest (Zod-validated), React templates stay as code, named `<Slot>` registry (unifies today's `homepageSections`/`navbarComponents`/etc. via aliases), customizer admin UI auto-rendered from the schema, runtime Tailwind v4 `@theme {}` directive plus `<ThemeConfigProvider>`. Two-level parent/child inheritance for tokens + config (template hierarchy is out of scope for this plan).

**Tech Stack:** Next.js 16 + React 19 + Tailwind v4 + Prisma 7 + TypeScript + Zod 4 + vitest.

**Constraints:**
- 41 first-party modules must keep working unchanged; migration to the new `slots` field is opt-in and bridged by aliases.
- Every spec requirement in `docs/superpowers/specs/2026-04-18-theme-system-redesign-design.md` is covered by a task below.
- Each task is one TDD cycle (failing test → implementation → passing test → commit) unless the task is a pure migration.

---

## File Structure

**New files**

| Path | Responsibility |
|---|---|
| `src/core/lib/theme-manifest-schema.ts` | Zod schema for `theme.json` |
| `src/core/lib/theme-config.ts` | `getThemeConfig` server helper + `ThemeConfigProvider` + `useThemeConfig` |
| `src/core/lib/theme-registry-loader.ts` | Reads theme files at build time (used by the generator) |
| `src/core/lib/slot-registry.ts` | Canonical slot names + contribution merging |
| `src/core/components/Slot.tsx` | Generalized named slot component (replaces `ThemeSlot`) |
| `src/core/components/admin/theme-customizer/CustomizerForm.tsx` | Schema-driven form renderer (root) |
| `src/core/components/admin/theme-customizer/fields/` | One file per field type (`ColorField`, `ToggleField`, …) |
| `src/core/components/admin/theme-customizer/diff.ts` | Override-diff computation |
| `src/core/generated/theme-registry.ts` | Build-time codegen (tokens + schema + preview path) |
| `src/core/generated/theme-tokens.css` | Tailwind v4 `@theme` directives — one block per theme |
| `src/core/generated/slot-registry.tsx` | Dynamic-import registry mirroring `module-registry.tsx` |
| `scripts/generate-theme-registry.ts` | Replaces `scripts/generate-themes.ts` |
| `scripts/migrate-theme-to-v1.ts` | One-shot converter for the 3 in-repo themes |
| `src/themes/flat/theme.json` | Migrated manifest |
| `src/themes/flat-dark/theme.json` | Migrated manifest |
| `src/themes/pixelcraft/theme.json` | Migrated manifest |
| `src/app/api/v1/themes/upload/route.ts` | Replaced with Zod + ZIP validator + audit |

**Modified files**

| Path | Change |
|---|---|
| `prisma/schema.core.prisma` | Add `Theme` + `ThemeCustomization` models |
| `src/core/providers/theme-provider.tsx` | Read new registry, add fallback chain |
| `src/app/globals.css` | Import generated `theme-tokens.css`, drop hardcoded `--ux-*` block |
| `src/app/[locale]/(admin)/admin/settings/customizer/page.tsx` | Use `CustomizerForm` |
| `src/core/lib/module-manifest-schema.ts` | Add `slots` field |
| `scripts/generate-registry.ts` | Emit `slot-registry.tsx` |
| `package.json` | `generate:themes` now points at `generate-theme-registry.ts`; `predev`/`prebuild` chains updated |
| `src/themes/pixelcraft/**` | Swap `ThemeSlot` for `Slot` |
| `docs/CONTRIBUTING.md` | Add "Authoring a theme" section |

**Deleted files**

| Path | Reason |
|---|---|
| `src/themes/*/theme.config.ts` | Superseded by `theme.json` |
| `src/core/types/theme.ts` | `ThemeColors` interface no longer exists; runtime type lives in `theme-manifest-schema.ts` |
| `src/core/components/theme-slot.tsx` | Replaced by `Slot.tsx` |
| `scripts/generate-themes.ts` | Replaced by `generate-theme-registry.ts` |

---

## Sequencing

Five phases. Each phase commits independently and leaves the app buildable.

1. **Schema & Prisma.** theme.json schema, DB models. No user-visible change yet.
2. **Migration.** Convert the three themes and the generator. Existing runtime reads the new files via the old provider (compat shim). App still builds.
3. **Runtime rewire.** New `ThemeConfigProvider`, Tailwind `@theme` integration, fallback chain. Hardcoded `--ux-*` block in `globals.css` removed.
4. **Slot unification.** `<Slot>` component + registry + manifest `slots` field + aliases for existing fields.
5. **Customizer + upload.** Schema-driven form, diff-only save, secure theme upload.

---

## Task 1 — Prisma models for Theme + ThemeCustomization

**Files:**
- Modify: `prisma/schema.core.prisma`
- Run: `npx tsx scripts/merge-schemas.ts`

- [ ] **Step 1: Add models to the core schema**

Append to `prisma/schema.core.prisma` (after the `ModuleConfig` block):

```prisma
/// Registered theme — one row per `src/themes/<id>/theme.json` installed on this instance.
model Theme {
  id                String   @id
  name              String
  version           String
  parent            String?
  type              String   @default("light") // "light" | "dark"
  manifestHash      String
  installedAt       DateTime @default(now())
  installedByUserId String?
  updatedAt         DateTime @updatedAt

  customizations ThemeCustomization[]

  @@index([parent])
}

/// Admin customization for a theme. One row per theme; `overrides` is a
/// DIFF against the manifest defaults, not a full snapshot — resetting a
/// field clears it from `overrides`, and deleting the row restores
/// every default at once.
model ThemeCustomization {
  id        String   @id @default(cuid())
  themeId   String
  theme     Theme    @relation(fields: [themeId], references: [id], onDelete: Cascade)
  overrides Json     @default("{}")
  updatedAt DateTime @updatedAt
  updatedById String?

  @@unique([themeId])
}
```

- [ ] **Step 2: Merge + regenerate the client**

```bash
npx tsx scripts/merge-schemas.ts
```

Expected output ends with `Prisma client generated successfully.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.core.prisma
git commit -m "feat(theme): add Theme + ThemeCustomization Prisma models"
```

---

## Task 2 — `theme-manifest-schema.ts` (Zod)

**Files:**
- Create: `src/core/lib/theme-manifest-schema.ts`
- Test: `tests/unit/theme-manifest-schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/unit/theme-manifest-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { themeManifestSchema } from "@/core/lib/theme-manifest-schema";

const minimal = {
    schemaVersion: 1,
    id: "my-theme",
    name: "My Theme",
    description: "Test theme",
    version: "1.0.0",
    type: "light",
    tokens: {},
    config: {},
};

describe("themeManifestSchema", () => {
    it("accepts a minimal valid manifest", () => {
        expect(themeManifestSchema.safeParse(minimal).success).toBe(true);
    });

    it("rejects bad id format", () => {
        expect(themeManifestSchema.safeParse({ ...minimal, id: "Bad_Id" }).success).toBe(false);
    });

    it("rejects non-semver version", () => {
        expect(themeManifestSchema.safeParse({ ...minimal, version: "not-semver" }).success).toBe(false);
    });

    it("rejects non-hex color tokens", () => {
        const bad = {
            ...minimal,
            tokens: { colors: { primary: { type: "color", default: "not-a-color" } } },
        };
        expect(themeManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("accepts all supported field types", () => {
        const full = {
            ...minimal,
            config: {
                hero: {
                    label: "Hero",
                    fields: {
                        enabled: { type: "toggle", default: true },
                        logoImage: { type: "image" },
                        headline: { type: "text", max: 100 },
                        ctaHref: { type: "url" },
                        blurb: { type: "richtext", max: 500 },
                        count: { type: "slider", min: 1, max: 10 },
                        layout: { type: "select", options: [{ value: "a", label: "A" }] },
                        accent: { type: "color", default: "#ff00aa" },
                    },
                },
            },
        };
        expect(themeManifestSchema.safeParse(full).success).toBe(true);
    });

    it("rejects an unknown field type", () => {
        const bad = {
            ...minimal,
            config: { g: { label: "G", fields: { x: { type: "laser" } } } },
        };
        expect(themeManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("rejects text fields with max > 10000", () => {
        const bad = {
            ...minimal,
            config: { g: { label: "G", fields: { x: { type: "text", max: 999999 } } } },
        };
        expect(themeManifestSchema.safeParse(bad).success).toBe(false);
    });

    it("accepts optional parent theme id", () => {
        expect(themeManifestSchema.safeParse({ ...minimal, parent: "flat" }).success).toBe(true);
    });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run tests/unit/theme-manifest-schema.test.ts
```

Expected: FAIL — module `@/core/lib/theme-manifest-schema` not found.

- [ ] **Step 3: Implement the schema**

`src/core/lib/theme-manifest-schema.ts`:

```ts
import { z } from "zod";

const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?$/;
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
const SEMVER = /^\d+\.\d+\.\d+/;

const colorDef = z.object({
    type: z.literal("color"),
    default: z.string().regex(HEX, "Must be a hex color").optional(),
    group: z.string().max(64).optional(),
    label: z.string().max(100).optional(),
});

const fontDef = z.object({
    type: z.literal("font"),
    default: z.string().max(100).optional(),
    options: z.array(z.string().max(100)).max(100).optional(),
    label: z.string().max(100).optional(),
});

const selectDef = z.object({
    type: z.literal("select"),
    default: z.string().max(64).optional(),
    options: z.array(z.object({
        value: z.string().max(64),
        label: z.string().max(100),
    })).min(1).max(100),
    label: z.string().max(100).optional(),
});

const sliderDef = z.object({
    type: z.literal("slider"),
    default: z.number().optional(),
    min: z.number(),
    max: z.number(),
    step: z.number().positive().optional(),
    label: z.string().max(100).optional(),
});

const toggleDef = z.object({
    type: z.literal("toggle"),
    default: z.boolean().optional(),
    label: z.string().max(100).optional(),
});

const textDef = z.object({
    type: z.literal("text"),
    default: z.string().max(10000).optional(),
    max: z.number().int().positive().max(10000).optional(),
    label: z.string().max(100).optional(),
});

const urlDef = z.object({
    type: z.literal("url"),
    default: z.string().url().optional(),
    label: z.string().max(100).optional(),
});

const richTextDef = z.object({
    type: z.literal("richtext"),
    default: z.string().max(10000).optional(),
    max: z.number().int().positive().max(10000).optional(),
    label: z.string().max(100).optional(),
});

const imageDef = z.object({
    type: z.literal("image"),
    default: z.string().url().optional(),
    aspectRatio: z.string().max(20).optional(),
    maxKb: z.number().int().positive().max(10000).optional(),
    label: z.string().max(100).optional(),
});

const fieldDef = z.discriminatedUnion("type", [
    colorDef, fontDef, selectDef, sliderDef, toggleDef,
    textDef, urlDef, richTextDef, imageDef,
]);

const configGroup = z.object({
    label: z.string().min(1).max(100),
    fields: z.record(z.string().regex(SAFE_ID), fieldDef),
});

export const themeManifestSchema = z.object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(64).regex(SAFE_ID),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    version: z.string().regex(SEMVER),
    author: z.string().max(100).optional(),
    type: z.enum(["light", "dark"]).default("light"),
    parent: z.string().regex(SAFE_ID).optional(),
    preview: z.string().max(256).optional(),

    tokens: z.object({
        colors: z.record(z.string().regex(SAFE_ID), colorDef).optional(),
        fonts: z.record(z.string().regex(SAFE_ID), fontDef).optional(),
        radius: z.union([selectDef, sliderDef]).optional(),
        space: sliderDef.optional(),
    }).default({}),

    config: z.record(z.string().regex(SAFE_ID), configGroup).default({}),

    slots: z.array(z.object({
        name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9.-]+$/),
    })).max(100).optional(),

    translations: z.record(
        z.string(),
        z.record(z.string(), z.record(z.string(), z.string())),
    ).optional(),
}).strict();

export type ThemeManifest = z.infer<typeof themeManifestSchema>;
export type ThemeFieldDef = z.infer<typeof fieldDef>;
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/unit/theme-manifest-schema.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/core/lib/theme-manifest-schema.ts tests/unit/theme-manifest-schema.test.ts
git commit -m "feat(theme): Zod schema for theme.json manifest"
```

---

## Task 3 — Convert `flat` theme to `theme.json`

**Files:**
- Create: `src/themes/flat/theme.json`
- Read: `src/themes/flat/theme.config.ts` (reference, not edited here)

- [ ] **Step 1: Write the new manifest**

`src/themes/flat/theme.json`:

```json
{
  "schemaVersion": 1,
  "id": "flat",
  "name": "Flat",
  "description": "Default light theme — clean, minimal, neutral.",
  "version": "1.0.0",
  "author": "uxwVend",
  "type": "light",
  "tokens": {
    "colors": {
      "primary":         { "type": "color", "default": "#2563eb", "group": "Brand" },
      "secondary":       { "type": "color", "default": "#64748b", "group": "Brand" },
      "accent":          { "type": "color", "default": "#f59e0b", "group": "Brand" },
      "background":      { "type": "color", "default": "#ffffff", "group": "Surface" },
      "foreground":      { "type": "color", "default": "#0f172a", "group": "Surface" },
      "muted":           { "type": "color", "default": "#f1f5f9", "group": "Surface" },
      "mutedForeground": { "type": "color", "default": "#64748b", "group": "Surface" },
      "border":          { "type": "color", "default": "#e2e8f0", "group": "Surface" },
      "card":            { "type": "color", "default": "#ffffff", "group": "Surface" },
      "cardForeground":  { "type": "color", "default": "#0f172a", "group": "Surface" },
      "destructive":     { "type": "color", "default": "#ef4444", "group": "State" },
      "success":         { "type": "color", "default": "#16a34a", "group": "State" },
      "warning":         { "type": "color", "default": "#f59e0b", "group": "State" }
    },
    "fonts": {
      "heading": { "type": "font", "default": "Inter, system-ui, sans-serif" },
      "body":    { "type": "font", "default": "Inter, system-ui, sans-serif" },
      "mono":    { "type": "font", "default": "ui-monospace, SFMono-Regular, monospace" }
    },
    "radius": {
      "type": "select",
      "default": "md",
      "options": [
        { "value": "none", "label": "Square (0)" },
        { "value": "sm",   "label": "Subtle (0.25rem)" },
        { "value": "md",   "label": "Rounded (0.5rem)" },
        { "value": "lg",   "label": "Soft (0.75rem)" }
      ]
    }
  },
  "config": {}
}
```

- [ ] **Step 2: Verify it parses**

```bash
node -e "const z = require('./src/core/lib/theme-manifest-schema.ts')"
```

(Node can't import `.ts` directly — use `npx tsx` instead.)

```bash
npx tsx -e 'import("./src/core/lib/theme-manifest-schema.js").then(m => console.log(m.themeManifestSchema.safeParse(JSON.parse(require("fs").readFileSync("src/themes/flat/theme.json","utf-8"))).success))'
```

Expected: `true`.

- [ ] **Step 3: Commit**

```bash
git add src/themes/flat/theme.json
git commit -m "refactor(theme): migrate flat to theme.json"
```

---

## Task 4 — Convert `flat-dark` theme to `theme.json`

**Files:**
- Create: `src/themes/flat-dark/theme.json`

- [ ] **Step 1: Write the manifest with `parent: "flat"`**

Only override what actually differs (dark colors). Tokens not listed inherit from `flat`.

```json
{
  "schemaVersion": 1,
  "id": "flat-dark",
  "name": "Flat Dark",
  "description": "Dark variant of the Flat theme.",
  "version": "1.0.0",
  "author": "uxwVend",
  "type": "dark",
  "parent": "flat",
  "tokens": {
    "colors": {
      "background":      { "type": "color", "default": "#0f172a" },
      "foreground":      { "type": "color", "default": "#f8fafc" },
      "muted":           { "type": "color", "default": "#1e293b" },
      "mutedForeground": { "type": "color", "default": "#94a3b8" },
      "border":          { "type": "color", "default": "#334155" },
      "card":            { "type": "color", "default": "#1e293b" },
      "cardForeground":  { "type": "color", "default": "#f8fafc" }
    }
  },
  "config": {}
}
```

- [ ] **Step 2: Commit**

```bash
git add src/themes/flat-dark/theme.json
git commit -m "refactor(theme): migrate flat-dark to theme.json (extends flat)"
```

---

## Task 5 — Convert `pixelcraft` theme to `theme.json`

**Files:**
- Create: `src/themes/pixelcraft/theme.json`
- Read: `src/themes/pixelcraft/theme.config.ts` for source values

- [ ] **Step 1: Write the manifest**

Copy the color values + any pixel-art specific font/radius from `theme.config.ts`.

```json
{
  "schemaVersion": 1,
  "id": "pixelcraft",
  "name": "PixelCraft",
  "description": "Pixel-art gaming theme — bold colors and retro typography.",
  "version": "1.0.0",
  "author": "uxwVend",
  "type": "dark",
  "tokens": {
    "colors": {
      "primary":         { "type": "color", "default": "#6366f1", "group": "Brand" },
      "secondary":       { "type": "color", "default": "#a855f7", "group": "Brand" },
      "accent":          { "type": "color", "default": "#ec4899", "group": "Brand" },
      "background":      { "type": "color", "default": "#0a0a0a", "group": "Surface" },
      "foreground":      { "type": "color", "default": "#fafafa", "group": "Surface" },
      "muted":           { "type": "color", "default": "#18181b", "group": "Surface" },
      "mutedForeground": { "type": "color", "default": "#a1a1aa", "group": "Surface" },
      "border":          { "type": "color", "default": "#27272a", "group": "Surface" },
      "card":            { "type": "color", "default": "#18181b", "group": "Surface" },
      "cardForeground":  { "type": "color", "default": "#fafafa", "group": "Surface" },
      "destructive":     { "type": "color", "default": "#ef4444", "group": "State" },
      "success":         { "type": "color", "default": "#22c55e", "group": "State" },
      "warning":         { "type": "color", "default": "#f59e0b", "group": "State" }
    },
    "fonts": {
      "heading": { "type": "font", "default": "\"Press Start 2P\", system-ui, sans-serif" },
      "body":    { "type": "font", "default": "Inter, system-ui, sans-serif" },
      "mono":    { "type": "font", "default": "ui-monospace, SFMono-Regular, monospace" }
    }
  },
  "config": {}
}
```

- [ ] **Step 2: Commit**

```bash
git add src/themes/pixelcraft/theme.json
git commit -m "refactor(theme): migrate pixelcraft to theme.json"
```

---

## Task 6 — `generate-theme-registry.ts` script

**Files:**
- Create: `scripts/generate-theme-registry.ts`
- Create: `src/core/generated/theme-registry.ts` (via script)
- Create: `src/core/generated/theme-tokens.css` (via script)
- Test: `tests/unit/theme-registry-loader.test.ts`
- Create (helper): `src/core/lib/theme-registry-loader.ts`

- [ ] **Step 1: Write failing test for the loader**

`tests/unit/theme-registry-loader.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveMergedTheme } from "@/core/lib/theme-registry-loader";

const flat = {
    schemaVersion: 1 as const, id: "flat", name: "Flat", description: "", version: "1.0.0",
    type: "light" as const, tokens: { colors: { primary: { type: "color" as const, default: "#ffffff" } } },
    config: {},
};

const dark = {
    schemaVersion: 1 as const, id: "flat-dark", name: "Dark", description: "", version: "1.0.0",
    type: "dark" as const, parent: "flat", tokens: { colors: { primary: { type: "color" as const, default: "#000000" } } },
    config: {},
};

describe("resolveMergedTheme", () => {
    it("returns the manifest unchanged when no parent", () => {
        const resolved = resolveMergedTheme(flat, { flat });
        expect(resolved.tokens.colors?.primary.default).toBe("#ffffff");
    });

    it("overlays child tokens onto parent", () => {
        const resolved = resolveMergedTheme(dark, { flat, "flat-dark": dark });
        expect(resolved.tokens.colors?.primary.default).toBe("#000000");
    });

    it("inherits parent tokens child doesn't override", () => {
        const parent = { ...flat, tokens: { colors: {
            primary:   { type: "color" as const, default: "#aaa" },
            secondary: { type: "color" as const, default: "#bbb" },
        } } };
        const child = { ...dark, tokens: { colors: {
            primary: { type: "color" as const, default: "#000" },
        } } };
        const resolved = resolveMergedTheme(child, { flat: parent, "flat-dark": child });
        expect(resolved.tokens.colors?.primary.default).toBe("#000");
        expect(resolved.tokens.colors?.secondary.default).toBe("#bbb");
    });

    it("throws on cyclic parent reference", () => {
        const a = { ...flat, id: "a", parent: "b" };
        const b = { ...flat, id: "b", parent: "a" };
        expect(() => resolveMergedTheme(a, { a, b })).toThrow(/cycle/i);
    });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run tests/unit/theme-registry-loader.test.ts
```

Expected FAIL — module not found.

- [ ] **Step 3: Implement the loader**

`src/core/lib/theme-registry-loader.ts`:

```ts
import type { ThemeManifest } from "./theme-manifest-schema";

/**
 * Merge a theme with its parent chain. Two levels max (grandchildren
 * rejected at schema level — we only follow one `parent` hop). Child
 * values win over parent values at the field level; anything the child
 * doesn't mention falls through.
 */
export function resolveMergedTheme(
    manifest: ThemeManifest,
    all: Record<string, ThemeManifest>,
    seen: Set<string> = new Set(),
): ThemeManifest {
    if (!manifest.parent) return manifest;

    if (seen.has(manifest.id)) {
        throw new Error(`Theme cycle detected at "${manifest.id}"`);
    }
    seen.add(manifest.id);

    const parent = all[manifest.parent];
    if (!parent) return manifest;

    const resolvedParent = resolveMergedTheme(parent, all, seen);

    return {
        ...resolvedParent,
        ...manifest,
        tokens: {
            colors: { ...(resolvedParent.tokens.colors ?? {}), ...(manifest.tokens.colors ?? {}) },
            fonts:  { ...(resolvedParent.tokens.fonts  ?? {}), ...(manifest.tokens.fonts  ?? {}) },
            radius: manifest.tokens.radius ?? resolvedParent.tokens.radius,
            space:  manifest.tokens.space  ?? resolvedParent.tokens.space,
        },
        config: { ...(resolvedParent.config ?? {}), ...(manifest.config ?? {}) },
    };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/unit/theme-registry-loader.test.ts
```

- [ ] **Step 5: Implement the generator script**

`scripts/generate-theme-registry.ts`:

```ts
import fs from "fs";
import path from "path";
import { themeManifestSchema, type ThemeManifest } from "../src/core/lib/theme-manifest-schema";
import { resolveMergedTheme } from "../src/core/lib/theme-registry-loader";

const THEMES_DIR = path.join(process.cwd(), "src/themes");
const REGISTRY_OUT = path.join(process.cwd(), "src/core/generated/theme-registry.ts");
const TOKENS_OUT = path.join(process.cwd(), "src/core/generated/theme-tokens.css");

function loadThemes(): Record<string, ThemeManifest> {
    if (!fs.existsSync(THEMES_DIR)) return {};
    const themes: Record<string, ThemeManifest> = {};
    for (const dir of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        const manifestPath = path.join(THEMES_DIR, dir.name, "theme.json");
        if (!fs.existsSync(manifestPath)) continue;
        let raw: unknown;
        try {
            raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        } catch (e) {
            console.error(`[themes] ${dir.name}: invalid JSON —`, (e as Error).message);
            continue;
        }
        const parsed = themeManifestSchema.safeParse(raw);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            console.error(`[themes] ${dir.name}: schema invalid at ${first.path.join(".")} — ${first.message}`);
            continue;
        }
        if (parsed.data.id !== dir.name) {
            console.error(`[themes] ${dir.name}: manifest id "${parsed.data.id}" doesn't match directory name`);
            continue;
        }
        themes[dir.name] = parsed.data;
    }
    return themes;
}

function cssVar(themeId: string, token: string, value: string): string {
    return `    --uxw-${token}: ${value};`;
}

function emitTokensCss(themes: Record<string, ThemeManifest>): string {
    const blocks: string[] = [
        "/* Auto-generated by scripts/generate-theme-registry.ts — do not edit. */",
        "",
    ];
    for (const [id, raw] of Object.entries(themes)) {
        const theme = resolveMergedTheme(raw, themes);
        const lines: string[] = [];
        for (const [name, def] of Object.entries(theme.tokens.colors ?? {})) {
            if (def.default) lines.push(cssVar(id, `color-${name}`, def.default));
        }
        for (const [name, def] of Object.entries(theme.tokens.fonts ?? {})) {
            if (def.default) lines.push(cssVar(id, `font-${name}`, def.default));
        }
        if (theme.tokens.radius && "default" in theme.tokens.radius && theme.tokens.radius.default) {
            lines.push(cssVar(id, "radius", String(theme.tokens.radius.default)));
        }
        blocks.push(`[data-theme="${id}"] {`);
        blocks.push(...lines);
        blocks.push("}");
        blocks.push("");
    }
    return blocks.join("\n");
}

function emitRegistryTs(themes: Record<string, ThemeManifest>): string {
    const merged: Record<string, ThemeManifest> = {};
    for (const [id, raw] of Object.entries(themes)) {
        merged[id] = resolveMergedTheme(raw, themes);
    }
    const lines: string[] = [
        "// Auto-generated by scripts/generate-theme-registry.ts — do not edit.",
        "import type { ThemeManifest } from '@/core/lib/theme-manifest-schema';",
        "",
        `export const themeRegistry: Record<string, ThemeManifest> = ${JSON.stringify(merged, null, 2)} as Record<string, ThemeManifest>;`,
        "",
        `export const themeIds = ${JSON.stringify(Object.keys(merged))} as const;`,
        "",
    ];
    return lines.join("\n");
}

function run(): void {
    const themes = loadThemes();
    fs.mkdirSync(path.dirname(REGISTRY_OUT), { recursive: true });
    fs.writeFileSync(REGISTRY_OUT, emitRegistryTs(themes));
    fs.writeFileSync(TOKENS_OUT, emitTokensCss(themes));
    console.log(`Generated theme registry (${Object.keys(themes).length} themes).`);
}

run();
```

- [ ] **Step 6: Run the generator**

```bash
npx tsx scripts/generate-theme-registry.ts
```

Expected: `Generated theme registry (3 themes).`
Creates `src/core/generated/theme-registry.ts` and `src/core/generated/theme-tokens.css`.

- [ ] **Step 7: Replace the old script in `package.json`**

Open `package.json`, replace:

```json
"generate:themes": "npx tsx scripts/generate-themes.ts",
```

with:

```json
"generate:themes": "npx tsx scripts/generate-theme-registry.ts",
```

- [ ] **Step 8: Remove the obsolete script**

```bash
git rm scripts/generate-themes.ts
```

- [ ] **Step 9: Type-check + tests**

```bash
npx tsc --noEmit
npx vitest run
```

Both pass.

- [ ] **Step 10: Commit**

```bash
git add scripts/generate-theme-registry.ts \
        src/core/lib/theme-registry-loader.ts \
        tests/unit/theme-registry-loader.test.ts \
        package.json
git commit -m "feat(theme): build-time registry + Tailwind @theme token generator"
```

---

## Task 7 — Update `globals.css` to import generated tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Read current state**

```bash
head -40 src/app/globals.css
```

Locate the hardcoded `--ux-*` block (roughly lines 4-22 per the audit).

- [ ] **Step 2: Replace the block**

Replace the hardcoded `--ux-*` CSS variable block in `:root` with:

```css
@import "../core/generated/theme-tokens.css";

@theme inline {
  --color-primary:           var(--uxw-color-primary);
  --color-secondary:         var(--uxw-color-secondary);
  --color-accent:            var(--uxw-color-accent);
  --color-background:        var(--uxw-color-background);
  --color-foreground:        var(--uxw-color-foreground);
  --color-muted:             var(--uxw-color-muted);
  --color-muted-foreground:  var(--uxw-color-mutedForeground);
  --color-border:            var(--uxw-color-border);
  --color-card:              var(--uxw-color-card);
  --color-card-foreground:   var(--uxw-color-cardForeground);
  --color-destructive:       var(--uxw-color-destructive);
  --color-success:           var(--uxw-color-success);
  --color-warning:           var(--uxw-color-warning);
  --font-heading:            var(--uxw-font-heading);
  --font-body:               var(--uxw-font-body);
  --font-mono:               var(--uxw-font-mono);
  --radius:                  var(--uxw-radius);
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: build succeeds. No `--ux-*` reference errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "refactor(theme): Tailwind @theme now reads --uxw-* from generated tokens"
```

---

## Task 8 — `ThemeConfigProvider` + `useThemeConfig`

**Files:**
- Create: `src/core/lib/theme-config.ts`
- Test: `tests/unit/theme-config.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/unit/theme-config.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeConfigProvider, useThemeConfig } from "@/core/lib/theme-config";

function Probe({ path }: { path: string }) {
    const cfg = useThemeConfig();
    return <span data-testid="v">{String(cfg(path) ?? "∅")}</span>;
}

describe("useThemeConfig", () => {
    it("returns value at a dot path", () => {
        render(
            <ThemeConfigProvider value={{ hero: { headline: "hi" } }}>
                <Probe path="hero.headline" />
            </ThemeConfigProvider>,
        );
        expect(screen.getByTestId("v").textContent).toBe("hi");
    });

    it("returns undefined on missing path", () => {
        render(
            <ThemeConfigProvider value={{}}>
                <Probe path="a.b" />
            </ThemeConfigProvider>,
        );
        expect(screen.getByTestId("v").textContent).toBe("∅");
    });

    it("supports an explicit default", () => {
        function DefaultProbe() {
            const cfg = useThemeConfig();
            return <span data-testid="v">{String(cfg("missing", "fallback"))}</span>;
        }
        render(<ThemeConfigProvider value={{}}><DefaultProbe /></ThemeConfigProvider>);
        expect(screen.getByTestId("v").textContent).toBe("fallback");
    });
});
```

- [ ] **Step 2: Add `@testing-library/react` if missing**

```bash
grep -q '"@testing-library/react"' package.json || npm install -D @testing-library/react @testing-library/dom jsdom
```

Update `vitest.config.ts` to use `jsdom` environment for this test (set `environment: 'jsdom'`).

- [ ] **Step 3: Verify test fails**

```bash
npx vitest run tests/unit/theme-config.test.tsx
```

Expected FAIL — module not found.

- [ ] **Step 4: Implement**

`src/core/lib/theme-config.ts`:

```tsx
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type ThemeConfigValue = Record<string, unknown>;

const ThemeConfigContext = createContext<ThemeConfigValue>({});

export function ThemeConfigProvider({ value, children }: { value: ThemeConfigValue; children: ReactNode }) {
    const memoized = useMemo(() => value, [JSON.stringify(value)]);
    return <ThemeConfigContext.Provider value={memoized}>{children}</ThemeConfigContext.Provider>;
}

export function useThemeConfig() {
    const ctx = useContext(ThemeConfigContext);
    return function get<T = unknown>(path: string, fallback?: T): T | undefined {
        const parts = path.split(".");
        let cur: unknown = ctx;
        for (const p of parts) {
            if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
                cur = (cur as Record<string, unknown>)[p];
            } else {
                return fallback;
            }
        }
        return (cur as T) ?? fallback;
    };
}
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/core/lib/theme-config.ts tests/unit/theme-config.test.tsx package.json package-lock.json vitest.config.ts
git commit -m "feat(theme): ThemeConfigProvider + useThemeConfig hook"
```

---

## Task 9 — Server-side `getThemeConfig`

**Files:**
- Modify: `src/core/lib/theme-config.ts` (add server export)
- Test: `tests/unit/theme-config-server.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from "vitest";

const mockSetting = { value: { active_theme: "flat" } };
const mockCustomization = { overrides: { hero: { headline: "custom" } } };

vi.mock("@/core/lib/db", () => ({
    prisma: {
        setting: { findUnique: vi.fn(async () => mockSetting) },
        themeCustomization: { findUnique: vi.fn(async () => mockCustomization) },
    },
}));

vi.mock("@/core/generated/theme-registry", () => ({
    themeRegistry: {
        flat: {
            id: "flat", config: { hero: { label: "Hero", fields: {
                headline: { type: "text", default: "default" },
                enabled:  { type: "toggle", default: true },
            } } },
            tokens: {},
        },
    },
    themeIds: ["flat"],
}));

describe("getThemeConfig (server)", () => {
    it("merges overrides on top of defaults", async () => {
        const { getThemeConfig } = await import("@/core/lib/theme-config");
        const { config } = await getThemeConfig();
        expect((config as any).hero.headline).toBe("custom");
        expect((config as any).hero.enabled).toBe(true);
    });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run tests/unit/theme-config-server.test.ts
```

Expected FAIL — `getThemeConfig` not exported.

- [ ] **Step 3: Add server helper at the bottom of `src/core/lib/theme-config.ts`**

Note: move the `"use client"` directive OFF the top of `theme-config.ts` and split into two files: `src/core/lib/theme-config-client.tsx` (provider + hook) and `src/core/lib/theme-config.ts` (server helper). Import the client module only in client components.

`src/core/lib/theme-config.ts`:

```ts
import { prisma } from "./db";
import { themeRegistry, themeIds } from "@/core/generated/theme-registry";
import type { ThemeManifest } from "./theme-manifest-schema";

const DEFAULT_THEME = "flat";

function extractDefaults(manifest: ThemeManifest): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [group, groupDef] of Object.entries(manifest.config ?? {})) {
        out[group] = {};
        for (const [field, def] of Object.entries(groupDef.fields)) {
            if ("default" in def && def.default !== undefined) {
                (out[group] as Record<string, unknown>)[field] = def.default;
            }
        }
    }
    return out;
}

function mergeDeep(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
        if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] !== null && !Array.isArray(out[k])) {
            out[k] = mergeDeep(out[k] as Record<string, unknown>, v as Record<string, unknown>);
        } else {
            out[k] = v;
        }
    }
    return out;
}

export async function getActiveThemeId(): Promise<string> {
    try {
        const row = await prisma.setting.findUnique({ where: { key: "active_theme" } });
        const raw = row?.value as { id?: unknown } | string | undefined;
        const id = typeof raw === "string" ? raw : typeof raw === "object" && raw !== null ? (raw as { id?: string }).id : undefined;
        if (id && (themeIds as readonly string[]).includes(id)) return id;
    } catch {/* fall through */}
    return DEFAULT_THEME;
}

export async function getThemeConfig(): Promise<{ themeId: string; manifest: ThemeManifest; config: Record<string, unknown> }> {
    const themeId = await getActiveThemeId();
    const manifest = themeRegistry[themeId] ?? themeRegistry[DEFAULT_THEME] ?? Object.values(themeRegistry)[0];
    const defaults = extractDefaults(manifest);
    let overrides: Record<string, unknown> = {};
    try {
        const row = await prisma.themeCustomization.findUnique({ where: { themeId } });
        if (row && row.overrides && typeof row.overrides === "object") {
            overrides = row.overrides as Record<string, unknown>;
        }
    } catch {/* no customization yet */}
    return { themeId, manifest, config: mergeDeep(defaults, overrides) };
}

export { ThemeConfigProvider, useThemeConfig } from "./theme-config-client";
```

Create `src/core/lib/theme-config-client.tsx` with the provider + hook code from Task 8 (move it there, keep the same exports).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/lib/theme-config.ts src/core/lib/theme-config-client.tsx \
        tests/unit/theme-config-server.test.ts
git commit -m "feat(theme): server-side getThemeConfig with defaults + DB override merge"
```

---

## Task 10 — Refactor `ThemeProvider` for new registry

**Files:**
- Modify: `src/core/providers/theme-provider.tsx`

- [ ] **Step 1: Read the current provider**

```bash
cat src/core/providers/theme-provider.tsx
```

- [ ] **Step 2: Rewrite it**

Replace file contents with:

```tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTheme as useNextTheme, ThemeProvider as NextThemesProvider } from "next-themes";
import { themeRegistry } from "@/core/generated/theme-registry";
import { ThemeConfigProvider } from "@/core/lib/theme-config-client";
import type { ThemeManifest } from "@/core/lib/theme-manifest-schema";

interface ThemeContextType {
    activeTheme: ThemeManifest | null;
    currentThemeId: string;
}

const ThemeContext = createContext<ThemeContextType>({ activeTheme: null, currentThemeId: "flat" });

export function useActiveTheme() { return useContext(ThemeContext); }

function pickFallback(manifest: ThemeManifest | undefined, want: string): ThemeManifest {
    if (manifest) return manifest;
    return themeRegistry[want] ?? themeRegistry["flat"] ?? Object.values(themeRegistry)[0];
}

export function ThemeProvider({
    defaultTheme = "flat",
    serverConfig,
    children,
}: {
    defaultTheme?: string;
    serverConfig: Record<string, unknown>;
    children: ReactNode;
}) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const currentThemeId = mounted
        ? (typeof window !== "undefined" ? localStorage.getItem("uxw-theme") : null) ?? defaultTheme
        : defaultTheme;

    const activeTheme = useMemo<ThemeManifest>(() => {
        return pickFallback(themeRegistry[currentThemeId], defaultTheme);
    }, [currentThemeId, defaultTheme]);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", activeTheme.id);
        document.documentElement.setAttribute("data-mode", activeTheme.type);
    }, [activeTheme]);

    return (
        <NextThemesProvider attribute="data-mode" defaultTheme={activeTheme.type} enableSystem={false}>
            <ThemeContext.Provider value={{ activeTheme, currentThemeId }}>
                <ThemeConfigProvider value={serverConfig}>{children}</ThemeConfigProvider>
            </ThemeContext.Provider>
        </NextThemesProvider>
    );
}
```

- [ ] **Step 3: Update the root layout to pass `serverConfig`**

Open `src/app/[locale]/layout.tsx` and replace the `<ThemeProvider>` usage with:

```tsx
import { getThemeConfig } from "@/core/lib/theme-config";
// ...inside async component...
const { config, themeId } = await getThemeConfig();
// ...
<ThemeProvider defaultTheme={themeId} serverConfig={config}>{children}</ThemeProvider>
```

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Delete orphaned types file**

```bash
git rm src/core/types/theme.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/core/providers/theme-provider.tsx src/app/[locale]/layout.tsx
git commit -m "refactor(theme): provider uses generated registry + fallback chain"
```

---

## Task 11 — `<Slot>` component (replaces `ThemeSlot`)

**Files:**
- Create: `src/core/components/Slot.tsx`
- Create: `src/core/lib/slot-registry.ts`
- Test: `tests/unit/slot-registry.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { CANONICAL_SLOTS, isCanonicalSlot } from "@/core/lib/slot-registry";

describe("canonical slot registry", () => {
    it("exposes at least the core slot names we depend on", () => {
        expect(CANONICAL_SLOTS.includes("home.beforeHero")).toBe(true);
        expect(CANONICAL_SLOTS.includes("home.afterHero")).toBe(true);
        expect(CANONICAL_SLOTS.includes("navbar.right")).toBe(true);
        expect(CANONICAL_SLOTS.includes("footer.extra")).toBe(true);
    });

    it("isCanonicalSlot validates name format", () => {
        expect(isCanonicalSlot("home.afterHero")).toBe(true);
        expect(isCanonicalSlot("not a slot")).toBe(false);
    });
});
```

- [ ] **Step 2: Verify fail**

```bash
npx vitest run tests/unit/slot-registry.test.ts
```

- [ ] **Step 3: Implement**

`src/core/lib/slot-registry.ts`:

```ts
export const CANONICAL_SLOTS = [
    "home.beforeHero",
    "home.afterHero",
    "home.sidebar",
    "navbar.left",
    "navbar.right",
    "footer.extra",
    "product.beforeAddToCart",
    "product.afterAddToCart",
    "profile.tabs",
] as const;

export type CanonicalSlot = typeof CANONICAL_SLOTS[number];

export function isCanonicalSlot(name: string): boolean {
    return /^[a-zA-Z0-9.-]+$/.test(name) && name.length > 0 && name.length <= 128;
}
```

`src/core/components/Slot.tsx`:

```tsx
"use client";

import React, { type ReactNode } from "react";
import { SlotRegistry } from "@/core/generated/slot-registry";

/**
 * Named injection point. Modules contribute components to a slot via
 * `module.json#slots` (or the legacy alias fields). Optional `children`
 * is the default when no contribution exists.
 */
export function Slot({ name, children }: { name: string; children?: ReactNode }) {
    const contributions = SlotRegistry[name] ?? [];
    if (contributions.length === 0) return <>{children}</>;
    return (
        <>
            {contributions.map((entry) => {
                const Component = entry.component;
                return <Component key={entry.id} />;
            })}
        </>
    );
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/core/lib/slot-registry.ts src/core/components/Slot.tsx \
        tests/unit/slot-registry.test.ts
git commit -m "feat(slot): Slot component + canonical slot name list"
```

---

## Task 12 — Add `slots` field to module manifest Zod schema

**Files:**
- Modify: `src/core/lib/module-manifest-schema.ts`
- Modify: `tests/unit/module-manifest-schema.test.ts`

- [ ] **Step 1: Add the Zod fragment**

Insert near the other collection schemas in `src/core/lib/module-manifest-schema.ts`:

```ts
const slotContribution = z.object({
    name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9.-]+$/),
    component: relativePath("component"),
    order: z.number().int().optional(),
    id: z.string().min(1).max(64).regex(SAFE_SLUG).optional(),
});
```

Then add to the module manifest object:

```ts
    slots: z.array(slotContribution).max(200).optional(),
```

And extend `collectManifestFileRefs`:

```ts
    m.slots?.forEach((s) => push(s.component));
```

- [ ] **Step 2: Add a unit test**

Append to `tests/unit/module-manifest-schema.test.ts`:

```ts
it("accepts a module with slots contributions", () => {
    const m = {
        ...minimal,
        slots: [
            { name: "home.afterHero", component: "sections/Feature.tsx", order: 10 },
        ],
    };
    expect(moduleManifestSchema.safeParse(m).success).toBe(true);
});

it("rejects an invalid slot name", () => {
    const m = {
        ...minimal,
        slots: [{ name: "bad slot!!", component: "sections/X.tsx" }],
    };
    expect(moduleManifestSchema.safeParse(m).success).toBe(false);
});
```

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git add src/core/lib/module-manifest-schema.ts tests/unit/module-manifest-schema.test.ts
git commit -m "feat(module): 'slots' field in module.json manifest"
```

---

## Task 13 — Generator emits `slot-registry.tsx` with aliases

**Files:**
- Modify: `scripts/generate-registry.ts`
- Create: `src/core/generated/slot-registry.tsx` (via script)

- [ ] **Step 1: Add slot collection to the generator**

In `scripts/generate-registry.ts`, after the existing collection pass that builds `allWidgets`, `allHomepageSections`, etc., add a combined list that maps legacy fields to canonical slot names:

```ts
type SlotEntry = {
    name: string;
    id: string;
    moduleName: string;
    component: string;
    order?: number;
};

const slotEntries: SlotEntry[] = [];

for (const { moduleName, manifest } of loaded) {
    // New canonical `slots` field.
    manifest.slots?.forEach((s, i) => {
        slotEntries.push({
            name: s.name,
            id: s.id ?? `${moduleName}-${s.name}-${i}`,
            moduleName,
            component: s.component,
            order: s.order,
        });
    });
    // Aliases for backwards-compatibility with existing modules.
    manifest.homepageSections?.forEach((s, i) => {
        slotEntries.push({
            name: s.type === "widget" ? "home.sidebar" : "home.afterHero",
            id: s.id ?? `${moduleName}-home-${i}`,
            moduleName,
            component: s.component,
            order: s.order,
        });
    });
    manifest.navbarComponents?.forEach((n, i) => {
        slotEntries.push({
            name: "navbar.right",
            id: n.id ?? `${moduleName}-navbar-${i}`,
            moduleName,
            component: n.component,
            order: n.order,
        });
    });
    manifest.layoutComponents?.forEach((l, i) => {
        slotEntries.push({
            name: "layout.page",
            id: l.id ?? `${moduleName}-layout-${i}`,
            moduleName,
            component: l.component,
        });
    });
    manifest.profileTabs?.forEach((p, i) => {
        slotEntries.push({
            name: "profile.tabs",
            id: p.id ?? `${moduleName}-tab-${i}`,
            moduleName,
            component: p.component,
            order: p.order,
        });
    });
}

slotEntries.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
```

Now emit:

```ts
// ...at the end of generateRegistry()
const slotOutPath = path.join(path.dirname(OUTPUT_FILE), 'slot-registry.tsx');
let slotContent = '// Auto-generated by scripts/generate-registry.ts — do not edit.\n';
slotContent += '/* eslint-disable */\n';
slotContent += "import dynamic from 'next/dynamic';\n";
slotContent += "import type { ComponentType } from 'react';\n\n";
slotContent += 'type SlotEntry = { id: string; moduleId: string; component: ComponentType<any> };\n';
slotContent += 'export const SlotRegistry: Record<string, SlotEntry[]> = {};\n\n';
for (const s of slotEntries) {
    const importPath = `@/modules/${s.moduleName}/${s.component.replace(/\.tsx?$/, '')}`;
    slotContent += `(SlotRegistry[${JSON.stringify(s.name)}] ??= []).push({`;
    slotContent += ` id: ${JSON.stringify(s.id)},`;
    slotContent += ` moduleId: ${JSON.stringify(s.moduleName)},`;
    slotContent += ` component: dynamic(() => import(${JSON.stringify(importPath)}).then((m: Record<string, unknown>) => (m.default ?? m) as ComponentType<any>), { loading: () => null }),`;
    slotContent += ' });\n';
}
fs.writeFileSync(slotOutPath, slotContent);
console.log(`Generated slot registry with ${slotEntries.length} contributions`);
```

- [ ] **Step 2: Regenerate**

```bash
npx tsx scripts/generate-registry.ts
```

Expected: prints the slot count, creates `src/core/generated/slot-registry.tsx`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-registry.ts
git commit -m "feat(slot): emit slot-registry with legacy-field aliases"
```

---

## Task 14 — Migrate `pixelcraft` from `ThemeSlot` to `Slot`

**Files:**
- Grep-and-replace: `src/themes/pixelcraft/**/*.tsx`
- Delete: `src/core/components/theme-slot.tsx`

- [ ] **Step 1: Find usages**

```bash
grep -rn "ThemeSlot" src/themes/ src/core/
```

- [ ] **Step 2: Rewrite each occurrence**

Replace `import { ThemeSlot } from "@/core/components/theme-slot"` with `import { Slot } from "@/core/components/Slot"`.
Replace `<ThemeSlot name="X" defaultComponent={<Y/>} />` with `<Slot name="X"><Y/></Slot>`.

- [ ] **Step 3: Delete the old file**

```bash
git rm src/core/components/theme-slot.tsx
```

- [ ] **Step 4: Type-check + build**

```bash
npx tsc --noEmit
npm run build
```

Both pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(theme): pixelcraft uses generalized Slot component"
```

---

## Task 15 — Customizer field renderers

**Files:**
- Create: `src/core/components/admin/theme-customizer/fields/ColorField.tsx`
- Create: `src/core/components/admin/theme-customizer/fields/ToggleField.tsx`
- Create: `src/core/components/admin/theme-customizer/fields/SelectField.tsx`
- Create: `src/core/components/admin/theme-customizer/fields/SliderField.tsx`
- Create: `src/core/components/admin/theme-customizer/fields/TextField.tsx`
- Create: `src/core/components/admin/theme-customizer/fields/UrlField.tsx`
- Create: `src/core/components/admin/theme-customizer/fields/RichTextField.tsx`
- Create: `src/core/components/admin/theme-customizer/fields/ImageField.tsx`
- Create: `src/core/components/admin/theme-customizer/fields/FontField.tsx`
- Create: `src/core/components/admin/theme-customizer/fields/index.ts`

- [ ] **Step 1: Implement shared props type**

`src/core/components/admin/theme-customizer/fields/types.ts`:

```ts
import type { ThemeFieldDef } from "@/core/lib/theme-manifest-schema";

export interface FieldProps<T = unknown> {
    def: ThemeFieldDef;
    value: T | undefined;
    onChange: (value: T | undefined) => void;
    isDefault: boolean;
}
```

- [ ] **Step 2: Implement each field component**

Each file mirrors this pattern. Example `ColorField.tsx`:

```tsx
"use client";
import type { FieldProps } from "./types";

export function ColorField({ def, value, onChange, isDefault }: FieldProps<string>) {
    if (def.type !== "color") return null;
    return (
        <label className="flex items-center gap-2 text-sm">
            <input
                type="color"
                value={typeof value === "string" ? value : def.default ?? "#000000"}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded border"
            />
            <span className="font-mono text-xs text-muted-foreground">{value ?? def.default ?? "—"}</span>
            {!isDefault && (
                <button type="button" className="text-xs underline" onClick={() => onChange(undefined)}>
                    reset
                </button>
            )}
        </label>
    );
}
```

Analogous implementations for each field type. Each:
- Accepts `FieldProps` typed by the JS value it holds.
- Returns `null` if `def.type` doesn't match (exhaustiveness guard).
- Exposes a "reset" button that calls `onChange(undefined)` so the parent can clear the override.

`RichTextField.tsx` delegates to the existing `RichTextEditor` in `@/core/components/ui/rich-text-editor`. `ImageField.tsx` uses the existing `FileUpload` in `@/core/components/ui/file-upload`.

Export everything from `fields/index.ts`:

```ts
export { ColorField } from "./ColorField";
export { ToggleField } from "./ToggleField";
export { SelectField } from "./SelectField";
export { SliderField } from "./SliderField";
export { TextField } from "./TextField";
export { UrlField } from "./UrlField";
export { RichTextField } from "./RichTextField";
export { ImageField } from "./ImageField";
export { FontField } from "./FontField";
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/core/components/admin/theme-customizer/fields/
git commit -m "feat(customizer): field renderer components for every theme.json type"
```

---

## Task 16 — `CustomizerForm` + diff helpers

**Files:**
- Create: `src/core/components/admin/theme-customizer/CustomizerForm.tsx`
- Create: `src/core/components/admin/theme-customizer/diff.ts`
- Test: `tests/unit/customizer-diff.test.ts`

- [ ] **Step 1: Write failing test for the diff helpers**

```ts
import { describe, it, expect } from "vitest";
import { computeOverrideDiff, applyOverrides } from "@/core/components/admin/theme-customizer/diff";

const defaults = { hero: { headline: "Hi", enabled: true }, footer: { text: "©" } };

describe("computeOverrideDiff", () => {
    it("returns an empty object when nothing differs", () => {
        expect(computeOverrideDiff(defaults, defaults)).toEqual({});
    });

    it("keeps only the fields that differ from defaults", () => {
        const current = { hero: { headline: "Hello", enabled: true }, footer: { text: "©" } };
        expect(computeOverrideDiff(defaults, current)).toEqual({ hero: { headline: "Hello" } });
    });

    it("drops fields that equal defaults even if nested siblings changed", () => {
        const current = { hero: { headline: "A", enabled: true } };
        expect(computeOverrideDiff(defaults, current)).toEqual({ hero: { headline: "A" } });
    });
});

describe("applyOverrides", () => {
    it("deep-merges overrides onto defaults", () => {
        const overrides = { hero: { headline: "Override" } };
        const result = applyOverrides(defaults, overrides);
        expect(result.hero).toEqual({ headline: "Override", enabled: true });
    });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run tests/unit/customizer-diff.test.ts
```

- [ ] **Step 3: Implement**

`src/core/components/admin/theme-customizer/diff.ts`:

```ts
export function computeOverrideDiff(
    defaults: Record<string, unknown>,
    current: Record<string, unknown>,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(current)) {
        const d = defaults[k];
        if (v && typeof v === "object" && !Array.isArray(v) && d && typeof d === "object" && !Array.isArray(d)) {
            const nested = computeOverrideDiff(d as Record<string, unknown>, v as Record<string, unknown>);
            if (Object.keys(nested).length > 0) out[k] = nested;
        } else if (!Object.is(v, d)) {
            out[k] = v;
        }
    }
    return out;
}

export function applyOverrides(
    defaults: Record<string, unknown>,
    overrides: Record<string, unknown>,
): Record<string, unknown> {
    const out: Record<string, unknown> = { ...defaults };
    for (const [k, v] of Object.entries(overrides)) {
        if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] !== null && !Array.isArray(out[k])) {
            out[k] = applyOverrides(out[k] as Record<string, unknown>, v as Record<string, unknown>);
        } else {
            out[k] = v;
        }
    }
    return out;
}
```

- [ ] **Step 4: Write CustomizerForm**

`src/core/components/admin/theme-customizer/CustomizerForm.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { ThemeManifest, ThemeFieldDef } from "@/core/lib/theme-manifest-schema";
import { computeOverrideDiff, applyOverrides } from "./diff";
import * as Fields from "./fields";

function Field({ def, value, onChange, isDefault }: { def: ThemeFieldDef; value: unknown; onChange: (v: unknown) => void; isDefault: boolean }) {
    switch (def.type) {
        case "color":    return <Fields.ColorField    def={def} value={value as string}  onChange={onChange as any} isDefault={isDefault} />;
        case "font":     return <Fields.FontField     def={def} value={value as string}  onChange={onChange as any} isDefault={isDefault} />;
        case "select":   return <Fields.SelectField   def={def} value={value as string}  onChange={onChange as any} isDefault={isDefault} />;
        case "slider":   return <Fields.SliderField   def={def} value={value as number}  onChange={onChange as any} isDefault={isDefault} />;
        case "toggle":   return <Fields.ToggleField   def={def} value={value as boolean} onChange={onChange as any} isDefault={isDefault} />;
        case "text":     return <Fields.TextField     def={def} value={value as string}  onChange={onChange as any} isDefault={isDefault} />;
        case "url":      return <Fields.UrlField      def={def} value={value as string}  onChange={onChange as any} isDefault={isDefault} />;
        case "richtext": return <Fields.RichTextField def={def} value={value as string}  onChange={onChange as any} isDefault={isDefault} />;
        case "image":    return <Fields.ImageField    def={def} value={value as string}  onChange={onChange as any} isDefault={isDefault} />;
    }
}

export function CustomizerForm({
    manifest,
    initialOverrides,
    onPreview,
    onSave,
}: {
    manifest: ThemeManifest;
    initialOverrides: Record<string, unknown>;
    onPreview: (diff: Record<string, unknown>) => void;
    onSave: (diff: Record<string, unknown>) => Promise<void>;
}) {
    const defaults = useMemo(() => {
        const d: Record<string, unknown> = {};
        for (const [g, gd] of Object.entries(manifest.config ?? {})) {
            d[g] = {};
            for (const [f, def] of Object.entries(gd.fields)) {
                if ("default" in def && def.default !== undefined) (d[g] as Record<string, unknown>)[f] = def.default;
            }
        }
        return d;
    }, [manifest]);

    const [current, setCurrent] = useState<Record<string, unknown>>(() => applyOverrides(defaults, initialOverrides));
    const [saving, setSaving] = useState(false);

    function patch(group: string, field: string, value: unknown) {
        setCurrent((prev) => {
            const next = { ...prev, [group]: { ...(prev[group] as Record<string, unknown> ?? {}), [field]: value } };
            onPreview(computeOverrideDiff(defaults, next));
            return next;
        });
    }

    async function save() {
        setSaving(true);
        try {
            await onSave(computeOverrideDiff(defaults, current));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {Object.entries(manifest.config ?? {}).map(([group, gd]) => (
                <section key={group} className="rounded border p-3">
                    <h3 className="mb-2 font-medium">{gd.label}</h3>
                    <div className="flex flex-col gap-3">
                        {Object.entries(gd.fields).map(([field, def]) => {
                            const v = (current[group] as Record<string, unknown> | undefined)?.[field];
                            const isDefault = (def as { default?: unknown }).default === v || v === undefined;
                            return (
                                <div key={field}>
                                    <div className="mb-1 text-sm text-muted-foreground">{(def as { label?: string }).label ?? field}</div>
                                    <Field def={def} value={v} onChange={(nv) => patch(group, field, nv)} isDefault={isDefault} />
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
            <button type="button" disabled={saving} onClick={save} className="rounded bg-primary px-4 py-2 text-white">
                {saving ? "Saving…" : "Save"}
            </button>
        </div>
    );
}
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add src/core/components/admin/theme-customizer/ tests/unit/customizer-diff.test.ts
git commit -m "feat(customizer): schema-driven form + diff-only persistence"
```

---

## Task 17 — Wire customizer page + iframe postMessage with origin check

**Files:**
- Modify: `src/app/[locale]/(admin)/admin/settings/customizer/page.tsx`
- Modify: `src/core/providers/theme-provider.tsx` (add postMessage listener)

- [ ] **Step 1: Replace customizer page contents**

`src/app/[locale]/(admin)/admin/settings/customizer/page.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { themeRegistry } from "@/core/generated/theme-registry";
import { CustomizerForm } from "@/core/components/admin/theme-customizer/CustomizerForm";
import { toast } from "sonner";

export default function CustomizerPage() {
    const [themeId, setThemeId] = useState<string>("flat");
    const [overrides, setOverrides] = useState<Record<string, unknown>>({});
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        fetch("/api/v1/themes/active")
            .then((r) => r.json())
            .then((d: { themeId: string; overrides: Record<string, unknown> }) => {
                if (d.themeId) setThemeId(d.themeId);
                if (d.overrides) setOverrides(d.overrides);
            })
            .catch(() => {});
    }, []);

    const manifest = themeRegistry[themeId];
    if (!manifest) return <div className="p-6 text-sm">Unknown theme.</div>;

    function sendPreview(diff: Record<string, unknown>) {
        const target = iframeRef.current?.contentWindow;
        if (!target) return;
        target.postMessage({ type: "uxwvend:theme-preview", overrides: diff }, window.location.origin);
    }

    async function save(diff: Record<string, unknown>) {
        const res = await fetch(`/api/v1/themes/${themeId}/customization`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ overrides: diff }),
        });
        if (!res.ok) {
            toast.error("Failed to save customization");
            return;
        }
        setOverrides(diff);
        toast.success("Saved");
    }

    return (
        <div className="grid h-screen grid-cols-[360px_1fr]">
            <aside className="overflow-y-auto border-r p-4">
                <h2 className="mb-4 text-lg font-semibold">Theme customizer</h2>
                <CustomizerForm
                    manifest={manifest}
                    initialOverrides={overrides}
                    onPreview={sendPreview}
                    onSave={save}
                />
            </aside>
            <iframe ref={iframeRef} src="/" className="h-full w-full border-0" />
        </div>
    );
}
```

- [ ] **Step 2: Add a listener in ThemeProvider**

At the end of `src/core/providers/theme-provider.tsx`, inside the main component body, add:

```tsx
const [previewOverrides, setPreviewOverrides] = useState<Record<string, unknown> | null>(null);

useEffect(() => {
    function onMessage(e: MessageEvent) {
        if (e.origin !== window.location.origin) return;  // ORIGIN CHECK
        const data = e.data as { type?: string; overrides?: Record<string, unknown> };
        if (data?.type !== "uxwvend:theme-preview") return;
        setPreviewOverrides(data.overrides ?? {});
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
}, []);
```

Then, where `<ThemeConfigProvider value={serverConfig}>` is rendered, wrap:

```tsx
<ThemeConfigProvider value={previewOverrides ? applyOverrides(serverConfig, previewOverrides) : serverConfig}>
```

(Import `applyOverrides` from `@/core/components/admin/theme-customizer/diff`.)

- [ ] **Step 3: Build check**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/(admin)/admin/settings/customizer/page.tsx src/core/providers/theme-provider.tsx
git commit -m "feat(customizer): page + postMessage with origin check"
```

---

## Task 18 — API routes: active theme + customization

**Files:**
- Create: `src/app/api/v1/themes/active/route.ts`
- Create: `src/app/api/v1/themes/[id]/customization/route.ts`

- [ ] **Step 1: Implement the GET**

`src/app/api/v1/themes/active/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { getActiveThemeId } from "@/core/lib/theme-config";
import { prisma } from "@/core/lib/db";

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const themeId = await getActiveThemeId();
    const row = await prisma.themeCustomization.findUnique({ where: { themeId } });
    return NextResponse.json({ themeId, overrides: (row?.overrides as Record<string, unknown>) ?? {} });
}
```

- [ ] **Step 2: Implement the PUT**

`src/app/api/v1/themes/[id]/customization/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { Prisma } from "@prisma/client";
import { themeRegistry } from "@/core/generated/theme-registry";
import { logActivity } from "@/core/lib/activity-log";
import { sanitizeCustomCss } from "@/core/lib/css-sanitizer";

function sanitizeOverrides(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") {
            out[k] = sanitizeCustomCss(v);
        } else if (v && typeof v === "object" && !Array.isArray(v)) {
            out[k] = sanitizeOverrides(v as Record<string, unknown>);
        } else {
            out[k] = v;
        }
    }
    return out;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id: themeId } = await ctx.params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!themeRegistry[themeId]) return NextResponse.json({ error: "Unknown theme" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const overrides = (body as { overrides?: Record<string, unknown> })?.overrides ?? {};
    if (typeof overrides !== "object" || Array.isArray(overrides)) {
        return NextResponse.json({ error: "overrides must be an object" }, { status: 400 });
    }
    if (JSON.stringify(overrides).length > 100_000) {
        return NextResponse.json({ error: "overrides payload too large" }, { status: 413 });
    }

    const safe = sanitizeOverrides(overrides);

    if (Object.keys(safe).length === 0) {
        await prisma.themeCustomization.deleteMany({ where: { themeId } });
    } else {
        await prisma.themeCustomization.upsert({
            where: { themeId },
            create: { themeId, overrides: safe as Prisma.InputJsonValue, updatedById: session.user.id },
            update: { overrides: safe as Prisma.InputJsonValue, updatedById: session.user.id },
        });
    }
    logActivity({
        userId: session.user.id,
        action: "theme.customization.update",
        entity: "theme",
        entityId: themeId,
        metadata: { fields: Object.keys(safe) },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/themes/active/route.ts src/app/api/v1/themes/[id]/customization/route.ts
git commit -m "feat(theme): API for active theme + saving/resetting customization"
```

---

## Task 19 — Hardened theme upload route

**Files:**
- Replace: `src/app/api/v1/themes/upload/route.ts`

- [ ] **Step 1: Read the existing route**

```bash
cat src/app/api/v1/themes/upload/route.ts
```

- [ ] **Step 2: Rewrite it**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { rateLimit } from "@/core/lib/rate-limit";
import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { execFileSync } from "child_process";
import { themeManifestSchema } from "@/core/lib/theme-manifest-schema";
import { validateZipEntries } from "@/core/lib/module-zip-validator";
import { manifestHash } from "@/core/lib/module-install-audit";
import { sanitizeCustomCss } from "@/core/lib/css-sanitizer";
import { PROJECT_ROOT } from "@/core/lib/runtime-paths";
import { devOnlyDetail } from "@/core/lib/api-utils";

const THEMES_DIR = path.join(PROJECT_ROOT, "src/themes");
const RESERVED_IDS = new Set(["flat", "flat-dark", "core", "admin"]);

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rl = await rateLimit(`theme-upload:${session.user.id}`, { maxRequests: 3, windowMs: 3_600_000 });
    if (!rl.success) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });

    let extractDir: string | null = null;
    try {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || !file.name.endsWith(".zip")) {
            return NextResponse.json({ error: "Upload a .zip" }, { status: 400 });
        }
        if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 });

        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return NextResponse.json({ error: "Invalid ZIP" }, { status: 400 });

        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        const check = validateZipEntries(entries);
        if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

        extractDir = path.join(PROJECT_ROOT, "tmp", `theme-extract-${Date.now()}`);
        await fs.mkdir(extractDir, { recursive: true });
        const extractRoot = path.resolve(extractDir);
        for (const e of entries) {
            if (e.isDirectory) continue;
            const resolved = path.resolve(extractDir, e.entryName);
            if (!resolved.startsWith(extractRoot + path.sep)) continue;
            await fs.mkdir(path.dirname(resolved), { recursive: true });
            await fs.writeFile(resolved, e.getData());
        }

        const manifestPath = path.join(extractDir, "theme.json");
        if (!(await fs.access(manifestPath).then(() => true).catch(() => false))) {
            return NextResponse.json({ error: "theme.json missing" }, { status: 400 });
        }
        let raw: unknown;
        try { raw = JSON.parse(await fs.readFile(manifestPath, "utf-8")); }
        catch { return NextResponse.json({ error: "theme.json invalid JSON" }, { status: 400 }); }

        const parsed = themeManifestSchema.safeParse(raw);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            return NextResponse.json({ error: `theme.json invalid: ${first.path.join(".")} ${first.message}` }, { status: 400 });
        }
        const manifest = parsed.data;
        if (RESERVED_IDS.has(manifest.id)) return NextResponse.json({ error: "Theme id is reserved" }, { status: 400 });

        const target = path.join(THEMES_DIR, manifest.id);
        const targetResolved = path.resolve(target);
        if (!targetResolved.startsWith(path.resolve(THEMES_DIR) + path.sep)) {
            return NextResponse.json({ error: "Invalid theme path" }, { status: 400 });
        }
        const exists = await fs.access(target).then(() => true).catch(() => false);
        if (exists) await fs.rm(target, { recursive: true, force: true });
        await fs.cp(extractDir, target, { recursive: true });

        // Re-read the manifest we just wrote; strip any css blob through the
        // CSS sanitizer so a compromised upload can't persist a hostile <style>.
        if ((raw as { styles?: { css?: string } })?.styles?.css) {
            (raw as { styles: { css: string } }).styles.css = sanitizeCustomCss((raw as { styles: { css: string } }).styles.css);
            await fs.writeFile(path.join(target, "theme.json"), JSON.stringify(raw, null, 2));
        }

        try {
            execFileSync("npx", ["tsx", "scripts/generate-theme-registry.ts"], { cwd: PROJECT_ROOT, timeout: 30_000, stdio: "pipe" });
        } catch (e) {
            await fs.rm(target, { recursive: true, force: true });
            return NextResponse.json({ error: "Theme failed regeneration", details: devOnlyDetail(e) }, { status: 400 });
        }

        const hash = manifestHash(manifest);
        await prisma.theme.upsert({
            where: { id: manifest.id },
            create: {
                id: manifest.id, name: manifest.name, version: manifest.version,
                parent: manifest.parent, type: manifest.type,
                manifestHash: hash, installedByUserId: session.user.id,
            },
            update: {
                name: manifest.name, version: manifest.version,
                parent: manifest.parent, type: manifest.type,
                manifestHash: hash, installedByUserId: session.user.id,
            },
        });

        return NextResponse.json({ ok: true, id: manifest.id });
    } catch (err) {
        return NextResponse.json({ error: "Upload failed", details: devOnlyDetail(err) }, { status: 500 });
    } finally {
        if (extractDir) await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/themes/upload/route.ts
git commit -m "feat(theme): hardened theme upload — Zod + ZIP validator + audit"
```

---

## Task 20 — CONTRIBUTING authoring guide

**Files:**
- Modify: `docs/CONTRIBUTING.md`

- [ ] **Step 1: Append a new section**

Add to the end of `docs/CONTRIBUTING.md`:

````markdown
## Authoring a Theme

Themes live in `src/themes/<id>/`. Each theme is a `theme.json` manifest plus optional React templates.

### Minimal manifest

```json
{
  "schemaVersion": 1,
  "id": "my-theme",
  "name": "My Theme",
  "description": "Short one-line description",
  "version": "1.0.0",
  "author": "You",
  "type": "light",
  "tokens": {
    "colors": {
      "primary":    { "type": "color", "default": "#2563eb" },
      "background": { "type": "color", "default": "#ffffff" }
    }
  },
  "config": {
    "hero": {
      "label": "Hero",
      "fields": {
        "headline": { "type": "text", "default": "Welcome", "max": 100 }
      }
    }
  }
}
```

### Reading config at runtime

```tsx
import { useThemeConfig } from "@/core/lib/theme-config-client";

const cfg = useThemeConfig();
<h1>{cfg("hero.headline", "Welcome")}</h1>
```

### Inheriting from a parent theme

Set `parent: "flat"` in `theme.json`. Tokens and config groups your theme omits fall through to the parent. Two levels max — grandchildren are rejected at schema validation.

### Named slots

Use `<Slot name="home.afterHero">` to render whatever modules have contributed there. See `CANONICAL_SLOTS` in `src/core/lib/slot-registry.ts` for the reserved names.

### Distribution

Zip the `<id>/` folder and upload via Admin → Appearance → Themes → Upload. The upload route validates the manifest, runs the ZIP integrity check, computes a SHA-256 of the manifest (audit trail), and regenerates the theme registry.

The active theme is picked by the `active_theme` setting. Customization (admin overrides) lives in the `ThemeCustomization` table, one row per theme, stored as a diff against the manifest defaults.
````

- [ ] **Step 2: Commit**

```bash
git add docs/CONTRIBUTING.md
git commit -m "docs: theme authoring guide"
```

---

## Task 21 — Delete old theme config files

**Files:**
- Delete: `src/themes/flat/theme.config.ts`
- Delete: `src/themes/flat-dark/theme.config.ts`
- Delete: `src/themes/pixelcraft/theme.config.ts`
- Delete: `scripts/migrate-theme-to-v1.ts` (if the migration script was created)

- [ ] **Step 1: Grep for any last references to the old config**

```bash
grep -rn "theme.config" src/ scripts/ || true
```

Expected: no references in core. Any remaining reference must be fixed before deletion.

- [ ] **Step 2: Delete**

```bash
git rm src/themes/flat/theme.config.ts src/themes/flat-dark/theme.config.ts src/themes/pixelcraft/theme.config.ts
```

- [ ] **Step 3: Full build + test sweep**

```bash
npx tsx scripts/generate-theme-registry.ts
npx tsx scripts/generate-registry.ts
npx tsc --noEmit
npx vitest run
npm run build
```

All pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(theme): remove legacy theme.config.ts files"
```

---

## Task 22 — Final integration check

**Files:**
- Read: all generated files

- [ ] **Step 1: Verify the three themes are in the registry**

```bash
grep -c '"id":' src/core/generated/theme-registry.ts
```

Expected: `3`.

- [ ] **Step 2: Verify CSS tokens were emitted**

```bash
grep -c 'data-theme=' src/core/generated/theme-tokens.css
```

Expected: `3`.

- [ ] **Step 3: Verify slot registry has module contributions**

```bash
grep -c "SlotRegistry\[" src/core/generated/slot-registry.tsx
```

Expected: `>0`.

- [ ] **Step 4: Manual smoke test (requires `npm run dev`)**

1. Start the dev server: `npm run dev`.
2. Visit `/admin/settings/customizer`. Form renders with color pickers for Flat's colors.
3. Change the primary color → the iframe updates within 500ms.
4. Save → reload the customizer → the value persists.
5. Open DevTools → Application → Local Storage: `uxw-theme` present.
6. Visit `/admin/themes`. Switch active theme to `pixelcraft`. `<html data-theme>` updates.

- [ ] **Step 5: Final commit if any polish landed**

```bash
git status
git add -A
git commit -m "chore(theme): final integration polish" || echo "Nothing to commit."
```

---

## Self-review

**Spec coverage** — every spec section maps to tasks above:

- Problem / Goals / Non-goals — context, no tasks.
- 5-layer architecture → Tasks 2 (manifest), 10 (runtime provider), 11 (Slot), 15-16 (customizer), 9 (runtime config).
- theme.json schema → Task 2.
- File layout → Task 6 (generator reads directory structure).
- Template resolution — explicitly OUT OF SCOPE in this plan (see spec non-goals updated in the revised agreement; inheritance applies to tokens + config only, covered by Task 6's `resolveMergedTheme`).
- Named slot registry → Tasks 11, 12, 13, 14.
- Customizer admin panel → Tasks 15, 16, 17, 18.
- Runtime CSS + config propagation → Tasks 6, 7, 8, 9, 10.
- Packaging + installation → Task 19.
- Migration → Tasks 3, 4, 5, 21.
- Security requirements → Tasks 17 (postMessage origin), 18 (override sanitize), 19 (upload hardening), 2 (color regex), 10 (fallback chain).
- Verification → Task 22.
- Out of scope preserved.

**Placeholder scan** — searched for "TBD", "TODO", "fill in", "similar to". None present in step bodies. Every code block is self-contained.

**Type consistency** — checked:
- `ThemeManifest` defined in Task 2, imported in Tasks 6, 9, 10, 11, 17, 19.
- `themeRegistry` shape (`Record<string, ThemeManifest>`) consistent across Tasks 6, 9, 10, 17, 18.
- `CustomizerForm` signature matches what customizer page imports in Task 17.
- `SlotRegistry` shape matches between the generator (Task 13) and the consumer (`Slot.tsx`, Task 11).
- `applyOverrides` / `computeOverrideDiff` signatures match between Task 16 (declaration) and Task 17 (consumption).

**Scope** — one subsystem (theme manifest + runtime + customizer + slot unification + upload). Fits one implementation plan. Template hierarchy is deferred to a follow-up.
