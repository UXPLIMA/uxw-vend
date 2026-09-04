import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Disabling a module did not stop its scheduled jobs.
 *
 * Jobs are registered once, at bootstrap, and the scheduler has no reset
 * path: `bootstrapScheduler` returns early on a flag after the first call.
 * Toggling a module off updates `ModuleConfig`, invalidates the caches and
 * calls `resetHooks()` so the hook registry rebuilds from the new state, but
 * nothing touched the scheduler, and no rebuild is scheduled either, on
 * purpose, because disabling is meant to be instant.
 *
 * Every other subsystem honours the flag. The proxy refuses the module's
 * routes, `bootstrapHooks` skips its listeners, search drops its provider,
 * the sitemap leaves out its pages. The scheduler was the one that did not,
 * so a disabled blog kept publishing scheduled articles, a disabled currency
 * module kept calling an exchange rate API on a timer, and a disabled
 * webhook-logs kept deleting rows. Nothing in the admin panel said so.
 *
 * The state is read per tick rather than at registration: that is what makes
 * the toggle take effect now instead of at the next restart.
 */

const cronRunUpdate = vi.fn();
const getModuleStates = vi.fn();

/**
 * Keys this test wants claimed. Bootstrap registers core's own jobs too, and
 * letting those claim would run real handlers, so the claim answers for the
 * keys under test and refuses everything else - which is what a job that is
 * not yet due looks like anyway.
 */
const claimable = new Set<string>();
const claims: string[] = [];

vi.mock("@/core/lib/db", () => ({
    prisma: {
        // Tagged template: the key is the first interpolated value.
        $executeRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
            const key = String(values[0]);
            claims.push(key);
            return Promise.resolve(claimable.has(key) ? 1 : 0);
        },
        cronRun: { update: (...a: unknown[]) => cronRunUpdate(...a) },
    },
}));
vi.mock("@/core/lib/module-cache", () => ({
    getModuleStates: () => getModuleStates(),
}));
vi.mock("@/core/lib/shutdown", () => ({
    isShuttingDown: () => false,
    onShutdown: () => {},
    installShutdownHandlers: () => {},
}));
vi.mock("@/core/generated/module-crons", () => ({ ModuleCronJobs: [] }));
vi.mock("@/core/lib/logger", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type Scheduler = typeof import("@/core/lib/scheduler");
let mod: Scheduler;

beforeEach(async () => {
    vi.resetModules();
    claimable.clear();
    claims.length = 0;
    cronRunUpdate.mockReset().mockResolvedValue({});
    getModuleStates.mockReset().mockResolvedValue({});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mod = await import("@/core/lib/scheduler");
});

/** Registers one job per module id and returns which handlers fired. */
async function tickWith(states: Record<string, boolean>, keys: string[]) {
    getModuleStates.mockResolvedValue(states);
    const fired: string[] = [];
    for (const key of keys) {
        claimable.add(key);
        mod.registerCronJob({
            key,
            schedule: "every-hour",
            handler: async () => {
                fired.push(key);
            },
        });
    }
    const ran = (await mod.runDueJobs()).filter((k) => keys.includes(k));
    return { fired, ran };
}

describe("a tick", () => {
    it("skips a job whose module is disabled", async () => {
        const { fired } = await tickWith({ blog: false }, ["blog:publish-scheduled"]);
        expect(fired).toEqual([]);
    });

    it("does not even claim the slot for a disabled module", async () => {
        // Claiming stamps lastRunAt, which would make the job look like it ran.
        await tickWith({ blog: false }, ["blog:publish-scheduled"]);
        expect(claims).not.toContain("blog:publish-scheduled");
    });

    it("runs a job whose module is enabled", async () => {
        const { fired, ran } = await tickWith({ blog: true }, ["blog:publish-scheduled"]);
        expect(fired).toEqual(["blog:publish-scheduled"]);
        expect(ran).toEqual(["blog:publish-scheduled"]);
    });

    it("runs a job for a module with no config row", async () => {
        // No row means no explicit state, which every other consumer reads as
        // enabled; the opposite would silence a fresh install's jobs.
        const { fired } = await tickWith({}, ["announcements:publish"]);
        expect(fired).toEqual(["announcements:publish"]);
    });

    it("always runs core's own jobs", async () => {
        // A key bootstrap does not itself register, so the handler under test
        // is the one that stays in the map.
        const { fired } = await tickWith({ core: false }, ["core:probe"]);
        expect(fired).toEqual(["core:probe"]);
    });

    it("stops one module without stopping the others", async () => {
        const { fired } = await tickWith({ blog: false, currency: true }, [
            "blog:publish-scheduled",
            "currency:rate-refresh",
            "core:probe",
        ]);
        expect(fired).toEqual(["currency:rate-refresh", "core:probe"]);
    });

    it("keeps running everything when the states cannot be read", async () => {
        // Same fail-soft contract getModuleStates itself keeps: a database
        // blip must not silence every scheduled job on the site.
        getModuleStates.mockRejectedValue(new Error("db down"));
        const fired: string[] = [];
        claimable.add("blog:publish-scheduled");
        mod.registerCronJob({
            key: "blog:publish-scheduled",
            schedule: "every-hour",
            handler: async () => {
                fired.push("blog:publish-scheduled");
            },
        });
        await mod.runDueJobs();
        expect(fired).toEqual(["blog:publish-scheduled"]);
    });
});

describe("running a job by hand", () => {
    it("is refused for a disabled module", async () => {
        getModuleStates.mockResolvedValue({ blog: false });
        mod.registerCronJob({ key: "blog:publish-scheduled", schedule: "every-hour", handler: async () => {} });
        // The admin cron page lists every registered job, this one included.
        await expect(mod.runJobNow("blog:publish-scheduled")).rejects.toThrow(/disabled/i);
    });

    it("still works for an enabled module", async () => {
        getModuleStates.mockResolvedValue({ blog: true });
        let fired = false;
        claimable.add("blog:publish-scheduled");
        mod.registerCronJob({
            key: "blog:publish-scheduled",
            schedule: "every-hour",
            handler: async () => {
                fired = true;
            },
        });
        await mod.runJobNow("blog:publish-scheduled");
        expect(fired).toBe(true);
    });

    it("still reports an unknown key", async () => {
        await expect(mod.runJobNow("nope:nothing")).rejects.toThrow(/No registered cron job/);
    });
});
