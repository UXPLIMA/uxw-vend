// @vitest-environment node
/**
 * Paymentwall's signature, which is both halves of the integration: it is what
 * makes a widget URL valid, and the only thing standing between a pingback and
 * a free order.
 */
import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";

vi.mock("@/core/sdk/server", () => ({ prisma: {} }));

const { paymentwallSign, pingbackKind } = await import("@/modules/paymentwall-gateway/lib/paymentwall");

describe("paymentwallSign", () => {
    it("concatenates name=value in sorted order and appends the secret", () => {
        const params = { b: "2", a: "1" };
        const expected = crypto.createHash("sha256").update("a=1b=2secret", "utf8").digest("hex");
        expect(paymentwallSign(params, "secret")).toBe(expected);
    });

    // The signature that arrived is not part of what was signed.
    it("ignores an existing sig field", () => {
        const withSig = { a: "1", sig: "whatever" };
        expect(paymentwallSign(withSig, "secret")).toBe(paymentwallSign({ a: "1" }, "secret"));
    });

    it("changes when a parameter is edited", () => {
        expect(paymentwallSign({ amount: "1.00" }, "secret")).not.toBe(
            paymentwallSign({ amount: "100.00" }, "secret"),
        );
    });
});

describe("pingbackKind", () => {
    it("delivers on the two types that mean the buyer paid", () => {
        expect(pingbackKind("0")).toBe("deliver");
        expect(pingbackKind("1")).toBe("deliver");
    });

    it("withdraws on a chargeback or a refund", () => {
        expect(pingbackKind("2")).toBe("withdraw");
        expect(pingbackKind("3")).toBe("withdraw");
    });

    it("does nothing for a type it does not know", () => {
        expect(pingbackKind("9")).toBe("unknown");
        expect(pingbackKind("")).toBe("unknown");
    });
});
