// @vitest-environment node
/**
 * What the store does once a gateway says the money arrived.
 *
 * This is the half of the payment contract the store owns. A gateway reports a
 * settlement; everything here - marking the order, granting the products,
 * recording the payment, refusing to do any of it twice - is the store's, and
 * it is the same code whether the money came through Stripe, PayPal or a
 * gateway nobody has written yet.
 *
 * Idempotency is the point of most of these tests. Webhooks retry by design,
 * and a buyer can reload a return URL, so every entry point has to be safe to
 * call again with the same settlement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = {
    order: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    chestItem: { create: vi.fn(async () => ({})) },
    ownedProduct: { upsert: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({})) },
    payment: { create: vi.fn(async () => ({})), findFirst: vi.fn(), update: vi.fn(async () => ({})) },
    productCommand: { findMany: vi.fn(async () => []) },
    user: { update: vi.fn(async () => ({})) },
    creditTransaction: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    subscription: { findFirst: vi.fn(), update: vi.fn(async () => ({})), create: vi.fn(async () => ({})) },
    // The real client runs these atomically; the promises are already built by
    // the caller, so awaiting them is the same set of writes in the same order.
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
};

vi.mock("@/core/sdk/server", () => ({
    prisma: db,
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const sendOrderConfirmationEmail = vi.fn(async () => {});
vi.mock("@/modules/store/lib/email", () => ({ sendOrderConfirmationEmail }));
const deliverProduct = vi.fn(async () => ({}));
vi.mock("@/modules/store/lib/delivery", () => ({ deliverProduct }));
const announceOrderCompleted = vi.fn(async () => {});
vi.mock("@/modules/store/lib/order-events", () => ({ announceOrderCompleted }));

const { settleOrder, settleCredits, voidOrder, refundPayment, applySubscriptionChange } = await import(
    "@/modules/store/lib/fulfilment"
);

const settlement: PaymentSettlement = {
    kind: "order",
    reference: "order-1",
    provider: "stripe",
    providerRef: "pi_123",
    amount: 42,
    currency: "USD",
    metadata: { playerName: "Steve" },
};

const paidOrder = {
    id: "order-1",
    status: "COMPLETED",
    orderNumber: "ORD-1",
    userId: "user-1",
    total: 42,
    currency: "USD",
    metadata: { playerName: "Steve" },
    user: { email: "buyer@example.com", username: "Steve" },
    items: [{ id: "i1", productId: "prod-1", name: "VIP", quantity: 1, price: 42, metadata: {} }],
};

beforeEach(() => {
    vi.clearAllMocks();
    db.order.update.mockResolvedValue({});
    db.productCommand.findMany.mockResolvedValue([]);
    db.creditTransaction.findFirst.mockResolvedValue(null);
});

describe("settleOrder", () => {
    it("completes the order, grants what was bought and records the payment", async () => {
        db.order.findUnique
            .mockResolvedValueOnce({ id: "order-1", status: "PENDING" })
            .mockResolvedValueOnce(paidOrder);

        const outcome = await settleOrder(settlement);

        expect(outcome).toEqual({ handled: true, duplicate: false, error: null });
        expect(db.order.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "order-1" },
                data: expect.objectContaining({
                    status: "COMPLETED",
                    paymentMethod: "stripe",
                    paymentId: "pi_123",
                }),
            }),
        );
        expect(db.chestItem.create).toHaveBeenCalledTimes(1);
        expect(db.ownedProduct.upsert).toHaveBeenCalledTimes(1);
        expect(db.payment.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    orderId: "order-1",
                    provider: "stripe",
                    providerId: "pi_123",
                    amount: 42,
                    // Stored lowercase whatever case the gateway reported.
                    currency: "usd",
                    status: "COMPLETED",
                }),
            }),
        );
        expect(announceOrderCompleted).toHaveBeenCalledWith("order-1");
    });

    it("records the payment method the money actually came through", async () => {
        db.order.findUnique
            .mockResolvedValueOnce({ id: "order-1", status: "PENDING" })
            .mockResolvedValueOnce(paidOrder);

        await settleOrder({ ...settlement, provider: "paypal", providerRef: "PAY-9" });

        expect(db.order.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ paymentMethod: "paypal", paymentId: "PAY-9" }),
            }),
        );
    });

    it("says duplicate, and grants nothing, when the order is already completed", async () => {
        db.order.findUnique.mockResolvedValueOnce({ id: "order-1", status: "COMPLETED" });

        const outcome = await settleOrder(settlement);

        expect(outcome).toEqual({ handled: true, duplicate: true, error: null });
        expect(db.order.update).not.toHaveBeenCalled();
        expect(db.chestItem.create).not.toHaveBeenCalled();
        expect(db.payment.create).not.toHaveBeenCalled();
        expect(announceOrderCompleted).not.toHaveBeenCalled();
    });

    // "handled" with an error, not unhandled: the store did answer, and a
    // gateway retrying a settlement for an order that does not exist would
    // retry it forever.
    it("answers an unknown order with an error rather than silence", async () => {
        db.order.findUnique.mockResolvedValueOnce(null);

        const outcome = await settleOrder(settlement);

        expect(outcome.handled).toBe(true);
        expect(outcome.error).toMatch(/unknown order/i);
        expect(db.order.update).not.toHaveBeenCalled();
    });

    // The order is paid either way. There is simply nobody left to grant to.
    it("keeps a paid order completed when the buyer's account is gone", async () => {
        db.order.findUnique
            .mockResolvedValueOnce({ id: "order-1", status: "PENDING" })
            .mockResolvedValueOnce({ ...paidOrder, userId: null, user: null });

        const outcome = await settleOrder(settlement);

        expect(outcome.handled).toBe(true);
        expect(db.payment.create).toHaveBeenCalledTimes(1);
        expect(db.chestItem.create).not.toHaveBeenCalled();
        expect(sendOrderConfirmationEmail).not.toHaveBeenCalled();
    });

    // A webhook left waiting is a webhook that gets retried, so the slow parts
    // are started and not awaited.
    it("does not make the gateway wait for the email or the delivery commands", async () => {
        db.order.findUnique
            .mockResolvedValueOnce({ id: "order-1", status: "PENDING" })
            .mockResolvedValueOnce(paidOrder);
        db.productCommand.findMany.mockResolvedValue([{ command: "give {player} vip", serverId: "srv-1", order: 0 }]);
        sendOrderConfirmationEmail.mockRejectedValueOnce(new Error("smtp down"));

        const outcome = await settleOrder(settlement);

        expect(outcome.handled).toBe(true);
        expect(deliverProduct).toHaveBeenCalledWith(expect.objectContaining({ playerName: "Steve" }));
    });
});

describe("settleCredits", () => {
    const topUp: PaymentSettlement = {
        kind: "credits",
        reference: "user-1",
        provider: "stripe",
        providerRef: "pi_credit",
        amount: 25,
        currency: "USD",
        metadata: { userId: "user-1", creditAmount: "25" },
    };

    it("grants the credits the store asked the gateway to carry", async () => {
        const outcome = await settleCredits(topUp);

        expect(outcome).toEqual({ handled: true, duplicate: false, error: null });
        expect(db.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "user-1" }, data: { creditBalance: { increment: 25 } } }),
        );
        expect(db.creditTransaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ userId: "user-1", amount: 25, type: "credit_purchase" }),
            }),
        );
    });

    it("does not grant twice when the same payment is reported again", async () => {
        db.creditTransaction.findFirst.mockResolvedValueOnce({ id: "tx-1" });

        const outcome = await settleCredits(topUp);

        expect(outcome).toEqual({ handled: true, duplicate: true, error: null });
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it("refuses a top-up with no buyer or no amount", async () => {
        const outcome = await settleCredits({ ...topUp, metadata: { userId: "user-1" } });

        expect(outcome.error).toBeTruthy();
        expect(db.user.update).not.toHaveBeenCalled();
    });
});

describe("voidOrder", () => {
    it("cancels an order the buyer walked away from", async () => {
        db.order.findUnique.mockResolvedValueOnce({ id: "order-1", status: "PENDING" });

        const outcome = await voidOrder("order-1");

        expect(outcome.handled).toBe(true);
        expect(db.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "CANCELLED" } });
    });

    // Providers send an "expired" event for the session, which can land after
    // the payment succeeded through another route.
    it("never cancels an order that was already paid for", async () => {
        db.order.findUnique.mockResolvedValueOnce({ id: "order-1", status: "COMPLETED" });

        const outcome = await voidOrder("order-1");

        expect(outcome).toEqual({ handled: true, duplicate: true, error: null });
        expect(db.order.update).not.toHaveBeenCalled();
    });
});

describe("refundPayment", () => {
    it("marks the payment and its order refunded", async () => {
        db.payment.findFirst.mockResolvedValueOnce({ id: "pay-1", orderId: "order-1", status: "COMPLETED" });

        const outcome = await refundPayment("stripe", "pi_123");

        expect(outcome.handled).toBe(true);
        expect(db.payment.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "pay-1" }, data: { status: "REFUNDED" } }),
        );
        expect(db.order.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "order-1" }, data: { status: "REFUNDED" } }),
        );
    });

    it("is safe to replay on an already refunded payment", async () => {
        db.payment.findFirst.mockResolvedValueOnce({ id: "pay-1", orderId: "order-1", status: "REFUNDED" });

        expect(await refundPayment("stripe", "pi_123")).toEqual({ handled: true, duplicate: true, error: null });
        expect(db.payment.update).not.toHaveBeenCalled();
    });

    // Two gateways can hold the same provider reference only by accident, but a
    // refund for a payment this site never took should not touch an order.
    it("answers with an error when the payment is not ours", async () => {
        db.payment.findFirst.mockResolvedValueOnce(null);

        const outcome = await refundPayment("stripe", "pi_unknown");

        expect(outcome.error).toMatch(/unknown payment/i);
        expect(db.order.update).not.toHaveBeenCalled();
    });
});

describe("applySubscriptionChange", () => {
    const change: SubscriptionChange = {
        provider: "stripe",
        providerRef: "sub_1",
        userId: "user-1",
        productId: "prod-1",
        status: "active",
        currentPeriodEnd: "2026-10-01T00:00:00.000Z",
        ended: false,
    };

    it("starts a plan and grants the product it pays for", async () => {
        db.subscription.findFirst.mockResolvedValueOnce(null);

        const outcome = await applySubscriptionChange(change);

        expect(outcome.handled).toBe(true);
        expect(db.subscription.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ userId: "user-1", productId: "prod-1", status: "active" }),
            }),
        );
        expect(db.ownedProduct.upsert).toHaveBeenCalledTimes(1);
    });

    it("renews an existing plan without granting the product again", async () => {
        db.subscription.findFirst.mockResolvedValueOnce({ id: "sub-row", status: "active", userId: "user-1", productId: "prod-1" });

        await applySubscriptionChange(change);

        expect(db.subscription.update).toHaveBeenCalledTimes(1);
        expect(db.subscription.create).not.toHaveBeenCalled();
        expect(db.ownedProduct.upsert).not.toHaveBeenCalled();
    });

    // Selling access by the month means access ends with the month.
    it("withdraws the product when the plan ends", async () => {
        db.subscription.findFirst.mockResolvedValueOnce({ id: "sub-row", status: "active", userId: "user-1", productId: "prod-1" });

        const outcome = await applySubscriptionChange({ ...change, status: "canceled", ended: true });

        expect(outcome.handled).toBe(true);
        expect(db.ownedProduct.deleteMany).toHaveBeenCalledWith({
            where: { userId: "user-1", productId: "prod-1" },
        });
    });

    it("is safe to replay a cancellation", async () => {
        db.subscription.findFirst.mockResolvedValueOnce({ id: "sub-row", status: "canceled", userId: "user-1", productId: "prod-1" });

        expect(await applySubscriptionChange({ ...change, ended: true })).toEqual({
            handled: true,
            duplicate: true,
            error: null,
        });
        expect(db.ownedProduct.deleteMany).not.toHaveBeenCalled();
    });
});
