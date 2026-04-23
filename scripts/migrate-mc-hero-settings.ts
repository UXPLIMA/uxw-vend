// One-shot: move former core hero settings (MC-specific) out of the Setting
// table. If mc-stats module is installed, write into ModuleConfig.config.
// Otherwise log a warning with the orphaned keys so the operator can move
// them manually — never drop silently.
//
// Usage: npx tsx scripts/migrate-mc-hero-settings.ts

import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/core/lib/db";

const MC_KEYS = ["hero_server_ip", "hero_show_player_count", "hero_discord_url"];

async function main() {
    const rows = await prisma.setting.findMany({ where: { key: { in: MC_KEYS } } });
    if (rows.length === 0) { console.log("no MC hero settings to migrate"); return; }

    const mcInstalled = await prisma.moduleConfig.findUnique({ where: { id: "mc-stats" } }).catch(() => null);

    if (mcInstalled) {
        const existing = (mcInstalled.config ?? {}) as Record<string, unknown>;
        const next = { ...existing };
        for (const row of rows) next[row.key] = row.value;
        await prisma.moduleConfig.update({ where: { id: "mc-stats" }, data: { config: next as Prisma.InputJsonValue } });
        console.log(`migrated ${rows.length} key(s) into mc-stats ModuleConfig.config`);
        await prisma.setting.deleteMany({ where: { key: { in: MC_KEYS } } });
    } else {
        const payload = Object.fromEntries(rows.map(r => [r.key, r.value]));
        console.warn(
            `mc-stats not installed — preserving ${rows.length} orphaned MC hero setting(s) in the Setting table. ` +
            `Install mc-stats or move these values manually:\n${JSON.stringify(payload, null, 2)}`
        );
    }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
