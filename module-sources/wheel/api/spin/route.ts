import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { rateLimitForRoleAsync } from "@/core/lib/rate-limit";
import { randomInt } from "crypto";

// POST - Spin the wheel (1 free spin per day, paid spins via credits)
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await rateLimitForRoleAsync(
        `wheel-spin:${session.user.id}`,
        { maxRequests: 20, windowMs: 3_600_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Read spin cost setting
    const costSetting = await prisma.setting.findUnique({ where: { key: "wheel_spin_cost" } });
    const spinCost = costSetting ? parseInt(costSetting.value as string, 10) || 0 : 0;

    // Check daily cooldown
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySpin = await prisma.wheelSpin.findFirst({
        where: { userId: session.user.id, createdAt: { gte: today } },
    });

    let paidSpin = false;
    if (todaySpin) {
        if (spinCost <= 0) {
            return NextResponse.json({ error: "You already spun today. Come back tomorrow!" }, { status: 429 });
        }
        // Check if user has enough credits for a paid spin
        const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { creditBalance: true } });
        if (!user || Number(user.creditBalance) < spinCost) {
            return NextResponse.json({ error: `Not enough credits. You need ${spinCost} credits for another spin.`, cost: spinCost }, { status: 429 });
        }
        paidSpin = true;
    }

    // Get active prizes
    const prizes = await prisma.wheelPrize.findMany({ where: { isActive: true } });
    if (prizes.length === 0) {
        return NextResponse.json({ error: "No prizes configured" }, { status: 400 });
    }

    // Weighted random selection using cryptographically secure randomness
    const totalWeight = prizes.reduce((sum, p) => sum + p.probability, 0);
    let random = randomInt(0, Math.ceil(totalWeight * 1000)) / 1000;
    let selectedPrize = prizes[0];

    for (const prize of prizes) {
        random -= prize.probability;
        if (random <= 0) {
            selectedPrize = prize;
            break;
        }
    }

    // Deduct credits for paid spin
    if (paidSpin) {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { creditBalance: { decrement: spinCost } },
        });
        await prisma.creditTransaction.create({
            data: {
                userId: session.user.id,
                amount: -spinCost,
                type: "wheel_spin",
                description: `Wheel of Fortune: Paid spin (${spinCost} credits)`,
            },
        });
    }

    // Record spin
    await prisma.wheelSpin.create({
        data: {
            userId: session.user.id,
            prizeId: selectedPrize.id,
            prizeName: selectedPrize.name,
            prizeValue: selectedPrize.value,
        },
    });

    // Award prize
    if (selectedPrize.type === "credits" && selectedPrize.value > 0) {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { creditBalance: { increment: selectedPrize.value } },
        });

        await prisma.creditTransaction.create({
            data: {
                userId: session.user.id,
                amount: selectedPrize.value,
                type: "wheel_prize",
                description: `Wheel of Fortune: ${selectedPrize.name}`,
            },
        });
    } else if (selectedPrize.type === "coupon" && selectedPrize.value > 0) {
        // Create a personal one-time coupon
        const code = `WHEEL-${Date.now().toString(36).toUpperCase()}`;
        await prisma.coupon.create({
            data: {
                code,
                description: `Wheel of Fortune prize: ${selectedPrize.name}`,
                type: "FIXED",
                value: selectedPrize.value,
                usageLimit: 1,
                isActive: true,
            },
        });
    }

    // Find index for frontend animation
    const prizeIndex = prizes.findIndex((p) => p.id === selectedPrize.id);

    // Fire hooks + activity feed entry
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("wheel.spin.completed", {
        userId: session.user.id,
        prizeId: selectedPrize.id,
        prizeName: selectedPrize.name,
        prizeType: selectedPrize.type,
        prizeValue: selectedPrize.value,
        paidSpin,
        spinCost,
    });
    if (selectedPrize.value > 0) {
        await doActionAsync("wheel.prize.won", {
            userId: session.user.id,
            prizeId: selectedPrize.id,
            prizeName: selectedPrize.name,
            prizeType: selectedPrize.type,
            prizeValue: selectedPrize.value,
        });
        await prisma.activityFeedItem.create({
            data: {
                type: "wheel.prize.won",
                actorId: session.user.id,
                title: `Won ${selectedPrize.name} on the wheel`,
                icon: "Gift",
                isPublic: true,
            },
        }).catch(() => {});
    }

    return NextResponse.json({
        prize: {
            id: selectedPrize.id,
            name: selectedPrize.name,
            type: selectedPrize.type,
            value: selectedPrize.value,
            color: selectedPrize.color,
            index: prizeIndex,
        },
        cost: spinCost,
    });
}
