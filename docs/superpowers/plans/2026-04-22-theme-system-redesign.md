# Theme System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the theme subsystem so themes own their own admin pages, bundle light/dark modes in a single manifest, and can fully re-shape the site while modules stay independent of theme.

**Architecture:** Three strict layers — CORE (site-type-agnostic), MODULES (features), THEME (presentation + composition). Manifest v2 drops `parent` inheritance and `type: light|dark` in favor of in-manifest `modes`. Theme-owned admin pages are schema-driven (no React required for simple settings). No v1 compat — the three existing themes migrate in place.

**Tech Stack:** Next.js 16.2 App Router, TypeScript 5.9, Prisma 6.19 (PostgreSQL), Zod 4, next-themes, next-intl, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-22-theme-system-redesign.md`

---

## File Structure

### New files

| Path | Responsibility |
|------|---------------|
| `prisma/migrations/<timestamp>_theme_v2/migration.sql` | Prisma schema migration for ThemeCustomization.mode + ThemeSetting + ThemeState |
| `src/core/generated/theme-components.tsx` | Codegen: `{ [themeId]: { [name]: dynamic(...) } }` override map |
| `src/core/generated/theme-admin-routes.ts` | Codegen: list of `/admin/theme/[group]` routes per theme |
| `src/app/[locale]/(admin)/admin/theme/[group]/page.tsx` | Schema-driven generic admin page for every theme `settings` group |
| `src/app/api/v1/themes/[id]/settings/[group]/route.ts` | GET/PUT theme-owned settings (ThemeSetting upsert) |
| `src/app/api/v1/themes/state/route.ts` | GET/PUT active theme + mode (ThemeState singleton) |
| `src/core/lib/theme-state.ts` | Server helper: `getActiveTheme()` returns `{ manifest, mode, tokens, settings }` with cache |
| `src/core/lib/theme-mode.ts` | Client helper: mode priority resolver (ThemeState → cookie → prefers-color-scheme → manifest default) |
| `src/core/components/theme/ThemeComponentSlot.tsx` | `<ThemeComponentSlot name="Navbar" fallback={DefaultNavbar} />` renderer |
| `scripts/migrate-themes-v2.ts` | One-shot script: rewrites 3 existing themes into v2 shape, deletes `flat-dark/` dir |
| `tests/unit/theme-manifest-schema.test.ts` | v2 Zod validation cases |
| `tests/unit/theme-mode-resolver.test.ts` | Mode priority resolver |
| `tests/unit/theme-state.test.ts` | Read path + cache behavior |
| `tests/e2e/theme-settings.spec.ts` | Acceptance criteria smoke tests |

### Modified files

| Path | Change |
|------|--------|
| `src/core/lib/theme-manifest-schema.ts` | Full rewrite — v2 shape (modes, settings, components, adminRoutes, suggestedModules) |
| `src/core/lib/theme-registry-loader.ts` | Delete `resolveMergedTheme()` — no more parent inheritance. Remove the file if nothing else uses it. |
| `src/core/lib/theme-config.ts` | Replace the old `getThemeConfig()` with re-exports from `theme-state.ts` |
| `src/core/providers/theme-provider.tsx` | Drive mode from `ThemeState` + priority resolver; drop `parent` assumption |
| `scripts/generate-theme-registry.ts` | Emit per-mode CSS blocks (`[data-theme=x][data-mode=y]`) + emit component/admin-route registries |
| `prisma/schema.core.prisma` | Add `ThemeSetting`, `ThemeState`, `ThemeCustomization.mode` field, `@@unique([themeId, mode])` |
| `src/app/[locale]/(admin)/admin/settings/theme/page.tsx` | Swap hardcoded color grid for schema-driven render from `themeRegistry[activeId].tokens.colors` |
| `src/core/lib/admin-nav-groups.ts` | Add "Theme" top-level group assembled dynamically from active theme's `settings` + `adminRoutes` |
| `src/core/lib/slot-registry.ts` | Trim `CANONICAL_SLOTS` to three entries (`layout.beforeMain`, `layout.afterMain`, `head.extra`) |
| `src/app/api/v1/themes/[id]/customization/route.ts` | Accept/require `mode` param; key `@@unique([themeId, mode])` |
| `src/app/api/v1/themes/[id]/route.ts` | DELETE: reject active theme; transaction-delete customization + settings |
| `src/app/api/v1/themes/upload/route.ts` | Require manifest `schemaVersion === 2`; validate v2 shape |
| `src/app/api/v1/themes/active/route.ts` | Deprecated path — delete after state endpoint takes over; update callers |

### Deleted files / dirs

| Path | Reason |
|------|--------|
| `src/themes/flat-dark/` | Folded into `src/themes/flat/theme.json` under `modes.available.dark` |
| `src/app/[locale]/(admin)/admin/settings/customizer/` | Puck builder dropped wholesale (spec §6) |
| `src/app/[locale]/(admin)/admin/settings/hero/` | Replaced by theme-owned `/admin/theme/hero` |
| `src/core/components/layout/HeroBanner.tsx` | Theme now owns hero; homepage uses `<ThemeComponentSlot name="Hero" />` |
| `src/core/components/layout/index.ts` (HeroBanner export) | Export line removed |

---

## Phase 1 — Schema foundation (v2 manifest + Prisma)

### Task 1: Write Manifest v2 Zod schema (TDD)

**Files:**
- Create: `tests/unit/theme-manifest-schema.test.ts`
- Modify: `src/core/lib/theme-manifest-schema.ts` (full rewrite)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/theme-manifest-schema.test.ts
import { describe, it, expect } from "vitest";
import { themeManifestSchema } from "@/core/lib/theme-manifest-schema";

const minimal = {
    schemaVersion: 2,
    id: "demo",
    name: "Demo",
    description: "d",
    version: "1.0.0",
    modes: { default: "light", available: { light: { tokens: { colors: { primary: "#000" } } } } },
    tokens: { colors: { primary: { type: "color" } } },
};

describe("themeManifestSchema v2", () => {
    it("accepts the minimal valid shape", () => {
        const res = themeManifestSchema.safeParse(minimal);
        expect(res.success).toBe(true);
    });

    it("rejects schemaVersion !== 2", () => {
        const res = themeManifestSchema.safeParse({ ...minimal, schemaVersion: 1 });
        expect(res.success).toBe(false);
    });

    it("rejects when modes.default isn't in modes.available", () => {
        const res = themeManifestSchema.safeParse({
            ...minimal,
            modes: { default: "dark", available: { light: { tokens: { colors: {} } } } },
        });
        expect(res.success).toBe(false);
    });

    it("rejects when modes.available is empty", () => {
        const res = themeManifestSchema.safeParse({ ...minimal, modes: { default: "light", available: {} } });
        expect(res.success).toBe(false);
    });

    it("accepts settings.*.fields with known field types", () => {
        const res = themeManifestSchema.safeParse({
            ...minimal,
            settings: {
                hero: {
                    label: "Hero",
                    icon: "Image",
                    fields: {
                        title: { type: "text", label: "Title", default: "Hi" },
                        bg:    { type: "image", label: "BG" },
                        cta:   { type: "url", label: "CTA" },
                    },
                },
            },
        });
        expect(res.success).toBe(true);
    });

    it("rejects settings with an unknown field type", () => {
        const res = themeManifestSchema.safeParse({
            ...minimal,
            settings: {
                hero: {
                    label: "Hero", icon: "Image",
                    fields: { bad: { type: "wtf", label: "x" } as unknown },
                },
            },
        });
        expect(res.success).toBe(false);
    });

    it("accepts suggestedModules", () => {
        const res = themeManifestSchema.safeParse({
            ...minimal,
            suggestedModules: [{ id: "mc-stats", reason: "live status" }],
        });
        expect(res.success).toBe(true);
    });

    it("rejects adminRoutes with traversal", () => {
        const res = themeManifestSchema.safeParse({
            ...minimal,
            adminRoutes: [{ path: "/theme/../admin", component: "admin/a.tsx" }],
        });
        expect(res.success).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/theme-manifest-schema.test.ts`
Expected: multiple FAIL — current schema is v1.

- [ ] **Step 3: Rewrite `theme-manifest-schema.ts` to v2**

Replace the whole file:

