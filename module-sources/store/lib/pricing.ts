// Pure checkout pricing math, extracted verbatim from api/checkout/route.ts so
// the money calculations can be unit-tested without a DB, Stripe, or auth.
//
// These functions take plain numbers/objects (the route still does the
// Prisma Decimal -> Number() coercion at the call site) and contain NO I/O.
// Behaviour is identical to the previous inline implementation; the route
// imports computeOrderPricing/computeCouponDiscount/computeTotals instead of
// inlining the arithmetic.

export interface PricingProduct {
    id: string;
    name: string;
    type?: string | null;
    price: number;
    categoryId?: string | null;
}

export interface PricingItemInput {
    productId: string;
    quantity: number;
}

export interface PricingBulkDiscount {
    minQuantity: number;
    discountPercent: number;
    productId?: string | null;
    categoryId?: string | null;
}

export interface ComputedOrderItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    metadata: {
        type: string | null | undefined;
        variables: Record<string, string>;
        bulkDiscount?: number;
    };
}

/**
 * Per-item price resolution: cumulative-upgrade credit (pay only the
 * difference when the buyer already owns a cheaper product in the same
 * category) followed by the best matching bulk discount. Returns the line
 * items plus the running subtotal.
 *
 * `bulkDiscounts` must already be ordered most-aggressive-first (the route
 * fetches them `orderBy: { discountPercent: "desc" }`) because we take the
 * first match.
 */
export function computeOrderPricing(params: {
    items: PricingItemInput[];
    products: PricingProduct[];
    bulkDiscounts: PricingBulkDiscount[];
    ownedProductIds: Set<string>;
    variables?: Record<string, Record<string, string>>;
}): { subtotal: number; orderItems: ComputedOrderItem[] } {
    const { items, products, bulkDiscounts, ownedProductIds, variables } = params;

    let subtotal = 0;
    const orderItems = items.map((item): ComputedOrderItem => {
        const product = products.find((p) => p.id === item.productId)!;
        let price = Number(product.price);

        // Cumulative upgrade: pay difference if user owns cheaper in same category
        if (product.categoryId) {
            const ownedInCategory = products.filter(
                (p) => p.categoryId === product.categoryId && ownedProductIds.has(p.id) && Number(p.price) < price
            );
            if (ownedInCategory.length > 0) {
                const highestOwned = Math.max(...ownedInCategory.map((p) => Number(p.price)));
                price = Math.max(0, price - highestOwned);
            }
        }

        // Bulk discount: find best matching discount for this item
        const matchingBulk = bulkDiscounts.find((bd) =>
            bd.minQuantity <= item.quantity &&
            (bd.productId === product.id || bd.categoryId === product.categoryId || (!bd.productId && !bd.categoryId))
        );
        let bulkDiscountApplied = 0;
        if (matchingBulk) {
            bulkDiscountApplied = matchingBulk.discountPercent;
            price = price * (1 - matchingBulk.discountPercent / 100);
        }

        const itemTotal = price * item.quantity;
        subtotal += itemTotal;

        return {
            productId: product.id,
            name: product.name,
            price,
            quantity: item.quantity,
            metadata: {
                type: product.type,
                variables: variables?.[product.id] || {},
                ...(bulkDiscountApplied > 0 ? { bulkDiscount: bulkDiscountApplied } : {}),
            },
        };
    });

    return { subtotal, orderItems };
}

// Prisma money columns arrive as Decimal objects, not primitives. Every
// numeric read in computeCouponDiscount already goes through Number(), which
// coerces a Decimal via its valueOf/toString — so we accept either here to
// keep the route's behaviour identical while satisfying the type checker.
type DecimalLike = number | { toString(): string };

export interface CouponInput {
    isActive: boolean;
    type: string; // "PERCENTAGE" | other (fixed)
    value: DecimalLike;
    maxDiscount?: DecimalLike | null;
    minPurchase?: DecimalLike | null;
    usageLimit?: number | null;
    usageCount?: number;
    startsAt?: Date | null;
    expiresAt?: Date | null;
}

export interface CouponResult {
    /** Human-readable rejection reason, or null when the coupon applies. */
    error: string | null;
    /** Discount amount in currency units (0 when rejected). */
    discount: number;
}

/**
 * Validate + price a coupon against the current subtotal. Mirrors the inline
 * transaction body in the route: not-found/inactive, not-yet-active, expired,
 * usage-cap, and min-purchase gates all reject with a message; PERCENTAGE
 * applies value% (capped at maxDiscount), otherwise a fixed amount capped at
 * the subtotal. `now` is injectable for deterministic tests.
 */
export function computeCouponDiscount(
    coupon: CouponInput | null | undefined,
    subtotal: number,
    now: Date = new Date()
): CouponResult {
    if (!coupon || !coupon.isActive) return { error: "Coupon code not found or inactive", discount: 0 };

    if (coupon.startsAt && coupon.startsAt > now) return { error: "Coupon is not yet active", discount: 0 };
    if (coupon.expiresAt && coupon.expiresAt < now) return { error: "Coupon has expired", discount: 0 };
    if (coupon.usageLimit && (coupon.usageCount ?? 0) >= coupon.usageLimit) {
        return { error: "Coupon usage limit reached", discount: 0 };
    }
    if (coupon.minPurchase && subtotal < Number(coupon.minPurchase)) {
        return { error: `Coupon requires a minimum purchase of ${Number(coupon.minPurchase)}`, discount: 0 };
    }

    let discount: number;
    if (coupon.type === "PERCENTAGE") {
        discount = subtotal * (Number(coupon.value) / 100);
        if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
    } else {
        discount = Math.min(Number(coupon.value), subtotal);
    }
    return { error: null, discount };
}

/**
 * Creator-code discount: a percentage of the subtotal AFTER the coupon has
 * been applied. Returns 0 for a missing/zero percent.
 */
export function computeCreatorDiscount(
    subtotal: number,
    couponDiscount: number,
    discountPercent: number
): number {
    const afterCoupon = subtotal - couponDiscount;
    return afterCoupon * (discountPercent / 100);
}

/**
 * Final tax + total roll-up, clamped so a discount that exceeds the subtotal
 * can never produce a negative charge. `taxRate` is a percentage (e.g. 8 for
 * 8%); the rounding (round to cents) matches the route's Math.round(.. )/100.
 */
export function computeTotals(params: {
    subtotal: number;
    couponDiscount: number;
    creatorDiscount: number;
    taxRate: number;
}): { totalDiscount: number; taxableAmount: number; tax: number; total: number } {
    const { subtotal, couponDiscount, creatorDiscount, taxRate } = params;
    const totalDiscount = couponDiscount + creatorDiscount;
    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const tax = taxRate > 0 ? Math.round(taxableAmount * taxRate) / 100 : 0;
    const total = Math.max(0, taxableAmount + tax);
    return { totalDiscount, taxableAmount, tax, total };
}
