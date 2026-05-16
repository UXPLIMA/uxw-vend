import { describe, it, expect, beforeEach, vi } from "vitest";

// Prisma mocks
const trophyFindMany = vi.fn();
const trophyFindUnique = vi.fn();
const activityFeedItemCount = vi.fn();
const userTrophyUpsert = vi.fn();

vi.mock("@/core/lib/db", () => ({
    prisma: {
        trophy: {
            findMany: (...args: unknown[]) => trophyFindMany(...args),
            findUnique: (...args: unknown[]) => trophyFindUnique(...args),
        },
        activityFeedItem: {
            count: (...args: unknown[]) => activityFeedItemCount(...args),
        },
        userTrophy: {
            upsert: (...args: unknown[]) => userTrophyUpsert(...args),
        },
    },
}));

type TrophyEngineModule = typeof import("@/core/lib/trophy-engine");
type HooksModule = typeof import("@/core/lib/hooks");

let engine: TrophyEngineModule;
let hooks: HooksModule;

beforeEach(async () => {
    vi.resetModules();
    trophyFindMany.mockReset();
    trophyFindUnique.mockReset();
    activityFeedItemCount.mockReset();
    userTrophyUpsert.mockReset();

    hooks = await import("@/core/lib/hooks");
    hooks.resetHooks();
    engine = await import("@/core/lib/trophy-engine");
});

describe("trophy-engine: registerTrophyListeners", () => {
    it("registers hook listeners for each DB rule event", async () => {
        trophyFindMany.mockResolvedValue([
            {
                id: "t-post",
                ruleEvent: "forum.topic.created",
                ruleThreshold: 1,
                ruleType: "event-count",
            },
            {
                id: "t-comment",
                ruleEvent: "forum.post.created",
                ruleThreshold: 10,
                ruleType: "event-count",
            },
        ]);

        await engine.registerTrophyListeners();
        const actions = hooks.listActions();
        const names = actions.map((a) => a.name);
        expect(names).toContain("forum.topic.created");
        expect(names).toContain("forum.post.created");
    });

    it("is idempotent: second call without force does not re-register", async () => {
        trophyFindMany.mockResolvedValue([
            {
                id: "t-post",
                ruleEvent: "forum.topic.created",
                ruleThreshold: 1,
                ruleType: "event-count",
            },
        ]);

        await engine.registerTrophyListeners();
        await engine.registerTrophyListeners();
        expect(trophyFindMany).toHaveBeenCalledTimes(1);
        const actions = hooks.listActions();
        const entry = actions.find((a) => a.name === "forum.topic.created");
        expect(entry?.count).toBe(1);
    });

    it("force=true re-registers and reloads rules", async () => {
        trophyFindMany.mockResolvedValue([
            {
                id: "t-post",
                ruleEvent: "forum.topic.created",
                ruleThreshold: 1,
                ruleType: "event-count",
            },
        ]);

        await engine.registerTrophyListeners();
        await engine.registerTrophyListeners(true);
        expect(trophyFindMany).toHaveBeenCalledTimes(2);
    });

    it("returns no rules when DB throws (no built-in fallback)", async () => {
        trophyFindMany.mockRejectedValue(new Error("db down"));
        await engine.registerTrophyListeners();
        const actions = hooks.listActions();
        // Core ships zero module-aware fallback rules — admin seeds via UI.
        expect(actions.length).toBe(0);
    });

    it("does nothing when no active rules exist", async () => {
        trophyFindMany.mockResolvedValue([]);
        await engine.registerTrophyListeners();
        // No actions should be added (empty list)
        const actions = hooks.listActions();
        expect(actions.length).toBe(0);
    });

    it("skips rules with non-event-count ruleType", async () => {
        trophyFindMany.mockResolvedValue([
            {
                id: "t-1",
                ruleEvent: "some.event",
                ruleThreshold: 1,
                ruleType: "unsupported-type",
            },
        ]);
        await engine.registerTrophyListeners();
        const actions = hooks.listActions();
        expect(actions.find((a) => a.name === "some.event")).toBeUndefined();
    });
});

describe("trophy-engine: award logic via hook dispatch", () => {
    it("upserts userTrophy when threshold is met", async () => {
        trophyFindMany.mockResolvedValue([
            {
                id: "first-post",
                ruleEvent: "forum.topic.created",
                ruleThreshold: 1,
                ruleType: "event-count",
            },
        ]);
        activityFeedItemCount.mockResolvedValue(1);
        trophyFindUnique.mockResolvedValue({ id: "first-post", isActive: true });
        userTrophyUpsert.mockResolvedValue({});

        await engine.registerTrophyListeners();
        await hooks.doActionAsync("forum.topic.created", { userId: "user-1" });

        expect(userTrophyUpsert).toHaveBeenCalledTimes(1);
        const arg = userTrophyUpsert.mock.calls[0]?.[0] as {
            where: { userId_trophyId: { userId: string; trophyId: string } };
        };
        expect(arg.where.userId_trophyId.userId).toBe("user-1");
        expect(arg.where.userId_trophyId.trophyId).toBe("first-post");
    });

    it("does NOT upsert when threshold not met", async () => {
        trophyFindMany.mockResolvedValue([
            {
                id: "commenter",
                ruleEvent: "forum.post.created",
                ruleThreshold: 10,
                ruleType: "event-count",
            },
        ]);
        activityFeedItemCount.mockResolvedValue(3);

        await engine.registerTrophyListeners();
        await hooks.doActionAsync("forum.post.created", { userId: "user-2" });

        expect(userTrophyUpsert).not.toHaveBeenCalled();
    });

    it("ignores payload without userId/authorId", async () => {
        trophyFindMany.mockResolvedValue([
            {
                id: "first-post",
                ruleEvent: "forum.topic.created",
                ruleThreshold: 1,
                ruleType: "event-count",
            },
        ]);

        await engine.registerTrophyListeners();
        await hooks.doActionAsync("forum.topic.created", {});
        expect(activityFeedItemCount).not.toHaveBeenCalled();
        expect(userTrophyUpsert).not.toHaveBeenCalled();
    });

    it("skips award when trophy has been deactivated between scan and hit", async () => {
        trophyFindMany.mockResolvedValue([
            {
                id: "first-post",
                ruleEvent: "forum.topic.created",
                ruleThreshold: 1,
                ruleType: "event-count",
            },
        ]);
        activityFeedItemCount.mockResolvedValue(5);
        trophyFindUnique.mockResolvedValue({ id: "first-post", isActive: false });

        await engine.registerTrophyListeners();
        await hooks.doActionAsync("forum.topic.created", { userId: "user-3" });
        expect(userTrophyUpsert).not.toHaveBeenCalled();
    });
});
