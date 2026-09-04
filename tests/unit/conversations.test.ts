import { describe, it, expect } from "vitest";
import { oneToOneConversationWhere } from "@/core/lib/conversations";

/**
 * Evaluates the shape of a Prisma relation filter against a plain object, so
 * the clause can be tested for what it means rather than for how it is
 * written. Supports exactly the operators the clause uses.
 */
type Conversation = { id: string; participants: { userId: string }[] };
type Where = Record<string, unknown>;

function participantMatches(participant: { userId: string }, condition: Where): boolean {
    const expected = condition.userId;
    if (typeof expected === "string") return participant.userId === expected;
    if (expected && typeof expected === "object" && "in" in expected) {
        return (expected.in as string[]).includes(participant.userId);
    }
    throw new Error(`unsupported participant condition: ${JSON.stringify(condition)}`);
}

function matches(conversation: Conversation, where: Where): boolean {
    if (Array.isArray(where.AND)) {
        return (where.AND as Where[]).every((clause) => matches(conversation, clause));
    }
    const relation = where.participants as Where | undefined;
    if (!relation) throw new Error(`unsupported where: ${JSON.stringify(where)}`);
    if (relation.some) {
        return conversation.participants.some((p) => participantMatches(p, relation.some as Where));
    }
    if (relation.every) {
        return conversation.participants.every((p) => participantMatches(p, relation.every as Where));
    }
    throw new Error(`unsupported relation filter: ${JSON.stringify(relation)}`);
}

/** What the clause used to be: every participant is one of the two. */
const everyOnly = (a: string, b: string) => ({
    participants: { every: { userId: { in: [a, b] } } },
});

const ME = "user-me";
const THEM = "user-them";
const THIRD = "user-third";

const real: Conversation = { id: "real", participants: [{ userId: ME }, { userId: THEM }] };
/** What `softDeleteUser` leaves behind: it deletes the leaving user's participant row. */
const orphan: Conversation = { id: "orphan", participants: [{ userId: ME }] };
const empty: Conversation = { id: "empty", participants: [] };
const group: Conversation = {
    id: "group",
    participants: [{ userId: ME }, { userId: THEM }, { userId: THIRD }],
};
const unrelated: Conversation = { id: "other", participants: [{ userId: ME }, { userId: THIRD }] };

describe("oneToOneConversationWhere", () => {
    const where = oneToOneConversationWhere(ME, THEM);

    it("matches the 1:1 conversation between the two", () => {
        expect(matches(real, where)).toBe(true);
    });

    it("does not match a conversation the other person has left", () => {
        expect(matches(orphan, where)).toBe(false);
    });

    it("does not match a conversation with no participants left", () => {
        expect(matches(empty, where)).toBe(false);
    });

    it("does not match a group conversation that contains both", () => {
        expect(matches(group, where)).toBe(false);
    });

    it("does not match a conversation with somebody else", () => {
        expect(matches(unrelated, where)).toBe(false);
    });

    it("is symmetric in its two users", () => {
        expect(matches(real, oneToOneConversationWhere(THEM, ME))).toBe(true);
    });
});

/**
 * The reason the clause changed. `findFirst` has no order to fall back on, so
 * whenever an orphan matches it can be returned instead of the real thread -
 * and the caller, seeing a participant count that is not 2, started a second
 * conversation with someone it already had one with.
 */
describe("the clause it replaced", () => {
    it("matched the orphan and the empty conversation", () => {
        expect(matches(orphan, everyOnly(ME, THEM))).toBe(true);
        expect(matches(empty, everyOnly(ME, THEM))).toBe(true);
    });

    it("which is what the new clause fixes", () => {
        const where = oneToOneConversationWhere(ME, THEM);
        for (const conversation of [orphan, empty]) {
            expect(matches(conversation, everyOnly(ME, THEM))).toBe(true);
            expect(matches(conversation, where)).toBe(false);
        }
    });
});
