// scripts/backfill-theme-v2.ts
//
// One-shot data backfill for theme v2.
//   1. existing ThemeCustomization rows get mode = 'light' (the only mode
//      v1 effectively supported — v1 darkness was a separate theme row).
//   2. Setting.active_theme → ThemeState singleton row. Old Setting row deleted.
//   3. If no active_theme setting existed and no ThemeState row exists, seed
//      with (themeId='flat', mode='light').
//
// Idempotent — safe to re-run.
// Usage: npx tsx scripts/backfill-theme-v2.ts

import "dotenv/config";
import { prisma } from "../src/core/lib/db";

async function main() {
    // 1. Backfill customization mode (rows created before mode column existed)
    const customizationsWithoutMode = await prisma.$executeRaw`
        UPDATE "ThemeCustomization" SET "mode" = 'light' WHERE "mode" IS NULL OR "mode" = ''
    `;
    if (customizationsWithoutMode > 0) {
        console.log(`[customization] backfilled mode='light' on ${customizationsWithoutMode} row(s)`);
    }

    // 2. Migrate Setting.active_theme → ThemeState
    const active = await prisma.setting.findUnique({ where: { key: "active_theme" } });
    if (active) {
        const raw = active.value;
        let themeId = "flat";
        if (typeof raw === "string") themeId = raw;
        else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            const obj = raw as { id?: unknown; active_theme?: unknown };
            if (typeof obj.id === "string") themeId = obj.id;
            else if (typeof obj.active_theme === "string") themeId = obj.active_theme;
        }
        await prisma.themeState.upsert({
            where: { id: 1 },
            create: { id: 1, themeId, mode: "light" },
            update: { themeId, mode: "light" },
        });
        await prisma.setting.delete({ where: { key: "active_theme" } });
        console.log(`[state] migrated active_theme="${themeId}" → ThemeState singleton; old Setting row deleted`);
    } else {
        // Seed singleton if none exists
        const existing = await prisma.themeState.findFirst();
        if (!existing) {
            await prisma.themeState.create({ data: { id: 1, themeId: "flat", mode: "light" } });
            console.log(`[state] seeded default (flat, light)`);
        } else {
            console.log(`[state] singleton already present — skipped`);
        }
    }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
