// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * /api/health is what the observability screen paints its dots from, and an
 * operator reads those dots to answer one question: does this work?
 *
 * The email row answered it wrong. It reported `ok: failed < 10`, and a site
 * with no mail transport configured has nothing to fail, so a demo that could
 * not send a password reset showed a green tick - while the Redis row, in the
 * same situation, correctly said "not configured". A check must not call
 * absence success.
 *
 * The scheduler row answered it wrong in the other direction. It counted rows
 * that were overdue **and** whose last run had errored, so the one failure the
 * check exists to catch was invisible: when the ticker stops, every job falls
 * behind while `lastStatus` stays "ok". Demonstrated against the development
 * database - a job two hours overdue whose last run succeeded, and
 * /api/health answering `status: ok, staleJobs: 0`.
 *
 * The narrowing was not pointless, though, and the fix keeps it. A module an
 * operator switched off leaves its CronRun row behind with an old `nextRunAt`,
 * so counting every overdue row would put the site in a permanent amber that
 * nothing can clear. It is the registered jobs that are supposed to run.
 */

const { setting, emailJob, cronRun, queryRaw, isRedisConfigured, listRegisteredJobs, bootstrapScheduler } = vi.hoisted(() => ({
    listRegisteredJobs: vi.fn(() => [] as { key: string; schedule: string }[]),
    bootstrapScheduler: vi.fn(async () => undefined),
    setting: { findMany: vi.fn() },
    emailJob: { count: vi.fn() },
    cronRun: { count: vi.fn() },
    queryRaw: vi.fn(),
    isRedisConfigured: vi.fn(),
}));

vi.mock("@/core/lib/db", () => ({
    prisma: { setting, emailJob, cronRun, $queryRaw: queryRaw },
    default: { setting, emailJob, cronRun, $queryRaw: queryRaw },
}));
vi.mock("@/core/lib/redis", () => ({ isRedisConfigured }));
vi.mock("@/core/lib/scheduler", () => ({ listRegisteredJobs, bootstrapScheduler }));
vi.mock("@/core/lib/rate-limit", () => ({
    isRedisReady: vi.fn(async () => true),
    rateLimitForRoleAsync: vi.fn(async () => true),
    getClientIP: () => "127.0.0.1",
}));

import { GET } from "@/app/api/health/route";
import { invalidateEmailConfig } from "@/core/lib/email-config";

interface EmailCheck {
    ok: boolean;
    configured: boolean;
    pending: number;
    failed: number;
}

async function health(): Promise<{
    status: string;
    checks: {
        emailQueue: EmailCheck;
        redis: { ok: boolean; enabled: boolean };
        scheduler: { ok: boolean; staleJobs: number };
    };
}> {
    const res = await GET(new Request("http://localhost/api/health"));
    return res.json();
}

beforeEach(() => {
    vi.clearAllMocks();
    invalidateEmailConfig();
    delete process.env.RESEND_API_KEY;
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    emailJob.count.mockResolvedValue(0);
    cronRun.count.mockResolvedValue(0);
    setting.findMany.mockResolvedValue([]);
    isRedisConfigured.mockReturnValue(false);
    listRegisteredJobs.mockReturnValue([]);
    bootstrapScheduler.mockClear();
});

/** Rows in CronRun, answered through the `where` the route actually writes. */
function cronRunTable(rows: { jobKey: string; lastStatus: string; nextRunAt: Date }[]) {
    cronRun.count.mockImplementation(async (args: {
        where?: { jobKey?: { in: string[] }; nextRunAt?: { lt: Date }; lastStatus?: string };
    }) => {
        const where = args?.where ?? {};
        return rows.filter((row) => {
            if (where.jobKey && !where.jobKey.in.includes(row.jobKey)) return false;
            if (where.nextRunAt && !(row.nextRunAt < where.nextRunAt.lt)) return false;
            if (where.lastStatus && row.lastStatus !== where.lastStatus) return false;
            return true;
        }).length;
    });
}

const HOURS_AGO = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);
const HOURS_AHEAD = (n: number) => new Date(Date.now() + n * 60 * 60 * 1000);

