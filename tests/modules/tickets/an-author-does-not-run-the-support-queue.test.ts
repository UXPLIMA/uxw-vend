/**
 * Which fields on a ticket belong to the person who opened it.
 *
 * `canAccessTicket(userId, id, "edit")` answers one question: may this person
 * touch this ticket at all. The owner passes it, which is right - they have to
 * be able to close their own ticket. The update handler then read that single
 * yes as permission to write every field on the row.
 *
 * Measured against a production build with a real member session: the author
 * of a ticket set it to URGENT, assigned it to an admin, assigned it to a
 * different plain member, and marked it RESOLVED. Every one answered 200.
 *
 * What breaks is the queue. Priority is how a support team decides what to
 * look at first, and it was writable by the person waiting in the line -
 * everyone picks URGENT and the field stops meaning anything. Assignment is
 * who is responsible, and it could be set to anybody with an account, staff or
 * not; an id that belongs to nobody was already refused, but being a real
 * person was the only requirement.
 *
 * So the two questions are separated. An owner may close their ticket or
 * reopen it, because that is a statement about their own problem. Priority,
 * assignment and the working states in between are the support team's, and an
 * assignee has to actually be on that team.
 */
import { describe, it, expect } from "vitest";
import {
    ticketFieldsFor,
    OWNER_STATUSES,
} from "@/modules/tickets/lib/ticket-edit-rights";

const OWNER = { isStaff: false };
const STAFF = { isStaff: true };

describe("what an owner may write", () => {
    it("may close their own ticket", () => {
        expect(ticketFieldsFor(OWNER, { status: "CLOSED" })).toEqual({
            allowed: { status: "CLOSED" },
            refused: [],
        });
    });

    it("may reopen it, because a problem can come back", () => {
        expect(ticketFieldsFor(OWNER, { status: "OPEN" })).toEqual({
            allowed: { status: "OPEN" },
            refused: [],
        });
    });

    it("may not set the states the team works in", () => {
        for (const status of ["IN_PROGRESS", "WAITING_REPLY", "RESOLVED"]) {
            expect(ticketFieldsFor(OWNER, { status }), status).toEqual({
                allowed: {},
                refused: ["status"],
            });
        }
    });

    it("may not set the priority the queue is ordered by", () => {
        expect(ticketFieldsFor(OWNER, { priority: "URGENT" })).toEqual({
            allowed: {},
            refused: ["priority"],
        });
    });

    it("may not decide who is responsible", () => {
        expect(ticketFieldsFor(OWNER, { assignedToId: "someone" })).toEqual({
            allowed: {},
            refused: ["assignedToId"],
        });
        expect(ticketFieldsFor(OWNER, { assignedToId: null })).toEqual({
            allowed: {},
            refused: ["assignedToId"],
        });
    });

    it("keeps what it may and refuses the rest, rather than failing the whole call", () => {
        // A screen that sends the fields it has must not lose the one change
        // the owner is entitled to make.
        expect(
            ticketFieldsFor(OWNER, { status: "CLOSED", priority: "URGENT", assignedToId: "x" }),
        ).toEqual({
            allowed: { status: "CLOSED" },
            refused: ["priority", "assignedToId"],
        });
    });
});

describe("what the support team may write", () => {
    it("may write all of it", () => {
        const fields = { status: "IN_PROGRESS", priority: "URGENT", assignedToId: "agent" };
        expect(ticketFieldsFor(STAFF, fields)).toEqual({ allowed: fields, refused: [] });
    });

    it("may unassign", () => {
        expect(ticketFieldsFor(STAFF, { assignedToId: null })).toEqual({
            allowed: { assignedToId: null },
            refused: [],
        });
    });
});

describe("the statuses an owner owns", () => {
    it("are the two that are about their problem, not about the work", () => {
        expect([...OWNER_STATUSES]).toEqual(["OPEN", "CLOSED"]);
    });
});

describe("an empty change", () => {
    it("is allowed and writes nothing", () => {
        expect(ticketFieldsFor(OWNER, {})).toEqual({ allowed: {}, refused: [] });
        expect(ticketFieldsFor(STAFF, {})).toEqual({ allowed: {}, refused: [] });
    });
});
