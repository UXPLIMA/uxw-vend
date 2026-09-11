import crypto from "node:crypto";
import { prisma } from "@/core/lib/db";

/**
 * What this installation calls itself when it asks for something it bought.
 *
 * Generated once and stored, rather than derived from a domain, an IP or the
 * hardware. All three change for reasons that have nothing to do with a
 * licence, and a binding that breaks when a site moves host is a support
 * ticket rather than a protection.
 *
 * Cached for the life of the process: it is written once and never changes,
 * and the alternative is a database read on every catalogue fetch.
 */
const KEY = "core.installationId";

let cached: string | null = null;

export async function installationId(): Promise<string> {
    if (cached) return cached;

    const existing = await prisma.setting.findUnique({ where: { key: KEY } });
    if (existing && typeof existing.value === "string" && existing.value.length > 0) {
        cached = existing.value;
        return cached;
    }

    const fresh = crypto.randomUUID();
    // Upsert rather than create: two requests can reach this at once on a
    // first boot, and the loser of that race must read the winner's value
    // rather than fail or overwrite it.
    const row = await prisma.setting.upsert({
        where: { key: KEY },
        update: {},
        create: { key: KEY, value: fresh },
    });
    cached = typeof row.value === "string" ? row.value : fresh;
    return cached;
}
