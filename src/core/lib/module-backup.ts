import { createBackup, type BackupMeta } from "./backup";

/**
 * Snapshot the database before a destructive module operation so ops can
 * recover after a half-applied schema merge / migration. Opt-in because
 * the backup path requires pg_dump on the runtime image and some dev
 * setups (plain Node, no Postgres client) don't ship it.
 *
 *   MODULE_INSTALL_BACKUP=1   — enable pre-install snapshots
 *
 * A backup failure must NEVER block the install — we log and continue.
 * If the install itself fails, the operator still has all the tools to
 * back up manually from the admin UI before retrying.
 */
export async function backupBeforeModuleChange(
    action: "install" | "update" | "uninstall",
    moduleId: string,
): Promise<BackupMeta | null> {
    if (process.env.MODULE_INSTALL_BACKUP !== "1") return null;
    if (!process.env.DATABASE_URL) return null;

    try {
        const meta = await createBackup("manual", `pre-${action}:${moduleId}`);
        console.log(`[module-backup] ${action} ${moduleId}: snapshot ${meta.filename} (${meta.sizeBytes} bytes)`);
        return meta;
    } catch (err) {
        console.error(
            `[module-backup] snapshot before ${action} of ${moduleId} failed (continuing):`,
            err instanceof Error ? err.message : err,
        );
        return null;
    }
}
