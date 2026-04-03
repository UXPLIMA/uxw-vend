import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/lib/db";

// POST /api/v1/store/coupons/validate - Check coupon validity
export async function POST(request: NextRequest) {
    const { code, subtotal } = await request.json();

    if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

    const coupon = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
        return NextResponse.json({ valid: false, error: "Invalid coupon code" });
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
        return NextResponse.json({ valid: false, error: "Coupon not yet active" });
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
        return NextResponse.json({ valid: false, error: "Coupon expired" });
    }
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return NextResponse.json({ valid: false, error: "Coupon usage limit reached" });
    }
    if (coupon.minPurchase && subtotal && Number(subtotal) < Number(coupon.minPurchase)) {
        return NextResponse.json({ valid: false, error: `Minimum purchase: $${Number(coupon.minPurchase).toFixed(2)}` });
    }

    let discount = 0;
    if (coupon.type === "PERCENTAGE") {
        discount = (subtotal || 0) * (Number(coupon.value) / 100);
        if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
    } else {
        discount = Number(coupon.value);
    }

    return NextResponse.json({
        valid: true,
        coupon: {
            code: coupon.code,
            type: coupon.type,
            value: Number(coupon.value),
            discount: Math.round(discount * 100) / 100,
        },
    });
}
