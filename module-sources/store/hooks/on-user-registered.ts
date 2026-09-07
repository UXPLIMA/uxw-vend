import { log, prisma } from "@/core/sdk/server";
import { randomBytes } from "crypto";

/**
 * Declarative hook listener - wired by module.json hookListeners.
 *
 * When a new user registers (core `user.registered` action), create a personal
 * one-time 10% welcome coupon. Fails gracefully if the Coupon model isn't
 * present (e.g. store module disabled mid-migration).
 */
export default async function onUserRegistered(payload: {
    userId: string;
    email: string;
    username: string;
}) {
    try {
        const code = `WELCOME-${randomBytes(3).toString("hex").toUpperCase()}`;
        const client = prisma as unknown as {
            coupon?: { create?: (args: unknown) => Promise<unknown> };
        };
        if (typeof client.coupon?.create !== "function") return;

        await client.coupon.create({
            data: {
                code,
                description: `Welcome coupon for ${payload.username}`,
                type: "PERCENTAGE",
                value: 10,
                usageLimit: 1,
                isActive: true,
            },
        });
    } catch (err) {
        log.error("[store] Failed to create welcome coupon", { error: err instanceof Error ? err.message : String(err) });
    }
}
