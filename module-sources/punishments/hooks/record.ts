/**
 * Answers `punishment.record`: another module watched something ban somebody,
 * and this module keeps the record.
 *
 * Written as an upsert on (source, externalRef) because the other system will
 * deliver the same event twice - a webhook retry, a re-sync after an outage -
 * and a punishment listed twice is worse than one listed late.
 *
 * A failure comes back as `recorded: false` rather than as an exception. The
 * caller is usually answering a webhook, and a thrown error there turns "we
 * could not write this down" into a 500 that the other system reads as "try
 * the whole batch again".
 */
import type { HookHandlerFor } from "@/core/sdk";
import { log, prisma } from "@/core/sdk/server";

const recordPunishment: HookHandlerFor<"punishment.record", "filter"> = async (current, report) => {
    // Somebody already wrote it down. A second recorder would duplicate it.
    if (current?.recorded) return current;

    if (!report?.source || !report.externalRef || !report.playerName || !report.type) {
        return { recorded: false, id: null };
    }
    // `site` is what an administrator issuing one here is called; a module
    // claiming it would put its rows where a person's are.
    if (report.source === "site") return { recorded: false, id: null };

    const data = {
        userId: report.userId ?? null,
        playerName: report.playerName,
        playerUuid: report.playerUuid ?? null,
        type: report.type,
        reason: report.reason ?? null,
        duration: report.duration ?? null,
        punishedBy: report.punishedBy ?? null,
        expiresAt: report.expiresAt ? new Date(report.expiresAt) : null,
        active: report.active ?? true,
    };

    try {
        const row = await prisma.punishment.upsert({
            where: { source_externalRef: { source: report.source, externalRef: report.externalRef } },
            update: data,
            create: { ...data, source: report.source, externalRef: report.externalRef },
        });
        return { recorded: true, id: row.id };
    } catch (error) {
        log.warn("[punishments] a report could not be recorded", {
            source: report.source,
            error: error instanceof Error ? error.message : "unknown",
        });
        return { recorded: false, id: null };
    }
};

export default recordPunishment;
