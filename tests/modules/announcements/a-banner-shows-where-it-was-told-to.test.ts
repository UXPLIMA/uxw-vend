// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isVisibleOnPage } from "../../../module-sources/announcements/lib/visible-on";

/**
 * An announcement shows where the operator said it should.
 *
 * The admin screen has two of these rules, `includePages` and
 * `excludePages`, and they reached nothing. The banner mounted in the site's
 * layout never read them, and neither did the page builder block; the only
 * component that did was imported by nobody. So an operator who limited a
 * notice to the store still saw it on every page, and the setting looked like
 * it worked because there was code that implemented it.
 *
 * The admin panel is the default the rules do not have to spell out. A
 * message written for visitors was drawn above a panel that starts at the top
 * of the window, so the sidebar covered half of it and the screen opened on a
 * clipped sentence. It is a tool rather than a page of the site, so a banner
 * reaches it only when `includePages` says so in as many words.
 */
const plain = { includePages: null, excludePages: null };

describe("an announcement shows where it was told to", () => {
    it("shows on the site when no rule was written", () => {
        expect(isVisibleOnPage(plain, "/")).toBe(true);
        expect(isVisibleOnPage(plain, "/store")).toBe(true);
        expect(isVisibleOnPage(plain, "/forum/topic/1/a-thing")).toBe(true);
    });

    it("stays out of the admin panel unless it was asked in", () => {
        expect(isVisibleOnPage(plain, "/admin")).toBe(false);
        expect(isVisibleOnPage(plain, "/admin/users")).toBe(false);
        expect(isVisibleOnPage({ includePages: "/admin/*", excludePages: null }, "/admin/users")).toBe(true);
    });

    it("reads the path the visitor is on, not the one with the locale in it", () => {
        expect(isVisibleOnPage(plain, "/tr/admin/users")).toBe(false);
        expect(isVisibleOnPage({ includePages: "/store", excludePages: null }, "/en/store")).toBe(true);
    });

    it("narrows to what include names", () => {
        const storeOnly = { includePages: "/store, /store/*", excludePages: null };
        expect(isVisibleOnPage(storeOnly, "/store")).toBe(true);
        expect(isVisibleOnPage(storeOnly, "/store/product/4/vip")).toBe(true);
        expect(isVisibleOnPage(storeOnly, "/")).toBe(false);
    });

    it("drops what exclude names", () => {
        const notTheCart = { includePages: null, excludePages: "/store/cart" };
        expect(isVisibleOnPage(notTheCart, "/store/cart")).toBe(false);
        expect(isVisibleOnPage(notTheCart, "/store")).toBe(true);
    });

    it("treats a pattern as a pattern, not as a regular expression", () => {
        // "/store.cart" is not "/store/cart", and a dot in a pattern is a dot.
        expect(isVisibleOnPage({ includePages: "/store/cart", excludePages: null }, "/storeXcart")).toBe(false);
    });
});
