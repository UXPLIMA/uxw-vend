import { NextRequest, NextResponse } from "next/server";
import { moduleSettings, prisma, rateLimitForRole, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { couponValidateSchema } from "../../../lib/validations";
import { computeCouponDiscount } from "../../../lib/pricing";

// POST /api/v1/store/coupons/validate - Check coupon validity
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await rateLimitForRole(
        `coupon:${session.user.id}`,
        { maxRequests: 10, windowMs: 60_000 },
        session.user.role
    );
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { enableCoupons } = await moduleSettings<{ enableCoupons: boolean }>("store");
    if (!enableCoupons) {
        return NextResponse.json({ valid: false, error: "Coupon codes are not accepted" });
    }

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = couponValidateSchema.safeParse(jsonBody);
    if (!parsed.success) return NextResponse.json({ error: "Code required" }, { status: 400 });
    const { code, subtotal } = parsed.data;

    const coupon = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
    });
    if (!coupon) {
        return NextResponse.json({ valid: false, error: "Invalid or expired coupon code" });
    }

    // The same function the checkout charges by.
    //
    // This route used to repeat the rules, and had drifted on one of them: a
    // fixed-value coupon was previewed at its full face value while the
    // checkout caps it at the subtotal, so a 50 coupon on a 10 cart promised
    // a shopper 50 off and then took 10. A preview that disagrees with the
    // till is worse than no preview.
    const cartSubtotal = Number(subtotal) || 0;
    const priced = computeCouponDiscount(coupon, cartSubtotal);

    if (priced.error) {
        // Why a coupon failed is deliberately not spelled out: one that never
        // existed and one that has run out answer the same, so the response
        // cannot be used to go looking for codes. The minimum purchase is the
        // exception, because it is the one a shopper can act on.
        if (coupon.minPurchase && cartSubtotal < Number(coupon.minPurchase)) {
            return NextResponse.json({ valid: false, error: `Minimum purchase: $${Number(coupon.minPurchase).toFixed(2)}` });
        }
        return NextResponse.json({ valid: false, error: "Invalid or expired coupon code" });
    }

    return NextResponse.json({
        valid: true,
        coupon: {
            code: coupon.code,
            type: coupon.type,
            value: Number(coupon.value),
            discount: priced.discount,
        },
    });
}
