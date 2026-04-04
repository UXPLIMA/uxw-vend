import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";

// POST - Spin the wheel (1 free spin per day)
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check daily cooldown
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySpin = await prisma.wheelSpin.findFirst({
        where: { userId: session.user.id, createdAt: { gte: today } },
    });

    if (todaySpin) {
        return NextResponse.json({ error: "You already spun today. Come back tomorrow!" }, { status: 429 });
    }

    // Get active prizes
    const prizes = await prisma.wheelPrize.findMany({ where: { isActive: true } });
    if (prizes.length === 0) {
        return NextResponse.json({ error: "No prizes configured" }, { status: 400 });
    }

    // Weighted random selection
    const totalWeight = prizes.reduce((sum, p) => sum + p.probability, 0);
    let random = Math.random() * totalWeight;
    let selectedPrize = prizes[0];

    for (const prize of prizes) {
        random -= prize.probability;
        if (random <= 0) {
            selectedPrize = prize;
            break;
        }
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

    return NextResponse.json({
        prize: {
            id: selectedPrize.id,
            name: selectedPrize.name,
            type: selectedPrize.type,
            value: selectedPrize.value,
            color: selectedPrize.color,
            index: prizeIndex,
        },
    });
}