```ts
// src/core/lib/theme-manifest-schema.ts
import { z } from "zod";

const HEX = /^#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const SAFE_MODE = /^[a-z][a-z0-9-]*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ADMIN_PATH = /^\/[a-z0-9][a-z0-9/-]*$/;

// --- token definitions (shape of the customizer) ------------------------
const colorDef = z.object({
    type: z.literal("color"),
    default: z.string().regex(HEX).optional(),
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
    options: z.array(z.object({ value: z.string().max(64), label: z.string().max(100) })).min(1).max(100),
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
const numberDef = z.object({
    type: z.literal("number"),
    default: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    label: z.string().max(100).optional(),
});

const fieldDef = z.discriminatedUnion("type", [
    colorDef, fontDef, selectDef, sliderDef, toggleDef,
    textDef, urlDef, richTextDef, imageDef, numberDef,
]);

// --- modes --------------------------------------------------------------
const modeDef = z.object({
    tokens: z.object({
        colors: z.record(z.string().regex(SAFE_KEY), z.string().regex(HEX)).optional(),
        fonts:  z.record(z.string().regex(SAFE_KEY), z.string().max(100)).optional(),
        radius: z.union([z.string().max(64), z.number()]).optional(),
        space:  z.number().optional(),
    }).default({}),
});

// --- settings groups ----------------------------------------------------
const settingsGroup = z.object({
    label: z.string().min(1).max(100),
    icon: z.string().max(64).optional(),
    order: z.number().int().optional(),
    fields: z.record(z.string().regex(SAFE_KEY), fieldDef)
        .refine(r => Object.keys(r).length > 0, "at least one field required")
        .refine(r => Object.keys(r).length <= 50, "max 50 fields per group"),
});

// --- main schema --------------------------------------------------------
export const themeManifestSchema = z.object({
    schemaVersion: z.literal(2),
    id: z.string().min(1).max(64).regex(SAFE_ID),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    version: z.string().regex(SEMVER),
    author: z.string().max(100).optional(),
    preview: z.string().max(256).optional(),

    modes: z.object({
        default: z.string().regex(SAFE_MODE),
        available: z.record(z.string().regex(SAFE_MODE), modeDef)
            .refine(r => Object.keys(r).length >= 1, "at least one mode required")
            .refine(r => Object.keys(r).length <= 8, "max 8 modes"),
    }).refine(m => m.default in m.available, { message: "modes.default must be in modes.available" }),

    tokens: z.object({
        colors: z.record(z.string().regex(SAFE_KEY), colorDef).optional(),
        fonts: z.record(z.string().regex(SAFE_KEY), fontDef).optional(),
        radius: z.union([selectDef, sliderDef]).optional(),
        space: sliderDef.optional(),
    }).default({}),

    settings: z.record(z.string().regex(SAFE_KEY), settingsGroup).optional(),

    components: z.record(
        z.string().regex(/^[A-Z][A-Za-z0-9]*$/),  // PascalCase component names
        z.string().regex(/^[a-zA-Z0-9_./-]+\.(tsx|jsx|ts|js)$/),
    ).optional(),

    slots: z.array(z.object({
        name: z.string().min(1).max(128).regex(/^[a-zA-Z0-9.-]+$/),
    })).max(100).optional(),

    slotContents: z.array(z.object({
        slot: z.string().min(1).max(128).regex(/^[a-zA-Z0-9.-]+$/),
        component: z.string().regex(/^[a-zA-Z0-9_./-]+\.(tsx|jsx|ts|js)$/),
        order: z.number().int().optional(),
    })).max(100).optional(),

    adminNav: z.object({
        label: z.string().min(1).max(100),
        icon: z.string().max(64).optional(),
        order: z.number().int().optional(),
    }).optional(),

    adminRoutes: z.array(z.object({
        path: z.string().regex(ADMIN_PATH),
        component: z.string().regex(/^[a-zA-Z0-9_./-]+\.(tsx|jsx|ts|js)$/),
    })).max(50).optional(),

    suggestedModules: z.array(z.object({
        id: z.string().regex(SAFE_ID),
        reason: z.string().max(200).optional(),
    })).max(20).optional(),

    translations: z.record(
        z.string().max(10),
        z.record(z.string().max(64), z.record(z.string().max(128), z.string().max(2000))),
    ).optional(),
}).strict();

export type ThemeManifest = z.infer<typeof themeManifestSchema>;
export type ThemeFieldDef = z.infer<typeof fieldDef>;
export type ThemeModeDef = z.infer<typeof modeDef>;
export type ThemeSettingsGroup = z.infer<typeof settingsGroup>;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/theme-manifest-schema.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/theme-manifest-schema.test.ts src/core/lib/theme-manifest-schema.ts
git commit -m "feat(theme): manifest v2 Zod schema — modes, settings, components"
```

---

### Task 2: Prisma schema changes + migration

**Files:**
- Modify: `prisma/schema.core.prisma`
- Create: `prisma/migrations/<timestamp>_theme_v2/migration.sql` (generated via prisma migrate dev)

- [ ] **Step 1: Edit `prisma/schema.core.prisma`**

Find the existing `ThemeCustomization` model and replace with:

```prisma
model ThemeCustomization {
  id          String   @id @default(cuid())
  themeId     String
  mode        String
  overrides   Json
  updatedById String?
  updatedAt   DateTime @updatedAt
  @@unique([themeId, mode])
  @@index([themeId])
}

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

model ThemeState {
  id        Int      @id @default(1)
  themeId   String
  mode      String
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Merge + generate migration**

```bash
npm run db:merge
npx prisma migrate dev --name theme_v2 --create-only
```

Expected output: new directory under `prisma/migrations/<timestamp>_theme_v2/` containing `migration.sql`.

- [ ] **Step 3: Add backfill statements to migration.sql**

Open the generated `migration.sql` and APPEND at the bottom:

```sql
-- Backfill: existing ThemeCustomization rows get mode = 'light'
-- Prisma's generated ADD COLUMN is NOT NULL — we need a temporary default.
-- (If the auto-generated DDL already added the column with no default, replace with these two statements.)
ALTER TABLE "ThemeCustomization" ALTER COLUMN "mode" SET DEFAULT 'light';
UPDATE "ThemeCustomization" SET "mode" = 'light' WHERE "mode" IS NULL OR "mode" = '';
ALTER TABLE "ThemeCustomization" ALTER COLUMN "mode" DROP DEFAULT;

-- Backfill: migrate Setting.active_theme → ThemeState singleton row
INSERT INTO "ThemeState" ("id", "themeId", "mode", "updatedAt")
SELECT 1,
       COALESCE(NULLIF(value::text, '""'), '"flat"')::jsonb #>> '{}',
       'light',
       NOW()
FROM "Setting"
WHERE "key" = 'active_theme'
ON CONFLICT ("id") DO NOTHING;

-- Fallback singleton when no prior active_theme row existed
INSERT INTO "ThemeState" ("id", "themeId", "mode", "updatedAt")
VALUES (1, 'flat', 'light', NOW())
ON CONFLICT ("id") DO NOTHING;

-- Remove the legacy setting row now that ThemeState owns this
DELETE FROM "Setting" WHERE "key" = 'active_theme';
```

- [ ] **Step 4: Apply migration locally**

```bash
npx prisma migrate dev
npm run db:generate
npx tsc --noEmit
```

Expected: migration applies cleanly; `ThemeState`, `ThemeSetting`, `ThemeCustomization` models are available on the Prisma client.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.core.prisma prisma/migrations/
git commit -m "feat(theme): Prisma schema — ThemeState, ThemeSetting, mode-aware customization"
```

---

## Phase 2 — Migrate the three existing themes to v2

### Task 3: Write `migrate-themes-v2.ts` script

**Files:**
- Create: `scripts/migrate-themes-v2.ts`

- [ ] **Step 1: Write the script**

