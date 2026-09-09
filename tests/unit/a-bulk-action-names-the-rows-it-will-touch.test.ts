/**
 * The count on a bulk button is a promise about what is on screen.
 *
 * The CRUD list ticks rows into a set and puts its size on a destructive
 * button: "Delete 12". The set outlived everything - the page, the search,
 * the refetch after a create - so an operator could tick five rows, page on,
 * tick three more, and be offered "Delete 8" while looking at three. Worse,
 * ticking rows and then deleting one of them elsewhere left an id in the set
 * that named nothing, and the button counted it anyway.
 *
 * So the rule: a selection is narrowed to the rows currently listed, every
 * time the listing changes. The number on the button is then always the
 * number of rows the operator can see and the action will touch. Selecting
 * across pages is the thing being given up, and it is worth giving up: the
 * button cannot lie about a page it is not on.
 *
 * The header box is the other half. Two hundred rows and no select-all is
 * two hundred clicks, and a box that shows "all" while some rows are unticked
 * is a box that deselects everything on the next click.
 */
import { describe, it, expect } from "vitest";
import { headerState, narrowTo, pickAll, pickNone, togglePick } from "@/core/lib/bulk-selection";

const set = (...ids: string[]) => new Set(ids);

describe("ticking one row", () => {
    it("adds it", () => {
        expect([...togglePick(set(), "a")]).toEqual(["a"]);
    });

    it("takes it back off", () => {
        expect([...togglePick(set("a", "b"), "a")]).toEqual(["b"]);
    });

    it("leaves the set it was given alone", () => {
        const before = set("a");
        togglePick(before, "b");
        expect([...before]).toEqual(["a"]);
    });
});

describe("the header box", () => {
    it("is empty when nothing on the page is ticked", () => {
        expect(headerState(set(), ["a", "b"])).toBe("none");
        expect(headerState(set("z"), ["a", "b"])).toBe("none");
    });

    it("is partly filled when some of the page is ticked", () => {
        expect(headerState(set("a"), ["a", "b"])).toBe("some");
    });

    it("is full only when every listed row is ticked", () => {
        expect(headerState(set("a", "b"), ["a", "b"])).toBe("all");
    });

    it("is empty for an empty page rather than full", () => {
        // `every` over nothing is true, which would tick the box on a list
        // with no rows and offer an action over none of them.
        expect(headerState(set(), [])).toBe("none");
        expect(headerState(set("a"), [])).toBe("none");
    });

    it("ticks and unticks the whole page", () => {
        expect([...pickAll(set(), ["a", "b"])].sort()).toEqual(["a", "b"]);
        expect([...pickNone()]).toEqual([]);
    });
});

describe("when the listing changes under a selection", () => {
    it("drops what is no longer listed", () => {
        expect([...narrowTo(set("a", "b", "c"), ["b", "c", "d"])].sort()).toEqual(["b", "c"]);
    });

    it("empties the selection when the page has nothing in common with it", () => {
        expect([...narrowTo(set("a"), ["b"])]).toEqual([]);
    });

    it("returns the same set when nothing was dropped, so a render is not forced", () => {
        const before = set("a", "b");
        expect(narrowTo(before, ["a", "b", "c"])).toBe(before);
    });

    it("keeps an empty selection empty without making a new one", () => {
        const before = set();
        expect(narrowTo(before, ["a"])).toBe(before);
    });
});
