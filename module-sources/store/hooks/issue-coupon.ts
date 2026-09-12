/**
 * Answers `coupon.issue`: somebody won a discount and the shop is what a
 * discount means here.
 *
 * Written on the caller's transaction, so the prize and the coupon commit
 * together: a wheel that promised a code and then failed to create it is a
 * support ticket with the code in it.
 */
import type { HookHandlerFor } from "@/core/sdk";

const issueCoupon: HookHandlerFor<"coupon.issue", "filter"> = async (current, request) => {
    if (current?.issued) return current;
    if (!request?.tx || !request.code || !(request.amount > 0)) return { issued: false };

    await request.tx.coupon.create({
        data: {
            code: request.code,
            description: request.description ?? null,
            type: "FIXED",
            value: request.amount,
            usageLimit: request.usageLimit ?? 1,
            isActive: true,
        },
    });

    return { issued: true };
};

export default issueCoupon;