```ts
// scripts/migrate-themes-v2.ts
//
// One-shot migration: rewrites the three existing v1 theme manifests into
// the v2 shape and folds flat-dark into flat as a dark mode.
//
// Usage: npx tsx scripts/migrate-themes-v2.ts
//
// After running, flat-dark/ is removed. This script is idempotent: if a
// theme already looks v2 (schemaVersion === 2) it is skipped.

import fs from "fs";
import path from "path";

const THEMES_DIR = path.join(process.cwd(), "src/themes");

function readJson(p: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
}
function writeJson(p: string, obj: unknown): void {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function migrateFlat(): void {
    const flatDir = path.join(THEMES_DIR, "flat");
    const darkDir = path.join(THEMES_DIR, "flat-dark");
    const flatPath = path.join(flatDir, "theme.json");

    if (!fs.existsSync(flatPath)) { console.log("[flat] no manifest — skipped"); return; }
    const flat = readJson(flatPath);
    if (flat.schemaVersion === 2) { console.log("[flat] already v2 — skipped"); return; }

    const dark = fs.existsSync(darkDir) ? readJson(path.join(darkDir, "theme.json")) : null;

    // Extract light defaults from each v1 color def.
    const lightColors: Record<string, string> = {};
    const colorDefs: Record<string, { type: "color"; group?: string; label?: string }> = {};
    for (const [name, def] of Object.entries((flat as { tokens?: { colors?: Record<string, { default?: string; group?: string; label?: string }> } }).tokens?.colors ?? {})) {
        if (def.default) lightColors[name] = def.default;
        colorDefs[name] = { type: "color", group: def.group, label: def.label };
    }

    const darkColors: Record<string, string> = { ...lightColors };
    if (dark) {
        for (const [name, def] of Object.entries((dark as { tokens?: { colors?: Record<string, { default?: string }> } }).tokens?.colors ?? {})) {
            if (def.default) darkColors[name] = def.default;
        }
    }

    const fontDefs: Record<string, { type: "font"; default?: string }> = {};
    const lightFonts: Record<string, string> = {};
    for (const [name, def] of Object.entries((flat as { tokens?: { fonts?: Record<string, { default?: string }> } }).tokens?.fonts ?? {})) {
        fontDefs[name] = { type: "font", default: def.default };
        if (def.default) lightFonts[name] = def.default;
    }

    const v2 = {
        schemaVersion: 2,
        id: "flat",
        name: "Flat",
        description: (flat as { description?: string }).description ?? "Default light theme — clean, minimal, neutral.",
        version: (flat as { version?: string }).version ?? "1.0.0",
        author: (flat as { author?: string }).author ?? "uxwVend",
        modes: {
            default: "light",
            available: {
                light: { tokens: { colors: lightColors, fonts: lightFonts } },
                dark:  { tokens: { colors: darkColors, fonts: lightFonts } },
            },
        },
        tokens: {
            colors: colorDefs,
            fonts: fontDefs,
            radius: (flat as { tokens?: { radius?: unknown } }).tokens?.radius,
        },
    };

    writeJson(flatPath, v2);
    if (fs.existsSync(darkDir)) {
        fs.rmSync(darkDir, { recursive: true, force: true });
        console.log("[flat-dark] directory removed");
    }
    console.log("[flat] migrated to v2 (light + dark)");
}

function migratePixelcraft(): void {
    const p = path.join(THEMES_DIR, "pixelcraft", "theme.json");
    if (!fs.existsSync(p)) { console.log("[pixelcraft] no manifest — skipped"); return; }
    const raw = readJson(p);
    if (raw.schemaVersion === 2) { console.log("[pixelcraft] already v2 — skipped"); return; }

    const darkColors: Record<string, string> = {};
    const colorDefs: Record<string, { type: "color"; group?: string }> = {};
    for (const [name, def] of Object.entries((raw as { tokens?: { colors?: Record<string, { default?: string; group?: string }> } }).tokens?.colors ?? {})) {
        if (def.default) darkColors[name] = def.default;
        colorDefs[name] = { type: "color", group: def.group };
    }
    const fontDefs: Record<string, { type: "font"; default?: string }> = {};
    const darkFonts: Record<string, string> = {};
    for (const [name, def] of Object.entries((raw as { tokens?: { fonts?: Record<string, { default?: string }> } }).tokens?.fonts ?? {})) {
        fontDefs[name] = { type: "font", default: def.default };
        if (def.default) darkFonts[name] = def.default;
    }

    const v2 = {
        schemaVersion: 2,
        id: "pixelcraft",
        name: "PixelCraft",
        description: (raw as { description?: string }).description ?? "Pixel-art gaming theme.",
        version: (raw as { version?: string }).version ?? "1.0.0",
        author: (raw as { author?: string }).author ?? "uxwVend",
        modes: { default: "dark", available: { dark: { tokens: { colors: darkColors, fonts: darkFonts } } } },
        tokens: { colors: colorDefs, fonts: fontDefs },
    };
    writeJson(p, v2);
    console.log("[pixelcraft] migrated to v2 (dark only)");
}

migrateFlat();
migratePixelcraft();
console.log("Done.");
```

- [ ] **Step 2: Run the migration**

```bash
npx tsx scripts/migrate-themes-v2.ts
```

Expected: console shows flat + pixelcraft migrated and `flat-dark` dir removed.

- [ ] **Step 3: Validate output against the new schema**

```bash
node -e "const fs=require('fs');const {themeManifestSchema}=require('./src/core/lib/theme-manifest-schema');for(const id of ['flat','pixelcraft']){const r=themeManifestSchema.safeParse(JSON.parse(fs.readFileSync('src/themes/'+id+'/theme.json','utf-8')));if(!r.success){console.error(id,r.error.issues);process.exit(1);}}console.log('both valid');"
```

Expected: `both valid`. (If `require` of TS file fails, use `npx tsx -e` with the equivalent import instead.)

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-themes-v2.ts src/themes/flat/theme.json
git add -u src/themes/flat-dark
git commit -m "feat(theme): migrate flat + pixelcraft to v2; collapse flat-dark into flat dark mode"
```

---

### Task 4: Drop the old parent-merge loader

**Files:**
- Delete: `src/core/lib/theme-registry-loader.ts`
- Modify: `scripts/generate-theme-registry.ts` (remove the import + call)

- [ ] **Step 1: Confirm no other callers**

Run: `grep -rn "resolveMergedTheme\|theme-registry-loader" src scripts`
Expected: only `scripts/generate-theme-registry.ts` references it.

- [ ] **Step 2: Delete the loader**

```bash
git rm src/core/lib/theme-registry-loader.ts
```

- [ ] **Step 3: Strip the import/call from the generator**

In `scripts/generate-theme-registry.ts`:
- Remove the line `import { resolveMergedTheme } from "../src/core/lib/theme-registry-loader";`
- Inside `emitTokensCss` replace `const theme = resolveMergedTheme(raw, themes);` with `const theme = raw;`
- Inside `emitRegistryTs` replace `merged[id] = resolveMergedTheme(raw, themes);` with `merged[id] = raw;`

- [ ] **Step 4: Regenerate + compile**

```bash
npm run generate:themes
npx tsc --noEmit
```

Expected: script runs and reports the two migrated themes; TypeScript is clean.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor(theme): drop parent-merge loader (v2 has no inheritance)"
```

---

## Phase 3 — Codegen extensions

### Task 5: Emit per-mode CSS blocks

**Files:**
- Modify: `scripts/generate-theme-registry.ts`

- [ ] **Step 1: Replace `emitTokensCss`**

```ts
function emitTokensCss(themes: Record<string, ThemeManifest>): string {
    const blocks: string[] = [
        "/* Auto-generated by scripts/generate-theme-registry.ts — do not edit. */",
        "",
    ];
    for (const [id, theme] of Object.entries(themes)) {
        // One CSS block per (theme, mode) combo so selecting a mode triggers
        // the right variable cascade via [data-theme][data-mode] selectors.
        for (const [modeName, modeDef] of Object.entries(theme.modes.available)) {
            const lines: string[] = [];

            // Mode colors win over token default.
            const colorDefaults = new Map<string, string>();
            for (const [name, def] of Object.entries(theme.tokens?.colors ?? {})) {
                if (def.default) colorDefaults.set(name, def.default);
            }
            for (const [name, value] of Object.entries(modeDef.tokens?.colors ?? {})) {
                colorDefaults.set(name, value);
            }
            for (const [name, value] of colorDefaults) lines.push(`    --uxw-color-${name}: ${value};`);

            const fontDefaults = new Map<string, string>();
            for (const [name, def] of Object.entries(theme.tokens?.fonts ?? {})) {
                if (def.default) fontDefaults.set(name, def.default);
            }
            for (const [name, value] of Object.entries(modeDef.tokens?.fonts ?? {})) {
                fontDefaults.set(name, value);
            }
            for (const [name, value] of fontDefaults) lines.push(`    --uxw-font-${name}: ${value};`);

            if (theme.tokens?.radius && "default" in theme.tokens.radius && theme.tokens.radius.default !== undefined) {
                lines.push(`    --uxw-radius: ${theme.tokens.radius.default};`);
            }

            blocks.push(`[data-theme="${id}"][data-mode="${modeName}"] {`);
            blocks.push(...lines);
            blocks.push("}");
            blocks.push("");
        }
    }
    return blocks.join("\n");
}
```

- [ ] **Step 2: Regenerate**

```bash
npm run generate:themes
```

- [ ] **Step 3: Inspect output**

Run: `head -30 src/core/generated/theme-tokens.css`
Expected: blocks like `[data-theme="flat"][data-mode="light"] {` and `[data-theme="flat"][data-mode="dark"] {` with different variable values.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): emit per-mode CSS variable blocks"
```

---

### Task 6: Emit `theme-components.tsx` override registry

**Files:**
- Modify: `scripts/generate-theme-registry.ts`

- [ ] **Step 1: Add emitter function**

Append to `scripts/generate-theme-registry.ts`:

```ts
const COMPONENTS_OUT = path.join(process.cwd(), "src/core/generated/theme-components.tsx");

