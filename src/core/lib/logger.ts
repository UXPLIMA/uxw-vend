/**
 * Structured logger with correlation ID support.
 * Outputs JSON lines in production, pretty-prints in dev.
 */

import { randomUUID } from "crypto";
import { headers } from "next/headers";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    correlationId?: string;
    method?: string;
    path?: string;
    statusCode?: number;
    durationMs?: number;
    userId?: string;
    error?: string;
    stack?: string;
    [key: string]: unknown;
}

const isDev = !!process.env.NEXT_DEV;
const LOG_LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isDev ? "debug" : "info");

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[MIN_LEVEL];
}

function emit(entry: LogEntry) {
    if (!shouldLog(entry.level)) return;

    if (isDev) {
        const color = { debug: "\x1b[36m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" }[entry.level];
        const reset = "\x1b[0m";
        const prefix = `${color}[${entry.level.toUpperCase()}]${reset}`;
        const cid = entry.correlationId ? ` [${entry.correlationId.slice(0, 8)}]` : "";
        const duration = entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : "";
        const method = entry.method ? ` ${entry.method}` : "";
        const path = entry.path ? ` ${entry.path}` : "";
        const status = entry.statusCode ? ` → ${entry.statusCode}` : "";

        console.log(`${prefix}${cid}${method}${path}${status}${duration} ${entry.message}`);
        if (entry.stack) console.log(entry.stack);
    } else {
        // Production: JSON lines for log aggregators
        const { stack, ...rest } = entry;
        const line = JSON.stringify(stack ? { ...rest, stack } : rest);
        if (entry.level === "error") {
            process.stderr.write(line + "\n");
        } else {
            process.stdout.write(line + "\n");
        }
    }
}

/** Get or create correlation ID from request headers */
export async function getCorrelationId(): Promise<string> {
    try {
        const h = await headers();
        return h.get("x-correlation-id") || randomUUID();
    } catch {
        return randomUUID();
    }
}

/** Create a logger scoped to a correlation ID (sync — pass correlationId for best results) */
export function createLogger(correlationId?: string) {
    const cid = correlationId || randomUUID();

    const log = (level: LogLevel, message: string, extra?: Record<string, unknown>) => {
        emit({
            level,
            message,
            timestamp: new Date().toISOString(),
            correlationId: cid,
            ...extra,
        });
    };

    return {
        debug: (msg: string, extra?: Record<string, unknown>) => log("debug", msg, extra),
        info: (msg: string, extra?: Record<string, unknown>) => log("info", msg, extra),
        warn: (msg: string, extra?: Record<string, unknown>) => log("warn", msg, extra),
        error: (msg: string, extra?: Record<string, unknown>) => log("error", msg, extra),
        correlationId: cid,
    };
}

/** Log an API request (call at start, returns finish function) */
export function logRequest(method: string, path: string, correlationId?: string) {
    const cid = correlationId || randomUUID();
    const start = Date.now();

    emit({
        level: "info",
        message: "request_start",
        timestamp: new Date().toISOString(),
        correlationId: cid,
        method,
        path,
    });

    return {
        correlationId: cid,
        finish: (statusCode: number, extra?: Record<string, unknown>) => {
            emit({
                level: statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info",
                message: "request_end",
                timestamp: new Date().toISOString(),
                correlationId: cid,
                method,
                path,
                statusCode,
                durationMs: Date.now() - start,
                ...extra,
            });
        },
    };
}
