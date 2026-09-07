import { describe, it, expect, vi } from "vitest";
import { listScheduledJobs, registerCronJob } from "@/core/lib/scheduler";

const { logWarn, logError } = vi.hoisted(() => ({ logWarn: vi.fn(), logError: vi.fn() }));
// The module under test is re-imported after `vi.resetModules()`, so a spy on
// the real logger would land on a different instance than the one it picks
// up. Mocking the module keeps one object on both sides.
vi.mock("@/core/lib/logger", () => ({
    
    errorText: (e: unknown) => (e instanceof Error ? e.message : String(e)),log: { warn: logWarn, error: logError, info: vi.fn(), debug: vi.fn() },
}));


describe("scheduler", () => {
    it("registers and lists jobs", () => {
        const before = listScheduledJobs().length;
        registerCronJob({
            key: "test:my-job",
            schedule: "every-hour",
            handler: async () => {},
        });
        const jobs = listScheduledJobs();
        expect(jobs.length).toBe(before + 1);
        expect(jobs.find((j) => j.key === "test:my-job")?.schedule).toBe("every-hour");
    });

    it("ignores unknown schedule", () => {
        // The refusal is reported through the structured logger; quietened so
        // a passing run stays readable. What is asserted is that nothing was
        // registered, which is what a caller can see.
        logWarn.mockClear();
        const before = listScheduledJobs().length;
        registerCronJob({
            key: "test:bad",
            schedule: "every-eternity" as never,
            handler: async () => { },
        });
        // Job not registered → list count stays the same
        expect(listScheduledJobs().length).toBe(before);
    });
});