function emitComponentsTsx(themes: Record<string, ThemeManifest>): string {
    const imports: string[] = [];
    const entries: string[] = [];
    let counter = 0;

    for (const [themeId, theme] of Object.entries(themes)) {
        if (!theme.components) continue;
        const fields: string[] = [];
        for (const [name, rel] of Object.entries(theme.components)) {
            const varName = `Override_${counter++}`;
            // next/dynamic loads on demand so disabling a theme is instant.
            imports.push(`const ${varName} = dynamic(() => import("@/themes/${themeId}/${rel.replace(/\.(tsx|ts|jsx|js)$/, "")}"));`);
            fields.push(`    ${JSON.stringify(name)}: ${varName},`);
        }
        entries.push(`  ${JSON.stringify(themeId)}: {\n${fields.join("\n")}\n  },`);
    }

    return [
        "// Auto-generated by scripts/generate-theme-registry.ts — do not edit.",
        "import dynamic from 'next/dynamic';",
        "import type { ComponentType } from 'react';",
        "",
        ...imports,
        "",
        "export const themeComponents: Record<string, Record<string, ComponentType>> = {",
        ...entries,
        "};",
        "",
        "export function getThemeComponent(themeId: string, name: string): ComponentType | null {",
        "  return themeComponents[themeId]?.[name] ?? null;",
        "}",
        "",
    ].join("\n");
}
```

And update the `run()` function:

```ts
function run(): void {
    const themes = loadThemes();
    fs.mkdirSync(path.dirname(REGISTRY_OUT), { recursive: true });
    fs.writeFileSync(REGISTRY_OUT, emitRegistryTs(themes));
    fs.writeFileSync(TOKENS_OUT, emitTokensCss(themes));
    fs.writeFileSync(COMPONENTS_OUT, emitComponentsTsx(themes));
    console.log(`Generated theme registry (${Object.keys(themes).length} themes).`);
}
```

- [ ] **Step 2: Regenerate + compile**

```bash
npm run generate:themes
npx tsc --noEmit
```

Expected: `src/core/generated/theme-components.tsx` exists with an empty `themeComponents` object (no theme declares `components` yet); TypeScript is clean.

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "feat(theme): codegen theme-components.tsx override map"
```

---

### Task 7: Emit `theme-admin-routes.ts`

**Files:**
- Modify: `scripts/generate-theme-registry.ts`

- [ ] **Step 1: Add emitter**

Append to the script:

```ts
const ADMIN_ROUTES_OUT = path.join(process.cwd(), "src/core/generated/theme-admin-routes.ts");

interface ThemeAdminNavItem {
    path: string;        // full admin path e.g. /theme/hero
    label: string;
    icon?: string;
    kind: "settings" | "custom";
    group?: string;      // only for kind=settings
}

function emitAdminRoutesTs(themes: Record<string, ThemeManifest>): string {
    const map: Record<string, ThemeAdminNavItem[]> = {};
    for (const [themeId, theme] of Object.entries(themes)) {
        const items: ThemeAdminNavItem[] = [];
        for (const [group, def] of Object.entries(theme.settings ?? {})) {
            items.push({
                path: `/theme/${group}`,
                label: def.label,
                icon: def.icon,
                kind: "settings",
                group,
            });
        }
        for (const route of theme.adminRoutes ?? []) {
            items.push({ path: route.path, label: route.path, kind: "custom" });
        }
        if (items.length > 0) map[themeId] = items;
    }
    return [
        "// Auto-generated by scripts/generate-theme-registry.ts — do not edit.",
        "export interface ThemeAdminNavItem {",
        "  path: string;",
        "  label: string;",
        "  icon?: string;",
        "  kind: 'settings' | 'custom';",
        "  group?: string;",
        "}",
        "",
        `export const themeAdminRoutes: Record<string, ThemeAdminNavItem[]> = ${JSON.stringify(map, null, 2)};`,
        "",
    ].join("\n");
}
```

And update `run()` to also write this file.

- [ ] **Step 2: Regenerate + compile**

```bash
npm run generate:themes
npx tsc --noEmit
```

Expected: `src/core/generated/theme-admin-routes.ts` exists. For current themes (no `settings` declared yet), `themeAdminRoutes` is empty.

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "feat(theme): codegen theme-admin-routes.ts"
```

---

## Phase 4 — Runtime: state, mode, component override

### Task 8: ThemeState server helper (TDD)

**Files:**
- Create: `src/core/lib/theme-state.ts`
- Create: `tests/unit/theme-state.test.ts`
- Modify: `src/core/lib/theme-config.ts` (re-export from new module, keep compat for now)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/theme-state.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/core/lib/db", () => ({
    prisma: {
        themeState:          { findFirst: vi.fn() },
        themeCustomization:  { findUnique: vi.fn() },
        themeSetting:        { findMany: vi.fn() },
    },
}));

describe("getActiveTheme", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns manifest + mode + empty settings when no overrides", async () => {
        const { prisma } = await import("@/core/lib/db");
        (prisma.themeState.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "flat", mode: "light" });
        (prisma.themeCustomization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.themeSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const { getActiveTheme } = await import("@/core/lib/theme-state");
        const result = await getActiveTheme();
        expect(result.themeId).toBe("flat");
        expect(result.mode).toBe("light");
        expect(result.settings).toEqual({});
    });

    it("groups settings rows by group key", async () => {
        const { prisma } = await import("@/core/lib/db");
        (prisma.themeState.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ themeId: "flat", mode: "dark" });
        (prisma.themeCustomization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.themeSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
            { group: "hero", key: "title", value: "Hi" },
            { group: "hero", key: "cta",   value: "Go" },
            { group: "landing", key: "intro", value: "Welcome" },
        ]);

        const { getActiveTheme } = await import("@/core/lib/theme-state");
        const result = await getActiveTheme();
        expect(result.settings.hero).toEqual({ title: "Hi", cta: "Go" });
        expect(result.settings.landing).toEqual({ intro: "Welcome" });
    });

    it("falls back to default theme when ThemeState row missing", async () => {
        const { prisma } = await import("@/core/lib/db");
        (prisma.themeState.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.themeCustomization.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.themeSetting.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const { getActiveTheme } = await import("@/core/lib/theme-state");
        const result = await getActiveTheme();
        expect(result.themeId).toBe("flat"); // defaultThemeId
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/theme-state.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `theme-state.ts`**

```ts
// src/core/lib/theme-state.ts
import { prisma } from "./db";
import { themeRegistry, defaultThemeId } from "@/core/generated/theme-registry";
import type { ThemeManifest } from "./theme-manifest-schema";

export interface ActiveTheme {
    themeId: string;
    mode: string;
    manifest: ThemeManifest;
    tokenOverrides: Record<string, unknown>;
    settings: Record<string, Record<string, unknown>>;
}

/**
 * Resolve the active theme + mode from DB, merged with any customization
 * overrides and theme-owned settings. Three queries, cacheable upstream.
 */
export async function getActiveTheme(): Promise<ActiveTheme> {
    const state = await prisma.themeState.findFirst().catch(() => null);
    const themeId = state?.themeId && themeRegistry[state.themeId] ? state.themeId : defaultThemeId;
    const manifest = themeRegistry[themeId] ?? themeRegistry[defaultThemeId];
    const mode = state?.mode && manifest.modes.available[state.mode] ? state.mode : manifest.modes.default;

    const [customization, settingRows] = await Promise.all([
        prisma.themeCustomization.findUnique({ where: { themeId_mode: { themeId, mode } } }).catch(() => null),
        prisma.themeSetting.findMany({ where: { themeId } }).catch(() => []),
    ]);

    const settings: Record<string, Record<string, unknown>> = {};
    for (const row of settingRows) {
        if (!settings[row.group]) settings[row.group] = {};
        settings[row.group][row.key] = row.value;
    }

    const tokenOverrides = (customization?.overrides && typeof customization.overrides === "object"
        ? (customization.overrides as Record<string, unknown>)
        : {});

    return { themeId, mode, manifest, tokenOverrides, settings };
}

