/**
 * Whether the nightly database backup runs, and the job that honours it.
 *
 * `createBackup` shells out to `pg_dump`. That binary is in the runtime image
 * and is not on every host this runs on, and plenty of operators back the
 * database up from outside the application anyway. Until this existed the job
 * was registered unconditionally, so those installs had one state available to
 * them: an error every night, for ever, recorded where only the observability
 * screen looks.
 *
 * Two things this deliberately does not do. It does not swallow a failure of
 * an enabled backup - that bug has been fixed once already, and a green tick
 * over an empty `backups/` directory is worse than a red one. And it does not
 * read a missing setting as "off": every install that exists today has this
 * job running, so silence has to keep meaning yes.
 */
import { prisma } from "./db";
import { errorText, log } from "./logger";

const AUTOMATED_BACKUP_SETTING_KEY = "automated_backup";

/** The stored shape. Room for a schedule or a retention override later. */
interface AutomatedBackupSetting {
    enabled?: unknown;
}

export async function isAutomatedBackupEnabled(): Promise<boolean> {
    try {
        const row = await prisma.setting.findUnique({
            where: { key: AUTOMATED_BACKUP_SETTING_KEY },
        });
        if (!row) return true;
        const value = row.value as AutomatedBackupSetting | null;
        // Only an explicit false switches it off, so a half-written row reads
        // as the default rather than as a night without a backup.
        return value?.enabled !== false;
    } catch (err) {
        log.warn("[backup] could not read the automated backup setting", { error: errorText(err) });
        return true;
    }
}

export async function setAutomatedBackupEnabled(enabled: boolean): Promise<void> {
    await prisma.setting.upsert({
        where: { key: AUTOMATED_BACKUP_SETTING_KEY },
        update: { value: { enabled } as unknown as object },
        create: { key: AUTOMATED_BACKUP_SETTING_KEY, value: { enabled } as unknown as object, module: "core" },
    });
}

/**
 * The daily job. Throws when an enabled backup fails, which is how the failure
 * reaches this job's `CronRun` row and the observability screen.
 */
export async function runScheduledBackup(): Promise<void> {
    if (!(await isAutomatedBackupEnabled())) {
        log.info("cron: automated backup is switched off", { job: "automated-backup" });
        return;
    }
    const { createBackup } = await import("./backup");
    const meta = await createBackup("scheduled", "Daily automated backup");
    log.info("cron: automated backup created", {
        job: "automated-backup",
        filename: meta.filename,
        sizeBytes: meta.sizeBytes,
    });
}
