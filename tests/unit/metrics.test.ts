import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The admin dashboard's only view of production health. Its counters live
 * in module scope, so every test re-imports for a clean slate. The rolling
 * window is the part worth pinning: if the splice is wrong the array grows
 * without bound in a long-lived process.
 */

type Metrics = typeof import("@/core/lib/metrics");

beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
});

afterEach(() => {
    vi.useRealTimers();
});

async function load(): Promise<Metrics> {
    return (await import("@/core/lib/metrics")) as Metrics;
}

describe("getMetricsSummary", () => {
    it("reports zeroes before any traffic", async () => {
        const { getMetricsSummary } = await load();

        expect(getMetricsSummary()).toMatchObject({
            total: { requests: 0, errors: 0 },
            last5min: { requests: 0, avgResponseMs: 0, p95ResponseMs: 0, errorRate: 0 },
            slowEndpoints: [],
        });
    });

    it("counts every request in the lifetime total", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 200, 10);
        recordMetric("GET", "/b", 200, 20);

        expect(getMetricsSummary().total.requests).toBe(2);
    });

    it("counts only 5xx as errors", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 404, 10);
        recordMetric("GET", "/b", 499, 10);
        recordMetric("GET", "/c", 500, 10);
        recordMetric("GET", "/d", 503, 10);

        expect(getMetricsSummary().total.errors).toBe(2);
    });

    it("averages response times over the window", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 200, 10);
        recordMetric("GET", "/a", 200, 30);

        expect(getMetricsSummary().last5min.avgResponseMs).toBe(20);
    });

    it("rounds the average rather than reporting a fraction", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 200, 10);
        recordMetric("GET", "/a", 200, 11);

        expect(getMetricsSummary().last5min.avgResponseMs).toBe(11);
    });

    it("reports a p95 from the sorted durations", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        for (let i = 1; i <= 100; i++) recordMetric("GET", "/a", 200, i);

        // Sorted 1..100; index floor(100 * 0.95) = 95 → the 96th value.
        expect(getMetricsSummary().last5min.p95ResponseMs).toBe(96);
    });

    it("sorts numerically, not lexicographically", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 200, 9);
        recordMetric("GET", "/a", 200, 100);

        // A string sort would put 100 before 9 and report the wrong tail.
        expect(getMetricsSummary().last5min.p95ResponseMs).toBe(100);
    });

    it("reports the error rate as a percentage to two decimals", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        for (let i = 0; i < 3; i++) recordMetric("GET", "/a", 200, 1);
        recordMetric("GET", "/a", 500, 1);

        expect(getMetricsSummary().last5min.errorRate).toBe(25);
    });

    it("keeps two decimal places on an awkward ratio", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        for (let i = 0; i < 6; i++) recordMetric("GET", "/a", 200, 1);
        recordMetric("GET", "/a", 500, 1);

        expect(getMetricsSummary().last5min.errorRate).toBe(14.29);
    });
});

describe("time windows", () => {
    it("drops requests older than five minutes from the short window", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 200, 10);

        vi.setSystemTime(Date.now() + 5 * 60_000 + 1);

        const summary = getMetricsSummary();
        expect(summary.last5min.requests).toBe(0);
        expect(summary.lastHour.requests).toBe(1);
    });

    it("drops requests older than an hour from the long window", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 200, 10);

        vi.setSystemTime(Date.now() + 60 * 60_000 + 1);

        expect(getMetricsSummary().lastHour.requests).toBe(0);
    });

    it("keeps the lifetime total after the windows have emptied", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 500, 10);

        vi.setSystemTime(Date.now() + 2 * 60 * 60_000);

        expect(getMetricsSummary().total).toEqual({ requests: 1, errors: 1 });
    });
});

describe("rolling window", () => {
    it("never grows past a thousand samples", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        for (let i = 0; i < 1500; i++) recordMetric("GET", "/a", 200, i);

        expect(getMetricsSummary().lastHour.requests).toBe(1000);
    });

    it("discards the oldest samples, not the newest", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        for (let i = 0; i < 1001; i++) recordMetric("GET", "/a", 200, i);

        // The 0ms sample was evicted, so the mean is over 1..1000.
        expect(getMetricsSummary().lastHour.avgResponseMs).toBe(501);
    });
});

describe("endpoint breakdown", () => {
    it("groups by method and path", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 200, 10);
        recordMetric("POST", "/a", 200, 10);

        expect(getMetricsSummary().slowEndpoints.map((e) => e.endpoint).sort())
            .toEqual(["GET /a", "POST /a"]);
    });

    it("aggregates count, mean and errors per endpoint", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 200, 10);
        recordMetric("GET", "/a", 500, 30);

        expect(getMetricsSummary().slowEndpoints[0]).toEqual({
            endpoint: "GET /a", count: 2, avgMs: 20, errors: 1,
        });
    });

    it("ranks the slowest first", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/fast", 200, 5);
        recordMetric("GET", "/slow", 200, 500);

        expect(getMetricsSummary().slowEndpoints[0]!.endpoint).toBe("GET /slow");
    });

    it("returns at most ten endpoints", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        for (let i = 0; i < 20; i++) recordMetric("GET", `/p${i}`, 200, i);

        expect(getMetricsSummary().slowEndpoints).toHaveLength(10);
    });

    it("counts status codes by hundreds", async () => {
        const { recordMetric, getMetricsSummary } = await load();
        recordMetric("GET", "/a", 200, 1);
        recordMetric("GET", "/a", 204, 1);
        recordMetric("GET", "/a", 404, 1);
        recordMetric("GET", "/a", 500, 1);

        expect(getMetricsSummary().lastHour.statusCodes).toEqual({
            "2xx": 2, "4xx": 1, "5xx": 1,
        });
    });
});