export async function setActiveTheme(themeId: string, mode: string): Promise<void> {
    await prisma.themeState.upsert({
        where: { id: 1 },
        create: { id: 1, themeId, mode },
        update: { themeId, mode },
    });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/theme-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Swap `theme-config.ts` export**

Replace body of `src/core/lib/theme-config.ts` with:

```ts
// src/core/lib/theme-config.ts
// This module is a thin facade over theme-state.ts; it exists only so the
// many existing call sites (getActiveThemeId, getThemeConfig) keep working
// while callers migrate. New code should import from `theme-state` directly.
export { getActiveTheme, setActiveTheme } from "./theme-state";
export { ThemeConfigProvider, useThemeConfig, type ThemeConfigValue } from "./theme-config-client";
```

Then fix existing callers — `grep -rn "getActiveThemeId\|getThemeConfig" src` and for each, switch to `getActiveTheme()` which returns the full shape.

- [ ] **Step 6: Commit**

```bash
git add -u tests/unit/theme-state.test.ts src/core/lib/theme-state.ts
git commit -m "feat(theme): getActiveTheme() — merged state/customization/settings read"
```

---

### Task 9: Client-side mode priority resolver (TDD)

**Files:**
- Create: `src/core/lib/theme-mode.ts`
- Create: `tests/unit/theme-mode-resolver.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/theme-mode-resolver.test.ts
import { describe, it, expect } from "vitest";
import { resolveMode } from "@/core/lib/theme-mode";

const twoModes = { default: "light", available: { light: {}, dark: {} } } as const;
const oneMode  = { default: "dark",  available: { dark: {} } } as const;

describe("resolveMode", () => {
    it("returns the only mode when theme ships one", () => {
        expect(resolveMode({ manifest: { modes: oneMode }, forced: "light", cookie: "light", systemPrefersDark: true })).toBe("dark");
    });
    it("respects admin-forced mode when valid", () => {
        expect(resolveMode({ manifest: { modes: twoModes }, forced: "dark", cookie: "light", systemPrefersDark: false })).toBe("dark");
    });
    it("ignores admin-forced when not in available modes", () => {
        expect(resolveMode({ manifest: { modes: twoModes }, forced: "purple", cookie: "dark", systemPrefersDark: false })).toBe("dark");
    });
    it("falls back to cookie", () => {
        expect(resolveMode({ manifest: { modes: twoModes }, cookie: "dark" })).toBe("dark");
    });
    it("falls back to prefers-color-scheme", () => {
        expect(resolveMode({ manifest: { modes: twoModes }, systemPrefersDark: true })).toBe("dark");
    });
    it("falls back to manifest default", () => {
        expect(resolveMode({ manifest: { modes: twoModes } })).toBe("light");
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/theme-mode-resolver.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement resolver**

```ts
// src/core/lib/theme-mode.ts
export interface ResolveModeInput {
    manifest: { modes: { default: string; available: Record<string, unknown> } };
    forced?: string | null;           // ThemeState.mode when admin pinned it
    cookie?: string | null;           // uxw_mode cookie
    systemPrefersDark?: boolean;
}

/**
 * Pick the active mode. Priority:
 *   1. Admin-forced (ThemeState.mode) if valid
 *   2. User cookie if valid
 *   3. prefers-color-scheme ("dark" if available, else default)
 *   4. manifest.modes.default
 * A single-mode theme short-circuits every lookup.
 */
export function resolveMode(input: ResolveModeInput): string {
    const available = Object.keys(input.manifest.modes.available);
    if (available.length === 1) return available[0];

    const isValid = (m: string | null | undefined): m is string =>
        typeof m === "string" && available.includes(m);

    if (isValid(input.forced)) return input.forced;
    if (isValid(input.cookie)) return input.cookie;
    if (input.systemPrefersDark && available.includes("dark")) return "dark";
    return input.manifest.modes.default;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/theme-mode-resolver.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "feat(theme): mode priority resolver"
```

---

### Task 10: `<ThemeComponentSlot>` wrapper

**Files:**
- Create: `src/core/components/theme/ThemeComponentSlot.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/core/components/theme/ThemeComponentSlot.tsx
"use client";

import { useTheme } from "@/core/providers/theme-provider";
import { getThemeComponent } from "@/core/generated/theme-components";
import type { ComponentType, ReactNode } from "react";

export function ThemeComponentSlot<P extends Record<string, unknown>>({
    name,
    fallback: Fallback,
    ...rest
}: {
    name: string;
    fallback: ComponentType<P>;
} & P): ReactNode {
    const { activeTheme } = useTheme();
    const Override = getThemeComponent(activeTheme?.id ?? "", name) as ComponentType<P> | null;
    const Comp = (Override ?? Fallback) as ComponentType<P>;
    return <Comp {...(rest as P)} />;
}
```

- [ ] **Step 2: Wire core layout components to use it**

For each core component that themes may override (start with `Navbar`, `Footer`, `Hero`), wrap the export in `ThemeComponentSlot`. Example for `Navbar`:

```tsx
// src/core/components/layout/Navbar.tsx (at the existing default export)
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

function DefaultNavbar(props: NavbarProps) {
    // ... existing implementation unchanged
}

export function Navbar(props: NavbarProps) {
    return <ThemeComponentSlot name="Navbar" fallback={DefaultNavbar} {...props} />;
}
```

Do the same for `Footer` and wherever `HeroBanner` is consumed today (will be deleted in Task 18 and replaced with `<ThemeComponentSlot name="Hero" fallback={EmptyHero} />`).

- [ ] **Step 3: Compile**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): ThemeComponentSlot wrapper + wire Navbar/Footer"
```

---

### Task 11: Update `theme-provider.tsx` for modes

**Files:**
- Modify: `src/core/providers/theme-provider.tsx`
- Modify: `src/app/[locale]/layout.tsx` (pass server-resolved mode)

- [ ] **Step 1: Provider accepts mode + forces data-mode**

Replace the provider contents:

```tsx
// src/core/providers/theme-provider.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { themeRegistry, defaultThemeId as REGISTRY_DEFAULT } from "@/core/generated/theme-registry";
import { ThemeConfigProvider } from "@/core/lib/theme-config-client";
import type { ThemeManifest } from "@/core/lib/theme-manifest-schema";
import { applyOverrides } from "@/core/components/admin/theme-customizer/diff";
import { resolveMode } from "@/core/lib/theme-mode";

interface ThemeContextType {
    activeTheme: ThemeManifest | null;
    currentThemeId: string;
    currentMode: string;
    setMode: (mode: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    activeTheme: null, currentThemeId: REGISTRY_DEFAULT, currentMode: "light", setMode: () => {},
});
export const useTheme = () => useContext(ThemeContext);

interface AppThemeProviderProps {
    children: ReactNode;
    themeId: string;         // server-resolved
    mode: string;            // server-resolved
    serverConfig?: Record<string, unknown>;
}

function pickTheme(id: string): ThemeManifest {
    return themeRegistry[id] ?? themeRegistry[REGISTRY_DEFAULT] ?? Object.values(themeRegistry)[0];
}

export function AppThemeProvider({ children, themeId, mode, serverConfig }: AppThemeProviderProps) {
    const activeTheme = useMemo(() => pickTheme(themeId), [themeId]);
    const [currentMode, setCurrentMode] = useState<string>(() =>
        resolveMode({ manifest: activeTheme, forced: mode })
    );

    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.setAttribute("data-theme", activeTheme.id);
        document.documentElement.setAttribute("data-mode", currentMode);
    }, [activeTheme, currentMode]);

    // Live preview channel (unchanged)
    const [previewOverrides, setPreviewOverrides] = useState<Record<string, unknown> | null>(null);
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.parent === window) return;
        const handler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === "uxwvend:theme-preview" && typeof event.data.overrides === "object") {
                setPreviewOverrides(event.data.overrides as Record<string, unknown>);
            }
        };
        window.addEventListener("message", handler);
        try { window.parent.postMessage({ type: "uxwvend:preview-ready" }, window.location.origin); } catch {}
        return () => window.removeEventListener("message", handler);
    }, []);

    const effectiveConfig = useMemo<Record<string, unknown>>(
        () => previewOverrides ? applyOverrides(serverConfig ?? {}, previewOverrides) : (serverConfig ?? {}),
        [serverConfig, previewOverrides],
    );

    const setMode = (next: string) => {
        if (activeTheme.modes.available[next]) {
            setCurrentMode(next);
            try { document.cookie = `uxw_mode=${next}; path=/; max-age=31536000; samesite=lax`; } catch {}
        }
    };

    return (
        <ThemeContext.Provider value={{ activeTheme, currentThemeId: activeTheme.id, currentMode, setMode }}>
            <ThemeConfigProvider value={effectiveConfig}>{children}</ThemeConfigProvider>
        </ThemeContext.Provider>
    );
}
```

- [ ] **Step 2: Update the root locale layout to pass mode**

In `src/app/[locale]/layout.tsx`, replace the current `<AppThemeProvider defaultTheme={...}>` call with a server-resolved one:

```tsx
import { getActiveTheme } from "@/core/lib/theme-state";
// ... inside the server component
const active = await getActiveTheme();
// ...
<AppThemeProvider themeId={active.themeId} mode={active.mode} serverConfig={active.settings}>
```

Remove the `next-themes` `NextThemesProvider` wrapper if it survives elsewhere — v2 owns mode state, next-themes is no longer needed.

- [ ] **Step 3: Compile + smoke**

```bash
npx tsc --noEmit
npm run dev &   # spot-check that / renders; kill after
```

Expected: compiles; pages render with `<html data-theme="flat" data-mode="light">`.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): provider drives mode from server-resolved state"
```

---

## Phase 5 — Admin surface

### Task 12: Schema-driven `/admin/theme/[group]` page

**Files:**
- Create: `src/app/[locale]/(admin)/admin/theme/[group]/page.tsx`
- Create: `src/core/components/admin/theme-settings/SchemaForm.tsx`

- [ ] **Step 1: Build the schema-driven form**

```tsx
// src/core/components/admin/theme-settings/SchemaForm.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import * as Fields from "@/core/components/admin/theme-customizer/fields";
import type { ThemeFieldDef } from "@/core/lib/theme-manifest-schema";
import { Button } from "@/core/components/ui/button";

interface Props {
    themeId: string;
    group: string;
    fields: Record<string, ThemeFieldDef>;
    initialValues: Record<string, unknown>;
}

export function SchemaForm({ themeId, group, fields, initialValues }: Props) {
    const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...initialValues }));
    const [saving, setSaving] = useState(false);

    const set = (key: string, v: unknown) => setValues(prev => ({ ...prev, [key]: v }));

    const onSubmit = async () => {
        setSaving(true);
        const res = await fetch(`/api/v1/themes/${themeId}/settings/${group}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ values }),
        });
        setSaving(false);
        if (!res.ok) { toast.error("Save failed"); return; }
        toast.success("Saved");
    };

    return (
        <div className="space-y-6 max-w-xl">
            {Object.entries(fields).map(([key, def]) => (
                <FieldRow key={key} fieldKey={key} def={def} value={values[key]} onChange={(v) => set(key, v)} />
            ))}
            <Button onClick={onSubmit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
    );
}

function FieldRow({ fieldKey, def, value, onChange }: { fieldKey: string; def: ThemeFieldDef; value: unknown; onChange: (v: unknown) => void }) {
    const isDefault = value === undefined;
    switch (def.type) {
        case "color":    return <Fields.ColorField def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "font":     return <Fields.FontField  def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "select":   return <Fields.SelectField def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "slider":   return <Fields.SliderField def={def} value={value as number} onChange={onChange as (v: number | undefined) => void} isDefault={isDefault} />;
        case "toggle":   return <Fields.ToggleField def={def} value={value as boolean} onChange={onChange as (v: boolean | undefined) => void} isDefault={isDefault} />;
        case "text":     return <Fields.TextField   def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "url":      return <Fields.UrlField    def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "richtext": return <Fields.RichTextField def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "image":    return <Fields.ImageField  def={def} value={value as string} onChange={onChange as (v: string | undefined) => void} isDefault={isDefault} />;
        case "number":   return <Fields.SliderField def={{ type: "slider", min: (def as { min?: number }).min ?? 0, max: (def as { max?: number }).max ?? 100, label: def.label, default: (def as { default?: number }).default }} value={value as number} onChange={onChange as (v: number | undefined) => void} isDefault={isDefault} />;
    }
}
```

Note: `number` falls back to the existing Slider renderer since we lack a dedicated numeric input in the customizer fields directory; add a bare input later if needed.

- [ ] **Step 2: Create the page**

```tsx
// src/app/[locale]/(admin)/admin/theme/[group]/page.tsx
import { notFound } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { getActiveTheme } from "@/core/lib/theme-state";
import { SchemaForm } from "@/core/components/admin/theme-settings/SchemaForm";

export default async function ThemeSettingsPage({ params }: { params: Promise<{ group: string }> }) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id))) notFound();

    const { group } = await params;
    const { themeId, manifest } = await getActiveTheme();
    const groupDef = manifest.settings?.[group];
    if (!groupDef) notFound();

    const rows = await prisma.themeSetting.findMany({ where: { themeId, group } });
    const initialValues = Object.fromEntries(rows.map(r => [r.key, r.value]));

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">{groupDef.label}</h1>
            <SchemaForm themeId={themeId} group={group} fields={groupDef.fields} initialValues={initialValues} />
        </div>
    );
}
```

- [ ] **Step 3: Compile**

Run: `npx tsc --noEmit`
Expected: clean. The page is unreachable until a theme declares `settings` — added in Task 19.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): schema-driven /admin/theme/[group] page"
```

---

### Task 13: Theme settings CRUD API

**Files:**
- Create: `src/app/api/v1/themes/[id]/settings/[group]/route.ts`

- [ ] **Step 1: Implement GET + PUT**

```ts
// src/app/api/v1/themes/[id]/settings/[group]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { themeRegistry } from "@/core/generated/theme-registry";
import { sanitizeHtml } from "@/core/lib/sanitize";
import type { ThemeFieldDef } from "@/core/lib/theme-manifest-schema";

function sanitizeByType(def: ThemeFieldDef, value: unknown): unknown {
    switch (def.type) {
        case "color":    return typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ? value : undefined;
        case "font":     return typeof value === "string" && value.length <= 100 ? value : undefined;
        case "select":   return typeof value === "string" && def.options.some(o => o.value === value) ? value : undefined;
        case "slider":   return typeof value === "number" && Number.isFinite(value) && value >= def.min && value <= def.max ? value : undefined;
        case "toggle":   return typeof value === "boolean" ? value : undefined;
        case "text":     return typeof value === "string" ? value.slice(0, def.max ?? 10000) : undefined;
        case "url":      return typeof value === "string" && (value.startsWith("/") || /^https?:\/\//.test(value)) ? value : undefined;
        case "richtext": return typeof value === "string" ? sanitizeHtml(value.slice(0, def.max ?? 10000)) : undefined;
        case "image":    return typeof value === "string" && (value.startsWith("/") || /^https?:\/\//.test(value) || value.startsWith("data:image/")) ? value : undefined;
        case "number":   return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; group: string }> }) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id, group } = await ctx.params;
    const rows = await prisma.themeSetting.findMany({ where: { themeId: id, group } });
    return NextResponse.json({ values: Object.fromEntries(rows.map(r => [r.key, r.value])) });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; group: string }> }) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id, group } = await ctx.params;
    const manifest = themeRegistry[id];
    const groupDef = manifest?.settings?.[group];
    if (!groupDef) return NextResponse.json({ error: "Unknown theme or group" }, { status: 404 });

    let body: { values?: Record<string, unknown> };
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    if (!body.values || typeof body.values !== "object") {
        return NextResponse.json({ error: "values required" }, { status: 400 });
    }

    const ops = [];
    for (const [key, raw] of Object.entries(body.values)) {
        const def = groupDef.fields[key];
        if (!def) continue; // silently drop unknown keys
        const clean = sanitizeByType(def, raw);
        if (clean === undefined) {
            ops.push(prisma.themeSetting.deleteMany({ where: { themeId: id, group, key } }));
        } else {
            ops.push(prisma.themeSetting.upsert({
                where: { themeId_group_key: { themeId: id, group, key } },
                create: { themeId: id, group, key, value: clean, updatedById: session.user.id },
                update: { value: clean, updatedById: session.user.id },
            }));
        }
    }
    await prisma.$transaction(ops);
    return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Compile**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Smoke**

