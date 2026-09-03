// @vitest-environment node
/**
 * Turning a paid order into keys the buyer can use.
 *
 * This is the whole promise of the module, and the place where the cost of a
 * mistake is asymmetric: issuing nothing means a customer paid for a product
 * they cannot run, and issuing twice means keys leaking out of a shop that
 * counts them.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

interface KeyRow {
    id: string;
    keyHash: string;
    productId: string | null;
    productName: string | null;
    orderId: string | null;
    userId: string | null;
    maxActivations: number;
    expiresAt: Date | null;
}

interface ProductRow {
    productId: string;
    keysPerUnit: number;
    maxActivations: number;
    validDays: number | null;
    prefix: string | null;
}

const db = { keys: [] as KeyRow[], products: [] as ProductRow[], next: 1 };
let createThrows = false;
const logged: unknown[] = [];

const prismaMock = {
    licenseProduct: {
        findMany: vi.fn(async ({ where }: { where: { productId: { in: string[] } } }) =>
            db.products.filter((p) => where.productId.in.includes(p.productId)),
        ),
    },
    licenseKey: {
        create: vi.fn(async ({ data }: { data: Partial<KeyRow> }) => {
            if (createThrows) throw new Error("database is down");
            const row = { id: `k${db.next++}`, ...data } as KeyRow;
            db.keys.push(row);
            return row;
        }),
        count: vi.fn(async ({ where }: { where: { orderId: string; productId: string } }) =>
            db.keys.filter((k) => k.orderId === where.orderId && k.productId === where.productId).length,
        ),
    },
};

vi.mock("@/core/sdk/server", () => ({
    prisma: prismaMock,
    encryptSecret: (value: string) => `enc:${value}`,
    decryptSecret: (value: string) => value.slice(4),
    log: { error: (...args: unknown[]) => logged.push(args) },
}));

const onOrderCompleted = (await import("@/modules/license-keys/hooks/on-order-completed")).default;

interface Item {
    id: string;
    productId: string | null;
    name: string;
    quantity: number;
    price: unknown;
}

function order(items: Partial<Item>[], overrides: Record<string, unknown> = {}) {
    return {
        id: "order-1",
        userId: "user-1",
        items: items.map((item, index) => ({
            id: `i${index}`,
            productId: item.productId ?? null,
            name: item.name ?? "Item",
            quantity: item.quantity ?? 1,
            price: item.price ?? 10,
        })),
        ...overrides,
    } as Parameters<typeof onOrderCompleted>[0];
}

beforeEach(() => {
    db.keys = [];
    db.products = [];
    db.next = 1;
    createThrows = false;
    logged.length = 0;
    vi.clearAllMocks();
});

describe("on a completed order", () => {
    it("issues a key for a licensed product", async () => {
        db.products.push({ productId: "p1", keysPerUnit: 1, maxActivations: 3, validDays: null, prefix: null });
        await onOrderCompleted(order([{ productId: "p1", name: "Editor Pro" }]), { hook: "store.order.completed" });

        expect(db.keys).toHaveLength(1);
        expect(db.keys[0]).toMatchObject({
            productId: "p1",
            productName: "Editor Pro",
            orderId: "order-1",
            userId: "user-1",
            maxActivations: 3,
        });
    });

    it("gives a buyer who ordered three copies three keys", async () => {
        db.products.push({ productId: "p1", keysPerUnit: 1, maxActivations: 1, validDays: null, prefix: null });
        await onOrderCompleted(order([{ productId: "p1", quantity: 3 }]), { hook: "store.order.completed" });
        expect(db.keys).toHaveLength(3);
    });

    // A five-seat bundle: one line item, five keys.
    it("multiplies the keys per item by the quantity ordered", async () => {
        db.products.push({ productId: "p1", keysPerUnit: 5, maxActivations: 1, validDays: null, prefix: null });
        await onOrderCompleted(order([{ productId: "p1", quantity: 2 }]), { hook: "store.order.completed" });
        expect(db.keys).toHaveLength(10);
    });

    it("applies the product's term and prefix", async () => {
        db.products.push({ productId: "p1", keysPerUnit: 1, maxActivations: 1, validDays: 365, prefix: "PRO" });
        await onOrderCompleted(order([{ productId: "p1" }]), { hook: "store.order.completed" });
        expect(db.keys[0].expiresAt).toBeInstanceOf(Date);
        expect(prismaMock.licenseKey.create.mock.calls[0][0].data.keyHint).toMatch(/^PRO-/);
    });

    it("leaves the rest of the order alone", async () => {
        db.products.push({ productId: "p1", keysPerUnit: 1, maxActivations: 1, validDays: null, prefix: null });
        await onOrderCompleted(
            order([{ productId: "p1" }, { productId: "p2" }, { productId: null, name: "Tip" }]),
            { hook: "store.order.completed" },
        );
        expect(db.keys).toHaveLength(1);
        expect(db.keys[0].productId).toBe("p1");
    });

    it("does nothing at all for an order with no licensed products", async () => {
        await onOrderCompleted(order([{ productId: "p9" }]), { hook: "store.order.completed" });
        expect(db.keys).toHaveLength(0);
        expect(prismaMock.licenseKey.create).not.toHaveBeenCalled();
    });

    it("does nothing for an order with no items", async () => {
        await onOrderCompleted(order([]), { hook: "store.order.completed" });
        expect(prismaMock.licenseProduct.findMany).not.toHaveBeenCalled();
    });

    // Payment webhooks retry, and an operator can re-run a completion by hand.
    it("does not hand out a second set of keys when the order completes twice", async () => {
        db.products.push({ productId: "p1", keysPerUnit: 2, maxActivations: 1, validDays: null, prefix: null });
        await onOrderCompleted(order([{ productId: "p1" }]), { hook: "store.order.completed" });
        await onOrderCompleted(order([{ productId: "p1" }]), { hook: "store.order.completed" });
        expect(db.keys).toHaveLength(2);
    });

    it("still issues keys for a second order of the same product", async () => {
        db.products.push({ productId: "p1", keysPerUnit: 1, maxActivations: 1, validDays: null, prefix: null });
        await onOrderCompleted(order([{ productId: "p1" }]), { hook: "store.order.completed" });
        await onOrderCompleted(order([{ productId: "p1" }], { id: "order-2" }), { hook: "store.order.completed" });
        expect(db.keys).toHaveLength(2);
    });

    // The order is already paid for, and other listeners still have work to do.
    it("logs rather than throws when the keys cannot be written", async () => {
        db.products.push({ productId: "p1", keysPerUnit: 1, maxActivations: 1, validDays: null, prefix: null });
        createThrows = true;
        await expect(
            onOrderCompleted(order([{ productId: "p1" }]), { hook: "store.order.completed" }),
        ).resolves.toBeUndefined();
        expect(logged).toHaveLength(1);
    });
});
