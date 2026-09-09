/**
 * The category screen could create and delete, never edit.
 *
 * So a name typed wrongly meant deleting the shelf - and with it every
 * product's place on it - and building it again. It also left the shelf gate
 * settable only through the API: the column existed and no form could reach
 * it.
 *
 * Editing and creating differ in exactly two things, and both are the kind
 * that fail quietly. The wrong address creates a second category that looks
 * like a successful edit until somebody counts them, and the wrong verb sends
 * a partial row to a route expecting a whole one.
 */
import { describe, it, expect } from "vitest";
import { categoryWriteTarget, categoryPayload, EMPTY_CATEGORY } from "@/modules/store/pages/admin/categories/category-form";

describe("where the category form writes", () => {
    it("creates at the collection when nothing is being edited", () => {
        expect(categoryWriteTarget(null)).toEqual({
            url: "/api/v1/store/categories",
            method: "POST",
        });
    });

    it("updates the row itself when one is", () => {
        expect(categoryWriteTarget("cat-1")).toEqual({
            url: "/api/v1/store/categories/cat-1",
            method: "PATCH",
        });
    });
});

describe("what the category form sends", () => {
    it("sends no parent as null rather than as an empty string", () => {
        // "" is a category id that matches nothing, and Prisma would take it
        // as a real one and fail on a foreign key nobody could read.
        expect(categoryPayload(EMPTY_CATEGORY).parentId).toBeNull();
        expect(categoryPayload({ ...EMPTY_CATEGORY, parentId: "root" }).parentId).toBe("root");
    });

    it("sends the shelf gate as a list, empty when nothing was picked", () => {
        expect(categoryPayload(EMPTY_CATEGORY).visibleAfterProductIds).toEqual([]);
        expect(
            categoryPayload({ ...EMPTY_CATEGORY, visibleAfterProductIds: ["vip"] }).visibleAfterProductIds,
        ).toEqual(["vip"]);
    });

    it("sends the order as a number, and zero for an empty box", () => {
        expect(categoryPayload({ ...EMPTY_CATEGORY, order: "" }).order).toBe(0);
        expect(categoryPayload({ ...EMPTY_CATEGORY, order: "7" }).order).toBe(7);
    });
});