```bash
curl -X PUT http://localhost:3001/api/v1/themes/flat/settings/hero \
  -H 'content-type: application/json' \
  -d '{"values": {"title": "Hello"}}' \
  --cookie "authjs.session-token=..."   # admin session cookie
```

Expected: `{"ok":true}`. `SELECT * FROM "ThemeSetting";` shows the row.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): /api/v1/themes/[id]/settings/[group] CRUD"
```

---

### Task 14: Active theme/mode switch API

**Files:**
- Create: `src/app/api/v1/themes/state/route.ts`
- Modify (deprecate): `src/app/api/v1/themes/active/route.ts`

- [ ] **Step 1: Write the new endpoint**

```ts
// src/app/api/v1/themes/state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import { themeRegistry } from "@/core/generated/theme-registry";
import { setActiveTheme } from "@/core/lib/theme-state";
import { logActivity } from "@/core/lib/activity-log";

export async function GET() {
    const row = await prisma.themeState.findFirst();
    return NextResponse.json(row ?? { themeId: "flat", mode: "light" });
}

export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let body: { themeId?: unknown; mode?: unknown };
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const themeId = typeof body.themeId === "string" ? body.themeId : null;
    const manifest = themeId ? themeRegistry[themeId] : null;
    if (!manifest) return NextResponse.json({ error: "Unknown theme" }, { status: 404 });

    const mode = typeof body.mode === "string" && manifest.modes.available[body.mode]
        ? body.mode
        : manifest.modes.default;

    await setActiveTheme(themeId!, mode);
    await logActivity({ userId: session.user.id, action: "theme.state.update", entity: "theme", entityId: themeId!, metadata: { mode } }).catch(() => {});
    return NextResponse.json({ ok: true, themeId, mode });
}
```

- [ ] **Step 2: Migrate the old `/active` endpoint**

Find consumers: `grep -rn "/api/v1/themes/active" src`. Replace them with calls to `/api/v1/themes/state`.

Then delete `src/app/api/v1/themes/active/route.ts`:

```bash
git rm src/app/api/v1/themes/active/route.ts
```

- [ ] **Step 3: Compile**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): /api/v1/themes/state — singleton theme+mode endpoint"
```

---

### Task 15: Rewrite `/admin/settings/theme` as schema-driven

**Files:**
- Modify: `src/app/[locale]/(admin)/admin/settings/theme/page.tsx`

- [ ] **Step 1: Replace hardcoded color grid**

Remove the section that iterates a fixed `["primary","secondary","accent","background","foreground",...]` list. Replace it with a block that reads `activeManifest.tokens.colors` and renders one `ColorField` per entry.

Key replacement sketch (edit the existing file, do not rewrite from scratch — keep upload/delete/preview logic):

