/**
 * What the permission grid sends, and why it cannot just send the ticks.
 *
 * `accessByRole` has two silences that mean opposite things. A category nobody
 * has ruled on is open, because anything else turns installing a permission
 * system into an outage. A category where somebody has written a list, and the
 * list does not name this role, is shut to it, because once an operator has
 * written a list the list is the answer.
 *
 * A grid that sends only the ticked rows walks straight into the gap between
 * them. An operator who unticks every role has said "nobody may be in here";
 * what arrives is an empty list, which is read as "nobody has ruled on this",
 * and the category opens to everybody. The strictest thing the screen can
 * express would produce the loosest thing the site can do, silently, with a
 * green toast.
 *
 * So a role that may do nothing is still a row. Clearing the matrix is a
 * separate act with its own button, and it is the only thing that sends an
 * empty list.
 *
 * The second trap is smaller and the same shape. `accessByRole` reads "may
 * post but may not view" as nothing at all, because writing in something you
 * cannot open is a contradiction that draws a reply box on a page that 404s.
 * A grid that lets an operator tick post alone shows them a permission the
 * site does not have, so the tick is taken back here rather than discarded
 * silently three layers down.
 */
import { describe, it, expect } from "vitest";
import { accessByRole } from "@/core/lib/access-by-role";
import { clearedMatrix, normalisedMatrix } from "@/modules/forum/lib/permission-matrix";

const draft = (roleId: string, canView: boolean, canPost: boolean, canReply: boolean) =>
    ({ roleId, canView, canPost, canReply });

const CATEGORY = { id: "general", parentId: null };

/** What the endpoint stores, fed back through what enforces it. */
const asRules = (rows: { roleId: string; canView: boolean; canPost: boolean; canReply: boolean }[]) =>
    rows.map((row) => ({ ...row, containerId: CATEGORY.id }));

describe("what the grid sends", () => {
    it("keeps a row for a role that may do nothing", () => {
        const sent = normalisedMatrix([draft("member", false, false, false)]);
        expect(sent).toHaveLength(1);
        expect(sent[0]).toEqual({ roleId: "member", canView: false, canPost: false, canReply: false });
    });

    it("keeps every role, so unticking all of them shuts the category", () => {
        const sent = normalisedMatrix([
            draft("member", false, false, false),
            draft("staff", false, false, false),
        ]);
        expect(sent).toHaveLength(2);
        const shut = accessByRole(CATEGORY, [], asRules(sent), "member");
        expect(shut).toEqual({ view: false, post: false, reply: false });
    });

    it("takes back a tick that says post but not view", () => {
        const sent = normalisedMatrix([draft("member", false, true, true)]);
        expect(sent[0]).toEqual({ roleId: "member", canView: false, canPost: false, canReply: false });
    });

    it("leaves a role that may read and not write alone", () => {
        const sent = normalisedMatrix([draft("member", true, false, false)]);
        expect(sent[0]).toEqual({ roleId: "member", canView: true, canPost: false, canReply: false });
    });

    it("drops a row with no role, which is a half-made line in the grid", () => {
        expect(normalisedMatrix([draft("", true, true, true)])).toEqual([]);
    });

    it("keeps the last word when a role appears twice", () => {
        const sent = normalisedMatrix([
            draft("member", true, true, true),
            draft("member", true, false, false),
        ]);
        expect(sent).toHaveLength(1);
        expect(sent[0].canPost).toBe(false);
    });
});

describe("clearing the matrix", () => {
    it("is the one thing that sends nothing, and it opens the category", () => {
        expect(clearedMatrix()).toEqual([]);
        const open = accessByRole(CATEGORY, [], asRules(clearedMatrix()), "member");
        expect(open).toEqual({ view: true, post: true, reply: true });
    });
});

describe("what the operator saw is what the site then does", () => {
    const rows = [
        draft("staff", true, true, true),
        draft("member", true, false, true),
        draft("guest", false, false, false),
    ];
    const sent = asRules(normalisedMatrix(rows));

    it("gives staff everything they were ticked for", () => {
        expect(accessByRole(CATEGORY, [], sent, "staff")).toEqual({ view: true, post: true, reply: true });
    });

    it("gives a member reading and replying but not starting a thread", () => {
        expect(accessByRole(CATEGORY, [], sent, "member")).toEqual({ view: true, post: false, reply: true });
    });

    it("shuts out the role that was ticked for nothing", () => {
        expect(accessByRole(CATEGORY, [], sent, "guest")).toEqual({ view: false, post: false, reply: false });
    });

    it("shuts out a role the operator never put in the grid", () => {
        expect(accessByRole(CATEGORY, [], sent, "stranger")).toEqual({ view: false, post: false, reply: false });
    });
});
