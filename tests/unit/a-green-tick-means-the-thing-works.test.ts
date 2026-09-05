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
 */

const { setting, emailJob, cronRun, queryRaw, isRedisConfigured } = vi.hoisted(() => ({
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
    checks: { emailQueue: EmailCheck; redis: { ok: boolean; enabled: boolean } };
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
});

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
