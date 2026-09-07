import { describe, it, expect } from "vitest";
import { moduleManifestSchema } from "@/core/lib/module-manifest-schema";
import { CRON_SCHEDULES, SCHEDULE_MS } from "@/core/lib/cron-schedules";

/**
 * A module names how often its job should run, and the scheduler decides
 * whether that name means anything.
 *
 * `SCHEDULE_MS` maps seven names to intervals. `registerCronJob` refuses
 * anything else and `claimJob` returns false for it, so the job never runs.
 * The manifest accepted any string up to sixty-four characters, and
 * `validate-module` did not look at the field at all, so a module whose author
 * wrote "daily", or a five field cron expression, passed every gate and
 * shipped a scheduled job that never fired. The only trace was one warning
 * line at boot.
 *
 * The five module jobs in the tree all name a real schedule, so this closes a
 * door rather than moving anyone through it.
 */

function manifestWithSchedule(schedule: string) {
    return {
        id: "example",
        name: "Example",
        version: "1.0.0",
        description: "A module with one scheduled job.",
        author: "uxwVend",
        coreVersion: "^1.0.0",
        cronJobs: [{ id: "tidy-up", schedule, handler: "cron/tidy-up.ts" }],
    };
}

describe("a schedule a module declares", () => {
    it("is accepted when the scheduler knows the name", () => {
        for (const schedule of CRON_SCHEDULES) {
            const parsed = moduleManifestSchema.safeParse(manifestWithSchedule(schedule));
            expect(parsed.success, `${schedule} should be accepted`).toBe(true);
        }
    });

    it("is refused when it is a name the scheduler would ignore", () => {
        for (const schedule of ["daily", "0 3 * * *", "every-2-hours", "EVERY-DAY"]) {
            const parsed = moduleManifestSchema.safeParse(manifestWithSchedule(schedule));
            expect(parsed.success, `${schedule} should be refused`).toBe(false);
        }
    });
});

describe("the two lists of schedules", () => {
    it("are one list, so they cannot drift apart", () => {
        expect([...CRON_SCHEDULES].sort()).toEqual(Object.keys(SCHEDULE_MS).sort());
    });

    it("give every name an interval greater than zero", () => {
        for (const name of CRON_SCHEDULES) {
            expect(SCHEDULE_MS[name], `${name} needs an interval`).toBeGreaterThan(0);
        }
    });
});
