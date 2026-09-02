import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Notification preferences are opt-out: a missing row means "send it".
 * Inverting that default either silences every notification in the
 * product or ignores every user's mute. Both are silent failures, and
 * neither was covered.
 */

const { notificationPreference } = vi.hoisted(() => ({
    notificationPreference: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(),
    },
}));

vi.mock("@/core/lib/db", () => ({
    prisma: { notificationPreference },
    default: { notificationPreference },
}));

import { shouldNotify, setPreference, getUserPreferences } from "@/core/lib/notif-prefs";

beforeEach(() => {
    notificationPreference.findUnique.mockReset().mockResolvedValue(null);
    notificationPreference.upsert.mockReset().mockResolvedValue({});
    notificationPreference.findMany.mockReset().mockResolvedValue([]);
});

describe("shouldNotify", () => {
    it("allows delivery when the user has never expressed a preference", async () => {
        await expect(shouldNotify("u1", "blog.article.created", "email")).resolves.toBe(true);
    });

    it("respects an explicit opt-out", async () => {
        notificationPreference.findUnique.mockResolvedValue({ enabled: false });
        await expect(shouldNotify("u1", "blog.article.created", "email")).resolves.toBe(false);
    });

    it("respects an explicit opt-in", async () => {
        notificationPreference.findUnique.mockResolvedValue({ enabled: true });
        await expect(shouldNotify("u1", "blog.article.created", "email")).resolves.toBe(true);
    });

    it("looks the preference up on the composite key", async () => {
        await shouldNotify("u1", "blog.article.created", "inapp");

        expect(notificationPreference.findUnique).toHaveBeenCalledWith({
            where: {
                userId_eventType_channel: {
                    userId: "u1",
                    eventType: "blog.article.created",
                    channel: "inapp",
                },
            },
        });
    });

    it("keeps channels independent", async () => {
        notificationPreference.findUnique.mockImplementation(
            async (args: { where: { userId_eventType_channel: { channel: string } } }) =>
                args.where.userId_eventType_channel.channel === "email"
                    ? { enabled: false }
                    : null,
        );

        await expect(shouldNotify("u1", "e", "email")).resolves.toBe(false);
        await expect(shouldNotify("u1", "e", "inapp")).resolves.toBe(true);
    });

    it("accepts a module-defined channel beyond email and inapp", async () => {
        await expect(shouldNotify("u1", "e", "webhook")).resolves.toBe(true);
    });

    it("defaults to allow when the lookup throws", async () => {
        notificationPreference.findUnique.mockRejectedValue(new Error("db down"));
        await expect(shouldNotify("u1", "e", "email")).resolves.toBe(true);
    });
});

describe("setPreference", () => {
    it("creates the row on first use and updates it thereafter", async () => {
        await setPreference("u1", "blog.article.created", "email", false);

        const args = notificationPreference.upsert.mock.calls[0]![0];
        expect(args.where.userId_eventType_channel).toEqual({
            userId: "u1", eventType: "blog.article.created", channel: "email",
        });
        expect(args.create).toEqual({
            userId: "u1", eventType: "blog.article.created", channel: "email", enabled: false,
        });
        expect(args.update).toEqual({ enabled: false });
    });

    it("can re-enable a previously muted event", async () => {
        await setPreference("u1", "e", "email", true);
        expect(notificationPreference.upsert.mock.calls[0]![0].update).toEqual({ enabled: true });
    });
});

describe("getUserPreferences", () => {
    it("returns every stored preference for the user", async () => {
        notificationPreference.findMany.mockResolvedValue([{ eventType: "e", enabled: false }]);

        await expect(getUserPreferences("u1")).resolves.toEqual([
            { eventType: "e", enabled: false },
        ]);
        expect(notificationPreference.findMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    });

    it("returns an empty list for a user who has changed nothing", async () => {
        await expect(getUserPreferences("u1")).resolves.toEqual([]);
    });
});