describe("a green tick means the thing works", () => {
    it("reports email as not configured when no transport is set", async () => {
        const body = await health();
        expect(body.checks.emailQueue.configured).toBe(false);
    });

    it("says the same about Redis, which is where the shape came from", async () => {
        const body = await health();
        expect(body.checks.redis.enabled).toBe(false);
    });

    it("counts a configured transport from the Setting row", async () => {
        setting.findMany.mockResolvedValue([
            { key: "resend_api_key", value: "re_test_key" },
        ]);
        const body = await health();
        expect(body.checks.emailQueue.configured).toBe(true);
    });

    it("counts a configured transport from the environment", async () => {
        process.env.RESEND_API_KEY = "re_env_key";
        const body = await health();
        expect(body.checks.emailQueue.configured).toBe(true);
        delete process.env.RESEND_API_KEY;
    });

    it("still surfaces a backlog of failures once a transport exists", async () => {
        setting.findMany.mockResolvedValue([
            { key: "resend_api_key", value: "re_test_key" },
        ]);
        emailJob.count.mockResolvedValue(25);
        const body = await health();
        expect(body.checks.emailQueue.ok).toBe(false);
        expect(body.status).toBe("degraded");
    });

    it("does not turn an unconfigured mailer into a degraded platform", async () => {
        const body = await health();
        expect(body.status).toBe("ok");
    });
});

describe("the scheduler row", () => {
    it("says so when a registered job has fallen behind, however its last run went", async () => {
        listRegisteredJobs.mockReturnValue([{ key: "core:automated-backup", schedule: "every-day" }]);
        cronRunTable([
            { jobKey: "core:automated-backup", lastStatus: "ok", nextRunAt: HOURS_AGO(2) },
        ]);

        const body = await health();

        expect(body.checks.scheduler.staleJobs).toBe(1);
        expect(body.checks.scheduler.ok).toBe(false);
        expect(body.status).toBe("degraded");
    });

    it("is still quiet when everything registered is due later", async () => {
        listRegisteredJobs.mockReturnValue([{ key: "core:automated-backup", schedule: "every-day" }]);
        cronRunTable([
            { jobKey: "core:automated-backup", lastStatus: "ok", nextRunAt: HOURS_AHEAD(6) },
        ]);

        const body = await health();

        expect(body.checks.scheduler).toMatchObject({ ok: true, staleJobs: 0 });
        expect(body.status).toBe("ok");
    });

    it("leaves the row of a job nobody registers alone, so a disabled module is not a permanent amber", async () => {
        listRegisteredJobs.mockReturnValue([{ key: "core:automated-backup", schedule: "every-day" }]);
        cronRunTable([
            { jobKey: "core:automated-backup", lastStatus: "ok", nextRunAt: HOURS_AHEAD(6) },
            { jobKey: "shop-that-was-uninstalled:sweep", lastStatus: "ok", nextRunAt: HOURS_AGO(900) },
        ]);

        const body = await health();

        expect(body.checks.scheduler).toMatchObject({ ok: true, staleJobs: 0 });
    });

    it("still catches the overdue-and-failed job it always caught", async () => {
        listRegisteredJobs.mockReturnValue([{ key: "core:process-email-queue", schedule: "every-5-minutes" }]);
        cronRunTable([
            { jobKey: "core:process-email-queue", lastStatus: "error", nextRunAt: HOURS_AGO(1) },
        ]);

        const body = await health();

        expect(body.checks.scheduler.staleJobs).toBe(1);
    });

    // Every other route that reads the registry loads it first, and says why:
    // a freshly booted process has registered nothing until it ticks. Reading
    // an empty registry here would have made the check a permanent green.
    it("loads the registry before it asks what is behind", async () => {
        listRegisteredJobs.mockReturnValue([{ key: "core:automated-backup", schedule: "every-day" }]);
        cronRunTable([
            { jobKey: "core:automated-backup", lastStatus: "ok", nextRunAt: HOURS_AGO(2) },
        ]);

        const body = await health();

        expect(bootstrapScheduler).toHaveBeenCalled();
        expect(body.checks.scheduler.staleJobs).toBe(1);
    });

    it("asks nothing of the database when the registry really is empty", async () => {
        listRegisteredJobs.mockReturnValue([]);
        cronRunTable([{ jobKey: "x", lastStatus: "ok", nextRunAt: HOURS_AGO(9) }]);

        const body = await health();

        expect(body.checks.scheduler).toMatchObject({ ok: true, staleJobs: 0 });
        expect(cronRun.count).not.toHaveBeenCalled();
    });
});
