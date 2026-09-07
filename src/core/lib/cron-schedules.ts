/**
 * The schedules a job may name.
 *
 * The scheduler turns a name into an interval and refuses one it does not
 * recognise, so a name outside this list is a job that never runs. The module
 * manifest used to accept any string here and `validate-module` never looked
 * at the field, which meant an author who wrote "daily" or a five field cron
 * expression shipped a module that passed every gate with a scheduled job
 * that never fired, and one warning line at boot to say so.
 *
 * Kept in its own file, free of imports, so the manifest schema can name the
 * same list the scheduler runs on without pulling the scheduler, and its
 * database client, in behind it.
 */

export const CRON_SCHEDULES = [
    "every-minute",
    "every-5-minutes",
    "every-15-minutes",
    "every-hour",
    "every-day",
    "every-week",
    "every-month",
] as const;

export type CronSchedule = (typeof CRON_SCHEDULES)[number];

export const SCHEDULE_MS: Record<string, number> = {
    "every-minute": 60_000,
    "every-5-minutes": 5 * 60_000,
    "every-15-minutes": 15 * 60_000,
    "every-hour": 60 * 60_000,
    "every-day": 24 * 60 * 60_000,
    "every-week": 7 * 24 * 60 * 60_000,
    "every-month": 30 * 24 * 60 * 60_000,
};
