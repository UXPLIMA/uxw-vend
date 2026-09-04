import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/**
 * The documented external cron trigger did not drive the scheduler.
 *
 * `docs/DEPLOYMENT.md` tells an operator to point a system cron at
 * `POST /api/v1/admin/cron` with an API key, and says the endpoint "runs
 * maintenance tasks registered by installed modules (expiring coupons,
 * closing stale tickets, etc.)". It did nothing of the kind. It called
 * `runScheduledTasks()`, a parallel list that knew about one core cleanup and
 * nothing about a registered job, core's or a module's. `tick()` is what runs
 * registered jobs, and only the in-process ticker ever called it.
 *
 * So an operator who followed the deployment guide, on the sort of host where
 * an in-process ticker is exactly what you cannot rely on, ran none of the
 * jobs they were told they were running. And the one cleanup that list did
 * hold - expiring VerificationToken rows - never ran either, because the admin
 * panel drives per-job runs through `/admin/cron/[key]/run` and never posts to
 * this endpoint at all.
 */

describe("POST /api/v1/admin/cron", () => {
    const route = read("src/app/api/v1/admin/cron/route.ts");

    it("runs the jobs that are due", () => {
        expect(code(route)).toContain("runDueJobs()");
    });

    it("no longer calls a task list that runs beside the scheduler", () => {
        expect(code(route)).not.toContain("runScheduledTasks");
        expect(fs.existsSync(path.join(root, "src/core/lib/scheduled-tasks.ts"))).toBe(false);
    });

    it("still admits an API key with the cron:run permission", () => {
        // This is how an external cron authenticates; losing it would leave
        // the operator's crontab silently unauthorised.
        expect(route).toContain('validateApiKey(rawKey, "cron:run")');
    });

    it("reports which jobs it ran", () => {
        expect(route).toContain("jobs, ran: jobs.length");
    });
});

describe("the scheduler", () => {
    const scheduler = read("src/core/lib/scheduler.ts");

    it("exposes a tick an external trigger can drive", () => {
        expect(scheduler).toContain("export async function runDueJobs()");
        expect(scheduler).toContain("await bootstrapScheduler()");
    });

    it("claims each job, so two triggers cannot run one twice", () => {
        // The in-process ticker and an external cron race on the same CronRun
        // row; the claim is what makes exactly one of them win the interval.
        const tick = scheduler.slice(
            scheduler.indexOf("async function tick()"),
            scheduler.indexOf("export async function runDueJobs()"),
        );
        expect(tick).toContain("await claimJob(job.key, job.schedule)");
        expect(scheduler).toContain("ON CONFLICT");
    });

    it("registers the retention sweep that now owns the token prune", () => {
        expect(scheduler).toContain('key: "core:retention-prune"');
        expect(scheduler).toContain("verificationToken: r.verificationToken");
    });
});

describe("the documentation", () => {
    it("no longer promises the endpoint runs module jobs it never touched", () => {
        const deployment = read("docs/DEPLOYMENT.md");
        expect(deployment).not.toContain(
            "The cron endpoint runs maintenance tasks registered by installed modules",
        );
        expect(deployment).toContain("/api/v1/admin/cron");
    });

    it("describes what the endpoint actually does", () => {
        const api = read("docs/API.md");
        expect(api).not.toContain("The endpoint runs the core scheduled tasks once");
        expect(api).toContain("/api/v1/admin/cron");
    });
});
