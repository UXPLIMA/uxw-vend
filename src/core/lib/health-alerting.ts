import { prisma } from "@/core/lib/db";
import { getModuleStates } from "@/core/lib/module-cache";
import { ModuleWebhookChannels } from "@/core/generated/module-data";
import {
    GENERIC_CHANNEL_ID,
    buildWebhookPayload,
    listWebhookChannels,
    resolveWebhookChannel,
    validateWebhookUrl,
    type WebhookAlert,
    type WebhookChannel,
} from "@/core/lib/webhook-channels";

/**
 * Health alerting.
 *
 * Cron-driven watchdog that hits the internal /api/health endpoint
 * and posts to a configured webhook when the platform transitions
 * into a degraded/down state (and when it recovers). Debounced so a
 * single flapping check does not spam the channel.
 *
 * The channel decides the wire format and which hosts are acceptable.
 * Core ships only the vendor-neutral `generic` channel; modules add
 * richer ones through `webhookChannels` in their manifest.
 *
 * Config lives in Setting { key: "health_alerting" } as JSON:
 *   {
 *     "enabled": true,
 *     "webhookUrl": "https://...",
 *     "channel": "<channel id>",
 *     "alertOn": ["degraded", "down"]
 *   }
 *
 * The "last notified" state is in-process only — survives across
 * cron ticks but resets on server restart. This is intentional:
 * on restart we want to re-announce the current state.
 */

export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthAlertingConfig {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
    alertOn: HealthStatus[];
}

export interface AlertState {
    lastStatus: HealthStatus;
    lastNotifiedAt: Date | null;
}

export const HEALTH_ALERTING_SETTING_KEY = "health_alerting";
const DEBOUNCE_MS = 15 * 60 * 1000; // 15 minutes

// In-process state. Reset on server restart.
const state: AlertState = {
    lastStatus: "ok",
    lastNotifiedAt: null,
};

/** Read-only view of the current alert state (for tests / diagnostics). */
export function getAlertState(): AlertState {
    return { lastStatus: state.lastStatus, lastNotifiedAt: state.lastNotifiedAt };
}

/** Reset the in-memory debounce state. Used by tests. */
export function resetAlertState(): void {
    state.lastStatus = "ok";
    state.lastNotifiedAt = null;
}

/**
 * Load alerting config from Setting. Returns a disabled config if
 * the row is missing or malformed so callers can treat the result
 * uniformly.
 */
export async function loadAlertingConfig(): Promise<HealthAlertingConfig> {
    const fallback: HealthAlertingConfig = {
        enabled: false,
        webhookUrl: "",
        channel: GENERIC_CHANNEL_ID,
        alertOn: ["degraded", "down"],
    };

    try {
        const row = await prisma.setting.findUnique({
            where: { key: HEALTH_ALERTING_SETTING_KEY },
        });
        if (!row || !row.value || typeof row.value !== "object" || Array.isArray(row.value)) {
            return fallback;
        }
        const v = row.value as Record<string, unknown>;
        // `provider` is the pre-registry key; a config written before channels
        // existed still names its vendor there.
        const rawChannel = typeof v.channel === "string" ? v.channel : v.provider;
        const channel = typeof rawChannel === "string" && rawChannel ? rawChannel : GENERIC_CHANNEL_ID;
        const webhookUrl = typeof v.webhookUrl === "string" ? v.webhookUrl : "";
        const enabled = v.enabled === true;
        const rawAlertOn = Array.isArray(v.alertOn) ? v.alertOn : ["degraded", "down"];
        const alertOn = rawAlertOn.filter(
            (s): s is HealthStatus => s === "ok" || s === "degraded" || s === "down",
        );
        return {
            enabled,
            webhookUrl,
            channel,
            alertOn: alertOn.length > 0 ? alertOn : ["degraded", "down"],
        };
    } catch {
        return fallback;
    }
}

interface HealthSnapshot {
    status: HealthStatus;
    checks?: Record<string, unknown>;
    version?: string;
    timestamp?: string;
}

/**
 * Fetch the current health snapshot from the internal endpoint.
 * Uses 127.0.0.1 + the configured port to avoid SSRF via Host
 * header spoofing. Returns "down" if the endpoint itself fails.
 */
async function fetchHealthSnapshot(): Promise<HealthSnapshot> {
    const port = process.env.PORT || "3001";
    const url = `http://127.0.0.1:${port}/api/health`;
    try {
        const res = await fetch(url, {
            headers: { "x-internal-request": process.env.INTERNAL_API_SECRET || "1" },
            // Short timeout via AbortController
            signal: AbortSignal.timeout(5000),
        });
        const data = (await res.json()) as HealthSnapshot;
        if (data && (data.status === "ok" || data.status === "degraded" || data.status === "down")) {
            return data;
        }
        return { status: "down" };
    } catch (err) {
        return {
            status: "down",
            checks: { fetch: { ok: false, error: (err as Error).message } },
        };
    }
}

