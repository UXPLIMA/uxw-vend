/**
 * What the campaign form sends, and the one entry it must never send.
 *
 * The form is a list of products with a price box beside each. An operator
 * ticks four products, fills three prices and saves - and `Number("")` is 0,
 * so the fourth goes on sale for nothing. Nobody notices until the orders
 * arrive, and by then the shop has given the product away.
 *
 * So a row without a price is not part of the campaign. Zero typed on purpose
 * still is: an operator can mean free, and the difference between meaning it
 * and leaving the box alone is the whole point.
 */
import { describe, it, expect } from "vitest";
import {
    campaignPayload,
    EMPTY_CAMPAIGN,
} from "@/modules/store/pages/admin/campaigns/campaign-form";

describe("what the campaign form sends", () => {
    it("drops a chosen product whose price was left blank", () => {
        const value = {
            ...EMPTY_CAMPAIGN,
            entries: [
                { productId: "vip", price: "12", stock: "" },
                { productId: "key", price: "", stock: "" },
            ],
        };
        expect(campaignPayload(value).entries).toEqual([
            { productId: "vip", price: 12, stock: null },
        ]);
    });

    it("keeps a price of zero that somebody typed", () => {
        const value = { ...EMPTY_CAMPAIGN, entries: [{ productId: "vip", price: "0", stock: "" }] };
        expect(campaignPayload(value).entries).toEqual([
            { productId: "vip", price: 0, stock: null },
        ]);
    });

    it("drops a price that is negative or not a number", () => {
        const value = {
            ...EMPTY_CAMPAIGN,
            entries: [
                { productId: "a", price: "-5", stock: "" },
                { productId: "b", price: "abc", stock: "" },
            ],
        };
        expect(campaignPayload(value).entries).toEqual([]);
    });

    it("sends a blank stock box as no limit", () => {
        const value = { ...EMPTY_CAMPAIGN, entries: [{ productId: "vip", price: "12", stock: "" }] };
        expect(campaignPayload(value).entries[0].stock).toBeNull();
    });

    it("keeps only the last entry when a product is listed twice", () => {
        // The table has one row per product per campaign, so two would be two
        // prices with nothing to choose between them.
        const value = {
            ...EMPTY_CAMPAIGN,
            entries: [
                { productId: "vip", price: "12", stock: "" },
                { productId: "vip", price: "9", stock: "" },
            ],
        };
        expect(campaignPayload(value).entries).toEqual([
            { productId: "vip", price: 9, stock: null },
        ]);
    });

    it("turns the hour boxes into minutes, and empty ones into all day", () => {
        expect(campaignPayload({ ...EMPTY_CAMPAIGN, from24: "18:30", until24: "23:00" })).toMatchObject({
            fromMinute: 1110,
            untilMinute: 1380,
        });
        expect(campaignPayload(EMPTY_CAMPAIGN)).toMatchObject({
            fromMinute: null,
            untilMinute: null,
        });
    });
});
