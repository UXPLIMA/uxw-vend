/**
 * The form for an order typed in by hand, and the boxes it must not guess at.
 *
 * A blank price and a price of zero look the same to `Number()` and mean
 * opposite things here. Zero is what a replacement is worth and an operator
 * types it on purpose; blank is a row they have not finished. Guessing turns
 * an unfinished row into a product given away, and dropping it silently
 * removes a product they chose.
 *
 * So the form answers with the row number and lets the screen ask. A quantity
 * box left alone is different: one is the only sensible reading of "I picked
 * this product", so it fills itself in.
 */
import { describe, it, expect } from "vitest";
import {
    manualOrderPayload,
    EMPTY_MANUAL_ORDER,
} from "@/modules/store/pages/admin/orders/manual-order-form";

const base = { ...EMPTY_MANUAL_ORDER, userId: "u1" };

describe("what the hand-entered order form sends", () => {
    it("sends the chosen lines with what was typed", () => {
        const result = manualOrderPayload({
            ...base,
            lines: [{ productId: "vip", quantity: "2", unitAmount: "10" }],
        });
        expect(result).toEqual({
            payload: expect.objectContaining({
                userId: "u1",
                markPaid: false,
                lines: [{ productId: "vip", quantity: 2, unitAmount: 10 }],
            }),
        });
    });

    it("reads an untouched quantity as one", () => {
        const result = manualOrderPayload({
            ...base,
            lines: [{ productId: "vip", quantity: "", unitAmount: "10" }],
        });
        expect(result).toEqual({ payload: expect.objectContaining({ lines: [
            { productId: "vip", quantity: 1, unitAmount: 10 },
        ] }) });
    });

    it("keeps a price of zero, which is what a replacement is worth", () => {
        const result = manualOrderPayload({
            ...base,
            lines: [{ productId: "vip", quantity: "1", unitAmount: "0" }],
        });
        expect(result).toEqual({ payload: expect.objectContaining({ lines: [
            { productId: "vip", quantity: 1, unitAmount: 0 },
        ] }) });
    });

    it("names a row whose price was never filled in, rather than giving it away", () => {
        const result = manualOrderPayload({
            ...base,
            lines: [
                { productId: "vip", quantity: "1", unitAmount: "10" },
                { productId: "key", quantity: "1", unitAmount: "" },
            ],
        });
        expect(result).toEqual({ blankPrice: 2 });
    });

    it("ignores a row where no product was chosen at all", () => {
        const result = manualOrderPayload({
            ...base,
            lines: [
                { productId: "vip", quantity: "1", unitAmount: "10" },
                { productId: "", quantity: "", unitAmount: "" },
            ],
        });
        expect(result).toEqual({ payload: expect.objectContaining({ lines: [
            { productId: "vip", quantity: 1, unitAmount: 10 },
        ] }) });
    });

    it("says there is nothing to save when no product was chosen anywhere", () => {
        expect(manualOrderPayload(base)).toEqual({ empty: true });
    });

    it("says who it is for is missing before it looks at the rows", () => {
        const noBuyer = { ...EMPTY_MANUAL_ORDER, lines: [{ productId: "vip", quantity: "1", unitAmount: "" }] };
        expect(manualOrderPayload(noBuyer)).toEqual({ noBuyer: true });
    });
});