```tsx
// Inside ThemeSettingsPage, after computing `currentManifest` from themeRegistry:
const tokenDefs = Object.entries(currentManifest?.tokens?.colors ?? {});
// ...
<Card>
  <CardHeader><CardTitle>{t("theme_colors")}</CardTitle></CardHeader>
  <CardContent className="grid gap-4 md:grid-cols-2">
    {tokenDefs.map(([name, def]) => (
      <Fields.ColorField
        key={name}
        def={{ ...def, label: def.label ?? name }}
        value={colorOverrides[name]}
        onChange={(v) => setColorOverrides(prev => ({ ...prev, [name]: v }))}
        isDefault={colorOverrides[name] === undefined}
      />
    ))}
  </CardContent>
</Card>
```

Wire save to `PUT /api/v1/themes/{id}/customization` with `{ mode, overrides: { tokens: { colors: colorOverrides } } }` (mode from `currentMode`).

Also render a mode toggle at the top: iterate `currentManifest.modes.available` keys and call `setMode(k)` + `fetch("/api/v1/themes/state", { method: "PUT", body: { themeId, mode: k }})` on selection.

- [ ] **Step 2: Compile**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Visual smoke**

Open the page in a browser. Switch between Flat and PixelCraft; confirm the shown color inputs match each theme's `tokens.colors` keys (not a hardcoded list).

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): theme settings page now schema-driven per manifest tokens"
```

---

### Task 16: Sidebar: Theme group (dynamic)

**Files:**
- Modify: `src/core/lib/admin-nav-groups.ts`
- Modify: wherever sidebar items are rendered (find the consumer of `CORE_NAV_GROUPS`)

- [ ] **Step 1: Export a builder that consumes the active manifest**

```ts
// src/core/lib/admin-nav-groups.ts — append near the end

import { themeRegistry } from "@/core/generated/theme-registry";
import { themeAdminRoutes, type ThemeAdminNavItem } from "@/core/generated/theme-admin-routes";

export function buildThemeNavGroup(activeThemeId: string): NavGroup | null {
    const manifest = themeRegistry[activeThemeId];
    if (!manifest) return null;
    const items = themeAdminRoutes[activeThemeId] ?? [];
    const groupItems = [
        { label: "Appearance", href: "/admin/settings/theme", icon: Palette },
        ...items.map((i: ThemeAdminNavItem) => ({
            label: i.label,
            href: "/admin" + i.path,
            icon: Palette,
        })),
    ];
    return {
        id: "theme",
        label: manifest.adminNav?.label ?? "Theme",
        icon: Palette,
        order: manifest.adminNav?.order ?? 80,
        sections: [{ items: groupItems }],
    };
}
```

(Replace `NavGroup` with the existing exported interface name if different; check the file's top `interface NavGroup` declaration.)

- [ ] **Step 2: Merge the dynamic group into render output**

Find the sidebar render component (likely `src/core/components/admin/AdminSidebar.tsx`). Fetch `getActiveTheme()` on the server side of the layout, pass `themeId` down, then:

```ts
const themeGroup = buildThemeNavGroup(themeId);
const groups = themeGroup ? [...CORE_NAV_GROUPS, themeGroup, ...moduleGroups] : [...CORE_NAV_GROUPS, ...moduleGroups];
```

- [ ] **Step 3: Compile + visual smoke**

Run: `npx tsc --noEmit`
Open the admin — sidebar now has a **Theme** group whose entries mirror the active theme's settings schema.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): dynamic Theme nav group from active manifest"
```

---

## Phase 6 — Customization API updates

### Task 17: Mode-aware customization endpoint

**Files:**
- Modify: `src/app/api/v1/themes/[id]/customization/route.ts`

- [ ] **Step 1: Accept `mode` parameter; use the composite unique**

In the existing handler (which was updated in the prior security sweep to sanitize per field type), change the upsert:

```ts
// Require mode in the body
const mode = typeof (body as { mode?: unknown }).mode === "string" ? (body as { mode: string }).mode : null;
if (!mode || !manifest.modes.available[mode]) {
    return NextResponse.json({ error: "mode is required and must exist on the theme" }, { status: 400 });
}

// ...

if (Object.keys(safe).length === 0) {
    await prisma.themeCustomization.deleteMany({ where: { themeId, mode } });
} else {
    await prisma.themeCustomization.upsert({
        where: { themeId_mode: { themeId, mode } },
        create: { themeId, mode, overrides: safe as Prisma.InputJsonValue, updatedById: session.user.id },
        update: { overrides: safe as Prisma.InputJsonValue, updatedById: session.user.id },
    });
}
```

Also add a GET handler:

```ts
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id: themeId } = await ctx.params;
    const rows = await prisma.themeCustomization.findMany({ where: { themeId } });
    return NextResponse.json({ overrides: Object.fromEntries(rows.map(r => [r.mode, r.overrides])) });
}
```

- [ ] **Step 2: Update callers**

Grep for `PUT /api/v1/themes/.*?customization` and ensure every client passes `mode` in the body.

- [ ] **Step 3: Compile + smoke**

