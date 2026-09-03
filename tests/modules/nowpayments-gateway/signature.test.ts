// @vitest-environment node
/**
 * NOWPayments signs the IPN object, not the bytes that arrived.
 *
 * That distinction is the whole test: the signature is an HMAC over the JSON
 * re-serialised with its keys sorted, so a body whose fields arrive in a
 * different order still verifies, and a body whose values were changed does
 * not.
 */
import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";

vi.mock("@/core/sdk/server", () => ({ prisma: {} }));

const { sortedJson, ipnSignature } = await import("@/modules/nowpayments-gateway/lib/nowpayments");

describe("sortedJson", () => {
    it("sorts the keys, at every level", () => {
        expect(sortedJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    });

    it("leaves arrays in the order they arrived", () => {
        expect(sortedJson({ list: [3, 1, 2] })).toBe('{"list":[3,1,2]}');
    });
});

describe("ipnSignature", () => {
    const body = { payment_status: "finished", order_id: "order-1", price_amount: 42 };

    it("is an HMAC-SHA512 of the sorted body", () => {
        const expected = crypto.createHmac("sha512", "s3cret").update(sortedJson(body)).digest("hex");
        expect(ipnSignature("s3cret", body)).toBe(expected);
    });

    // The same payment, serialised by a different JSON writer, has to verify.
    it("does not depend on the order the fields arrived in", () => {
        const reordered = { price_amount: 42, order_id: "order-1", payment_status: "finished" };
        expect(ipnSignature("s3cret", reordered)).toBe(ipnSignature("s3cret", body));
    });

    it("changes when a single value is edited", () => {
        const tampered = { ...body, price_amount: 4200 };
        expect(ipnSignature("s3cret", tampered)).not.toBe(ipnSignature("s3cret", body));
    });

    it("changes with the secret", () => {
        expect(ipnSignature("other", body)).not.toBe(ipnSignature("s3cret", body));
    });
});
