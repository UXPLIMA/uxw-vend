/**
 * Lightweight in-memory request metrics collector.
 * Stores rolling window of request stats for admin dashboard.
 * Resets on server restart — not persistent.
 */

interface RequestMetric {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    timestamp: number;
}

const WINDOW_SIZE = 1000; // Keep last N requests
const metrics: RequestMetric[] = [];
let totalRequests = 0;
let totalErrors = 0;

/** Record a completed request */
export function recordMetric(method: string, path: string, statusCode: number, durationMs: number) {
    totalRequests++;
    if (statusCode >= 500) totalErrors++;

    metrics.push({ method, path, statusCode, durationMs, timestamp: Date.now() });

    // Keep only the rolling window
    if (metrics.length > WINDOW_SIZE) {
        metrics.splice(0, metrics.length - WINDOW_SIZE);
    }
}

/** Get summary metrics for admin dashboard */
export function getMetricsSummary() {
    const now = Date.now();
    const last5min = metrics.filter((m) => now - m.timestamp < 5 * 60 * 1000);
    const last1h = metrics.filter((m) => now - m.timestamp < 60 * 60 * 1000);

    const avgDuration = (arr: RequestMetric[]) =>
        arr.length > 0 ? Math.round(arr.reduce((sum, m) => sum + m.durationMs, 0) / arr.length) : 0;

    const p95Duration = (arr: RequestMetric[]) => {
        if (arr.length === 0) return 0;
        const sorted = arr.map((m) => m.durationMs).sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.95)] || 0;
    };

    const errorRate = (arr: RequestMetric[]) =>
        arr.length > 0 ? Math.round((arr.filter((m) => m.statusCode >= 500).length / arr.length) * 10000) / 100 : 0;

    // Top slow endpoints (last hour)
    const endpointStats = new Map<string, { count: number; totalMs: number; errors: number }>();
    for (const m of last1h) {
        const key = `${m.method} ${m.path}`;
        const stat = endpointStats.get(key) || { count: 0, totalMs: 0, errors: 0 };
        stat.count++;
        stat.totalMs += m.durationMs;
        if (m.statusCode >= 500) stat.errors++;
        endpointStats.set(key, stat);
    }

    const slowEndpoints = [...endpointStats.entries()]
        .map(([endpoint, stat]) => ({
            endpoint,
            count: stat.count,
            avgMs: Math.round(stat.totalMs / stat.count),
            errors: stat.errors,
        }))
        .sort((a, b) => b.avgMs - a.avgMs)
        .slice(0, 10);

    // Status code distribution (last hour)
    const statusCodes: Record<string, number> = {};
    for (const m of last1h) {
        const group = `${Math.floor(m.statusCode / 100)}xx`;
        statusCodes[group] = (statusCodes[group] || 0) + 1;
    }

    return {
        total: { requests: totalRequests, errors: totalErrors },
        last5min: {
            requests: last5min.length,
            avgResponseMs: avgDuration(last5min),
            p95ResponseMs: p95Duration(last5min),
            errorRate: errorRate(last5min),
        },
        lastHour: {
            requests: last1h.length,
            avgResponseMs: avgDuration(last1h),
            p95ResponseMs: p95Duration(last1h),
            errorRate: errorRate(last1h),
            statusCodes,
        },
        slowEndpoints,
    };
}
