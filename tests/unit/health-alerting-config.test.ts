// @vitest-environment node
/**
 * Config loading for health alerting.
 *
 * The interesting case is upgrade: alerting used to store a vendor name under
 * `provider`. Those rows must keep working after the switch to channels.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("@/core/lib/db", () => ({
    prisma: { setting: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
vi.mock("@/core/lib/module-cache", () => ({ getModuleStates: async () => ({}) }));

import { loadAlertingConfig } from "@/core/lib/health-alerting";

beforeEach(() => vi.clearAllMocks());

const row = (value: unknown) => findUnique.mockResolvedValue({ key: "health_alerting", value });

describe("loadAlertingConfig", () => {
    it("reads a channel-based config", async () => {
        row({ enabled: true, channel: "discord", webhookUrl: "https://discord.com/x", alertOn: ["down"] });
        await expect(loadAlertingConfig()).resolves.toEqual({
            enabled: true,
            channel: "discord",
            webhookUrl: "https://discord.com/x",
            alertOn: ["down"],
        });
    });

    it("carries a legacy `provider` value over to `channel`", async () => {
        row({ enabled: true, provider: "discord", webhookUrl: "https://discord.com/x", alertOn: ["down"] });
        await expect(loadAlertingConfig()).resolves.toMatchObject({ channel: "discord" });

        row({ enabled: true, provider: "slack", webhookUrl: "https://hooks.slack.com/x", alertOn: ["down"] });
        await expect(loadAlertingConfig()).resolves.toMatchObject({ channel: "slack" });
    });

    it("prefers `channel` when both keys are present", async () => {
        row({ enabled: true, channel: "generic", provider: "discord", webhookUrl: "https://a.test/x" });
        await expect(loadAlertingConfig()).resolves.toMatchObject({ channel: "generic" });
    });

    it("falls back to the generic channel when neither key is set", async () => {
        row({ enabled: true, webhookUrl: "https://a.test/x" });
        await expect(loadAlertingConfig()).resolves.toMatchObject({ channel: "generic" });
    });

    it("returns a disabled config when the row is missing or malformed", async () => {
        for (const value of [undefined, null, "a string", [1, 2]]) {
            findUnique.mockResolvedValue(value === undefined ? null : { key: "health_alerting", value });
            await expect(loadAlertingConfig()).resolves.toEqual({
                enabled: false,
                webhookUrl: "",
                channel: "generic",
                alertOn: ["degraded", "down"],
            });
        }
    });

    it("survives a database error", async () => {
        findUnique.mockRejectedValue(new Error("connection refused"));
        await expect(loadAlertingConfig()).resolves.toMatchObject({ enabled: false });
    });

    it("drops unknown statuses and never leaves alertOn empty", async () => {
        row({ enabled: true, channel: "generic", webhookUrl: "https://a.test/x", alertOn: ["down", "banana"] });
        await expect(loadAlertingConfig()).resolves.toMatchObject({ alertOn: ["down"] });

        row({ enabled: true, channel: "generic", webhookUrl: "https://a.test/x", alertOn: ["banana"] });
        await expect(loadAlertingConfig()).resolves.toMatchObject({ alertOn: ["degraded", "down"] });
    });
});