const COLORS = {
    ok: 0x22c55e, // green
    degraded: 0xf59e0b, // orange
    down: 0xdc2626, // red
};

function formatMessage(status: HealthStatus, snapshot: HealthSnapshot, recovery: boolean): string {
    if (recovery) {
        return `Health recovered — platform is back to ${status}.`;
    }
    if (status === "down") return "Platform is DOWN — critical subsystem failure.";
    if (status === "degraded") return "Platform is DEGRADED — a non-critical check failed.";
    return `Platform status: ${status}.`;
}

/** Channels an admin can pick from on this install. */
export async function listAlertingChannels(): Promise<WebhookChannel[]> {
    let states: Record<string, boolean> = {};
    try {
        states = await getModuleStates();
    } catch {
        // No module state available (first boot, DB hiccup): offer the
        // built-in channel rather than failing the settings page.
    }
    return listWebhookChannels(ModuleWebhookChannels, (moduleId) => states[moduleId] === true);
}

function buildAlert(
    status: HealthStatus,
    snapshot: HealthSnapshot,
    recovery: boolean,
): WebhookAlert {
    const message = formatMessage(status, snapshot, recovery);
    return {
        title: recovery ? "Health recovered" : `Health: ${status}`,
        message,
        color: recovery ? COLORS.ok : COLORS[status],
        fields: [
            { name: "Status", value: status },
            { name: "Version", value: snapshot.version ?? "unknown" },
        ],
        timestamp: snapshot.timestamp ?? new Date().toISOString(),
    };
}

/**
 * Send a webhook payload to the configured URL. The channel decides which
 * hosts are acceptable, so core does not have to know any vendor by name.
 */
export async function sendHealthWebhook(
    config: HealthAlertingConfig,
    payload: Record<string, unknown>,
    channel?: WebhookChannel,
): Promise<{ ok: boolean; error?: string }> {
    const target = channel ?? resolveWebhookChannel(config.channel, await listAlertingChannels());
    const check = validateWebhookUrl(target, config.webhookUrl);
    if (!check.ok) return { ok: false, error: check.error };

    try {
        const res = await fetch(config.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
            return { ok: false, error: `HTTP ${res.status}` };
        }
        return { ok: true };
    } catch (err) {
        return { ok: false, error: (err as Error).message };
    }
}

/**
 * Build a sample payload for the admin "Test webhook" button.
 */
export function buildTestPayload(channel: WebhookChannel): Record<string, unknown> {
    const snapshot: HealthSnapshot = {
        status: "ok",
        version: "test",
        timestamp: new Date().toISOString(),
    };
    return buildWebhookPayload(channel, buildAlert("ok", snapshot, false));
}

/**
 * Decide whether to notify based on the new status, the previous
 * in-memory status, and the debounce window.
 */
function shouldNotify(
    newStatus: HealthStatus,
    config: HealthAlertingConfig,
): { notify: boolean; recovery: boolean } {
    const prev = state.lastStatus;

    // Recovery: we were in a bad state, now we're ok.
    if (newStatus === "ok" && prev !== "ok") {
        return { notify: true, recovery: true };
    }

    // Skip statuses the admin didn't opt into.
    if (!config.alertOn.includes(newStatus)) {
        return { notify: false, recovery: false };
    }

    // Status changed from ok → bad, always notify.
    if (prev === "ok" && newStatus !== "ok") {
        return { notify: true, recovery: false };
    }

    // Still in the same bad state — debounce re-notification.
    if (prev === newStatus && newStatus !== "ok") {
        if (!state.lastNotifiedAt) return { notify: true, recovery: false };
        const elapsed = Date.now() - state.lastNotifiedAt.getTime();
        if (elapsed >= DEBOUNCE_MS) return { notify: true, recovery: false };
        return { notify: false, recovery: false };
    }

    // Transition between two bad states (e.g. degraded → down).
    if (prev !== newStatus) {
        return { notify: true, recovery: false };
    }

    return { notify: false, recovery: false };
}

/**
 * Cron entrypoint: fetch health, compare to last-seen state,
 * and fire a webhook when appropriate.
 */
export async function checkAndAlert(): Promise<{ notified: boolean; status: string }> {
    const config = await loadAlertingConfig();
    if (!config.enabled || !config.webhookUrl) {
        return { notified: false, status: "disabled" };
    }

    const snapshot = await fetchHealthSnapshot();
    const decision = shouldNotify(snapshot.status, config);

    if (!decision.notify) {
        state.lastStatus = snapshot.status;
        return { notified: false, status: snapshot.status };
    }

    const channel = resolveWebhookChannel(config.channel, await listAlertingChannels());
    const payload = buildWebhookPayload(channel, buildAlert(snapshot.status, snapshot, decision.recovery));

    const result = await sendHealthWebhook(config, payload, channel);

    state.lastStatus = snapshot.status;
    if (result.ok) {
        state.lastNotifiedAt = new Date();
    }

    return { notified: result.ok, status: snapshot.status };
}