Run: `npx tsc --noEmit`
Then: manually save a color override in light mode, switch to dark, confirm the override does NOT carry over.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): customization API is mode-aware"
```

---

### Task 18: Uninstall guard + cascade

**Files:**
- Modify: `src/app/api/v1/themes/[id]/route.ts`

- [ ] **Step 1: Guard + transaction**

Replace the DELETE handler:

```ts
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;

    const state = await prisma.themeState.findFirst();
    if (state?.themeId === id) {
        return NextResponse.json({ error: "Cannot delete the active theme — switch first." }, { status: 409 });
    }

    await prisma.$transaction([
        prisma.themeCustomization.deleteMany({ where: { themeId: id } }),
        prisma.themeSetting.deleteMany({ where: { themeId: id } }),
    ]);
    await fs.rm(path.join(process.cwd(), "src/themes", id), { recursive: true, force: true });

    // Regenerate registry synchronously — deferred build can't be the contract.
    try {
        execFileSync("npx", ["tsx", "scripts/generate-theme-registry.ts"], { timeout: 30000, stdio: "pipe" });
    } catch (err) {
        return NextResponse.json({ error: `Registry regen failed: ${(err as Error).message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
```

Add the imports at the top of the file (`fs`, `path`, `execFileSync`, `prisma`, `auth`, `isAdmin`) if not already present.

- [ ] **Step 2: Compile**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "feat(theme): DELETE guards active theme + cascades customization + settings"
```

---

## Phase 7 — Core purge

### Task 19: Drop `/admin/settings/customizer` + `/admin/settings/hero`

**Files:**
- Delete: `src/app/[locale]/(admin)/admin/settings/customizer/`
- Delete: `src/app/[locale]/(admin)/admin/settings/hero/`
- Delete: `src/core/components/layout/HeroBanner.tsx`
- Modify: `src/core/components/layout/index.ts`

- [ ] **Step 1: Remove pages + component**

```bash
git rm -r "src/app/[locale]/(admin)/admin/settings/customizer" "src/app/[locale]/(admin)/admin/settings/hero" src/core/components/layout/HeroBanner.tsx
```

Edit `src/core/components/layout/index.ts` and remove the `export { HeroBanner } ...` line.

- [ ] **Step 2: Replace `<HeroBanner />` consumers**

Grep: `grep -rn "HeroBanner\|<Hero" src`
For each call site (likely the homepage), replace with:

```tsx
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";
// ...
<ThemeComponentSlot name="Hero" fallback={() => null} />
```

So if no theme declares a Hero component, the slot simply renders nothing.

- [ ] **Step 3: Prune nav entries for the removed pages**

Edit `src/core/lib/admin-nav-groups.ts`. Find any section entries whose `href` is `/admin/settings/customizer` or `/admin/settings/hero` and delete those lines. These items are replaced by the dynamic Theme group built in Task 16, so removing them here avoids duplicate / 404-linking sidebar items.

- [ ] **Step 4: Compile**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor(theme): drop /customizer + /hero admin pages + HeroBanner core component"
```

---

### Task 20: Trim `CANONICAL_SLOTS`

**Files:**
- Modify: `src/core/lib/slot-registry.ts`

- [ ] **Step 1: Replace the array**

```ts
export const CANONICAL_SLOTS = [
    "layout.beforeMain",
    "layout.afterMain",
    "head.extra",
] as const;
```

- [ ] **Step 2: Confirm modules that declared the removed slots now own them**

Run: `grep -rn "product.beforeAddToCart\|profile.tabs" module-sources/ src/modules/`

For each matching slot, open the module's `module.json` and add the slot under the existing `slots: []` array (or create it):

```json
"slots": [
  { "name": "product.beforeAddToCart" }
]
```

- [ ] **Step 3: Rebuild marketplace zips if sources changed**

If any `module-sources/*/module.json` was updated, rebuild the distribution zips:

```bash
npm run build:marketplace
```

- [ ] **Step 4: Regen + compile**

```bash
npx tsx scripts/generate-registry.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor(slot): purge feature-specific slots from core canon"
```

---

### Task 21: MC hero migration script

**Files:**
- Create: `scripts/migrate-mc-hero-settings.ts`

- [ ] **Step 1: Write the migration**

```ts
// scripts/migrate-mc-hero-settings.ts
//
// One-shot data migration for the theme v2 cutover. Former core hero
// settings had MC-specific keys (hero_server_ip, hero_show_player_count,
// hero_discord_url). These move out of core:
//   1. If `mc-stats` is installed, write them as a ModuleSetting row
//      keyed to that module (best-effort — adapts to whatever the module
//      exposes).
//   2. Otherwise write a single admin notification listing the orphaned
//      values so the operator can move them by hand. We never drop
//      silently.
//
// Usage: npx tsx scripts/migrate-mc-hero-settings.ts

import { prisma } from "../src/core/lib/db";

const MC_KEYS = ["hero_server_ip", "hero_show_player_count", "hero_discord_url"];

async function main() {
    const rows = await prisma.setting.findMany({ where: { key: { in: MC_KEYS } } });
    if (rows.length === 0) { console.log("no MC hero settings to migrate"); return; }

    const mcInstalled = await prisma.moduleConfig.findUnique({ where: { id: "mc-stats" } });

    if (mcInstalled) {
        // mc-stats stores config in ModuleConfig.config JSON (convention —
        // verify the exact shape in the module's schema before relying on it).
        const existing = (mcInstalled.config ?? {}) as Record<string, unknown>;
        const next = { ...existing };
        for (const row of rows) next[row.key] = row.value;
        await prisma.moduleConfig.update({ where: { id: "mc-stats" }, data: { config: next } });
        console.log(`migrated ${rows.length} key(s) into mc-stats ModuleConfig.config`);
    } else {
        const payload = Object.fromEntries(rows.map(r => [r.key, r.value]));
        await prisma.adminNotification.create({
            data: {
                type: "migration.orphan",
                title: "Hero MC settings need a new home",
                body: `The core hero settings page was removed as part of theme v2. Install the mc-stats module or move these values manually: ${JSON.stringify(payload)}`,
                severity: "warning",
            },
        }).catch(() => { console.warn("AdminNotification model unavailable; keys preserved in Setting table."); });
        console.log(`mc-stats not installed — wrote admin notification with ${rows.length} key(s)`);
        return; // leave Setting rows in place as a belt-and-braces backup
    }

    await prisma.setting.deleteMany({ where: { key: { in: MC_KEYS } } });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

If `adminNotification` is not an existing model, substitute with whichever broadcast/admin-alert mechanism exists in the codebase (`grep -rn "admin.*Notification\|broadcast" src/core/lib` to find it).

- [ ] **Step 2: Run it**

```bash
npx tsx scripts/migrate-mc-hero-settings.ts
```

Expected: console reports how many keys moved and where.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-mc-hero-settings.ts
git commit -m "chore(theme): one-shot MC hero settings migration"
```

---

## Phase 8 — Theme install/upload hardening

### Task 22: Require v2 manifests on upload

**Files:**
- Modify: `src/app/api/v1/themes/upload/route.ts`

- [ ] **Step 1: Enforce schemaVersion**

Find the `moduleManifestSchema`-style Zod parse. It is already `themeManifestSchema.safeParse(...)`. Because the new schema pins `schemaVersion: z.literal(2)`, upload of a v1 manifest already fails with a clear message — but surface it better:

```ts
const parsed = themeManifestSchema.safeParse(manifestJson);
if (!parsed.success) {
    await fs.rm(targetDir, { recursive: true, force: true });
    const first = parsed.error.issues[0];
    const hint = first.path[0] === "schemaVersion"
        ? " (this theme is v1 — upgrade its manifest to schemaVersion 2)"
        : "";
    return NextResponse.json(
        { error: `Invalid theme.json: ${first.path.join(".")} — ${first.message}${hint}` },
        { status: 400 },
    );
}
```

Also verify each `components.*` path exists inside the extracted directory, same pattern as `collectManifestFileRefs` uses in the module installer. Reject with rollback if any path is missing.

- [ ] **Step 2: Compile**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "feat(theme): upload rejects v1 with an upgrade hint"
```

---

### Task 23: Suggested modules banner

**Files:**
- Create: `src/core/components/admin/theme/SuggestedModulesBanner.tsx`
- Modify: `src/app/[locale]/(admin)/admin/settings/theme/page.tsx`

- [ ] **Step 1: Banner component**

```tsx
// src/core/components/admin/theme/SuggestedModulesBanner.tsx
"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface Suggestion { id: string; reason?: string }

export function SuggestedModulesBanner({ themeName, suggestions }: { themeName: string; suggestions: Suggestion[] }) {
    if (!suggestions?.length) return null;
    return (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 mb-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-900">
                <AlertTriangle className="w-4 h-4" />
                {themeName} suggests these modules
            </div>
            <ul className="mt-2 space-y-1 text-amber-900">
                {suggestions.map(s => (
                    <li key={s.id}>
                        <Link href={`/admin/modules?install=${s.id}`} className="underline">{s.id}</Link>
                        {s.reason ? ` — ${s.reason}` : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

- [ ] **Step 2: Render on the appearance page**

In the theme settings page, after resolving `currentManifest`:

```tsx
<SuggestedModulesBanner themeName={currentManifest.name} suggestions={currentManifest.suggestedModules ?? []} />
```

- [ ] **Step 3: Compile**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(theme): surface suggestedModules as a non-blocking banner"
```

---

## Phase 9 — Acceptance tests

### Task 24: E2E acceptance smoke tests

**Files:**
- Create: `tests/e2e/theme-settings.spec.ts`

- [ ] **Step 1: Write the Playwright spec**

```ts
// tests/e2e/theme-settings.spec.ts
import { test, expect } from "@playwright/test";
import { adminLogin } from "./helpers/auth";

test.describe("theme v2 acceptance", () => {
    test("theme page's color inputs come from the active manifest", async ({ page }) => {
        await adminLogin(page);
        await page.goto("/en/admin/settings/theme");
        // Flat declares primary + background among its color tokens — check at least one custom token is present.
        await expect(page.getByLabel(/primary/i)).toBeVisible();
        await expect(page.getByLabel(/background/i)).toBeVisible();
    });

    test("/admin/settings/customizer returns 404", async ({ page }) => {
        await adminLogin(page);
        const res = await page.goto("/en/admin/settings/customizer");
        expect(res?.status()).toBe(404);
    });

    test("/admin/settings/hero returns 404", async ({ page }) => {
        await adminLogin(page);
        const res = await page.goto("/en/admin/settings/hero");
        expect(res?.status()).toBe(404);
    });

    test("switching mode updates data-mode on <html>", async ({ page }) => {
        await adminLogin(page);
        await page.goto("/en/admin/settings/theme");
        await page.getByRole("button", { name: /dark/i }).click();
        await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
    });

    test("deleting active theme is rejected", async ({ request }) => {
        const res = await request.delete("/api/v1/themes/flat");
        expect([409, 400]).toContain(res.status());
    });
});
```

- [ ] **Step 2: Run**

```bash
npm run build
npx pm2 restart uxwvend
npm run test:e2e -- tests/e2e/theme-settings.spec.ts
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/theme-settings.spec.ts
git commit -m "test(theme): acceptance smoke for v2 — schema-driven page, mode switch, active-delete guard"
```

---

## Phase 10 — Final cleanup + self-check

### Task 25: Full type + lint + build

**Files:** none (gate step)

- [ ] **Step 1: TypeScript**

```bash
npx tsc --noEmit
```

Expected exit 0.

- [ ] **Step 2: ESLint on all touched files**

```bash
npx eslint $(git diff --name-only main...HEAD -- '*.ts' '*.tsx')
```

Expected exit 0.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected success.

- [ ] **Step 4: Acceptance checklist against spec §12**

Verify one by one:

1. Manifest v2 schema in place and rejects v1 — ✅ Task 1 test + Task 22 upload
2. Flat folds light+dark, `flat-dark/` removed — ✅ Task 3
3. Dark mode recolors UI for all themes — ✅ Task 5 per-mode CSS blocks + Task 11 provider
4. `/admin/settings/theme` color inputs schema-driven — ✅ Task 15
5. `/admin/settings/customizer` 404 — ✅ Task 19
6. `/admin/settings/hero` 404, `/admin/theme/hero` present — ✅ Tasks 12, 19
7. Slot CANONICAL_SLOTS has three entries — ✅ Task 20
8. Uninstall cascade atomic, switch non-destructive — ✅ Task 18
9. Component override swap works — ✅ Task 10 + ThemeComponentSlot
10. `suggestedModules` banner, no auto-install — ✅ Task 23

- [ ] **Step 5: Final commit / push**

```bash
git log --oneline feat/theme-v1 ^main
```

Review commit history is coherent, then `git push`.
