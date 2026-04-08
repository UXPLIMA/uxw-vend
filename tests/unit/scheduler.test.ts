import { describe, it, expect } from "vitest";
import { listScheduledJobs, registerCronJob } from "@/core/lib/scheduler";

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
        const before = listScheduledJobs().length;
        registerCronJob({
            key: "test:bad",
            schedule: "every-eternity" as never,
            handler: async () => {},
        });
        // Job not registered → list count stays the same
        expect(listScheduledJobs().length).toBe(before);
    });
});
