/**
 * Who the audit trail blames when an administrator is impersonating.
 *
 * `logActivity` rewrites the actor while an impersonation is active: the row
 * names the real administrator and the impersonated account moves into
 * `metadata.impersonating`. Without that, an administrator could launder
 * mutations through a victim's session and the trail would blame the victim,
 * which is the failure the whole audit log exists to prevent. It had no test.
 *
 * The other half is that logging never breaks the thing being logged. A
 * failed write, or an `auth()` call outside a request context, has to leave
 * the caller's mutation alone.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const created: Record<string, unknown>[] = [];
let sessionValue: unknown = null;
let createThrows = false;

vi.mock("@/core/lib/auth", () => ({
    auth: async () => {
        if (sessionValue === "throw") throw new Error("no request context");
        return sessionValue;
    },
}));

vi.mock("@/core/lib/db", () => ({
    prisma: {
        activityLog: {
            create: async (args: { data: Record<string, unknown> }) => {
                if (createThrows) throw new Error("database is down");
                created.push(args.data);
                return args.data;
            },
        },
    },
}));

const { logActivity } = await import("@/core/lib/activity-log");

describe("an audit row", () => {
    beforeEach(() => {
        created.length = 0;
        sessionValue = null;
        createThrows = false;
    });

    it("records the action as given when nobody is impersonating", async () => {
        sessionValue = { user: { id: "admin-1" } };
        await logActivity({ userId: "admin-1", action: "user.banned", entity: "user", entityId: "victim-9" });

        expect(created).toHaveLength(1);
        expect(created[0]).toMatchObject({
            userId: "admin-1",
            action: "user.banned",
            entity: "user",
            entityId: "victim-9",
        });
    });

    it("names the real administrator, not the account being impersonated", async () => {
        // The session is acting as user-7; the administrator behind it is
        // admin-1. A row naming user-7 would blame the victim.
        sessionValue = { user: { id: "user-7", originalUserId: "admin-1" } };
        await logActivity({ userId: "user-7", action: "credits.granted" });

        expect(created[0].userId, "the row must blame the administrator").toBe("admin-1");
        expect(created[0].metadata).toMatchObject({ impersonating: "user-7" });
    });

    it("leaves the internal skip flag out of the stored metadata", async () => {
        sessionValue = { user: { id: "user-7", originalUserId: "admin-1" } };
        await logActivity({
            userId: "user-7",
            action: "credits.granted",
            metadata: { __impersonationChecked: true, amount: 5 },
        });

        // The flag is a signal to this function, not part of the record.
        expect(created[0].metadata).not.toHaveProperty("__impersonationChecked");
        expect(created[0].metadata).toMatchObject({ amount: 5 });
        // Skipping the lookup means the actor is left exactly as given.
        expect(created[0].userId).toBe("user-7");
    });

    it("records the event as-is when there is no request context to ask", async () => {
        // Cron and background jobs have no session; `auth()` throws there.
        sessionValue = "throw";
        await logActivity({ userId: "system-1", action: "cron.ran" });

        expect(created).toHaveLength(1);
        expect(created[0].userId).toBe("system-1");
    });

    it("stores no metadata column rather than an empty object", async () => {
        sessionValue = { user: { id: "admin-1" } };
        await logActivity({ userId: "admin-1", action: "settings.saved" });
        // Prisma.JsonNull, not `{}`: a row with an empty object reads as
        // "there was metadata and it said nothing".
        expect(created[0].metadata).not.toEqual({});
    });

    it("records nobody when the caller names nobody, even mid-impersonation", async () => {
        // Documented rather than endorsed. The rewrite is keyed on the
        // caller passing the impersonated id, so a caller that passes none
        // produces an anonymous row while an administrator is acting as
        // someone else. Every current caller passes the session id.
        sessionValue = { user: { id: "user-7", originalUserId: "admin-1" } };
        await logActivity({ action: "something.happened" });

        expect(created[0].userId).toBeNull();
        expect(created[0].metadata).not.toMatchObject({ impersonating: "user-7" });
    });

    it("does not take the caller down when the write fails", async () => {
        // A mutation that succeeded must not be reported as failed because
        // its audit row could not be stored.
        createThrows = true;
        await expect(logActivity({ userId: "admin-1", action: "user.banned" })).resolves.toBeUndefined();
    });
});
