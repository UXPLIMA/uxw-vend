import { NextResponse } from "next/server";
import { moduleSettings, prisma, rateLimitForRoleAsync } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
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

    // What an extra spin costs.
    //
    // This used to be read from a `wheel_spin_cost` row in the settings table
    // that no screen wrote and no manifest declared a default for, so it was
    // always absent, so the cost was always zero, so `paidSpin` was never
    // true. The whole paid-spin half of this route - the balance check, the
    // debit, the "not enough credits" answer, and the "spin again for N
    // credits" button on the page - could not be reached by any operator. It
    // is a module setting now, which is the thing core already renders a
    // panel for.
    const { spinCost } = await moduleSettings<{ spinCost: number }>("wheel");

    // Check daily cooldown
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySpin = await prisma.wheelSpin.findFirst({
        where: { userId: session.user.id, createdAt: { gte: today } },
    });

    let paidSpin = false;
    if (todaySpin) {
        if (spinCost <= 0) {
            return NextResponse.json(
                { error: "You already spun today. Come back tomorrow!", code: "wheel_already_spun" },
                { status: 429 },
            );
        }
        // Check if user has enough credits for a paid spin
        const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { creditBalance: true } });
        if (!user || Number(user.creditBalance) < spinCost) {
            return NextResponse.json(
                { error: `Not enough credits. You need ${spinCost} credits for another spin.`, code: "wheel_not_enough_credits", cost: spinCost },
                { status: 429 },
            );
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

    // A one-time coupon, minted here rather than inside the transaction so the
    // winner can be told the code even though the row is written below. The
    // suffix is random because two spins in the same millisecond used to
    // produce the same code, and `code` is unique: the second winner got a
    // 500 instead of a prize.
    const wonCoupon = selectedPrize.type === "coupon" && selectedPrize.value > 0;
    const couponCode = wonCoupon
        ? `WHEEL-${Date.now().toString(36).toUpperCase()}-${randomInt(0, 1679616).toString(36).toUpperCase().padStart(4, "0")}`
        : null;

    // One spin is one event, so it is one transaction.
    //
    // Every step of it used to be its own call. A paid spin decremented the
    // balance and then wrote the ledger row separately, so a failure in
    // between took a person's credits and left nothing saying where they went;
    // a credits prize did the same in the other direction, and a spin could be
    // paid for without being recorded at all. Either half failing now undoes
    // the other.
    const spun = await prisma.$transaction(async (tx) => {
        if (paidSpin) {
            // The balance read above is a snapshot: two spins submitted
            // together both saw enough credits, both spun, and the balance
            // went negative. The condition is what makes the second deduction
            // find nothing to update.
            const debited = await tx.user.updateMany({
                where: { id: session.user.id, creditBalance: { gte: spinCost } },
                data: { creditBalance: { decrement: spinCost } },
            });
            if (debited.count === 0) return false;

            await tx.creditTransaction.create({
                data: {
                    userId: session.user.id,
                    amount: -spinCost,
                    type: "wheel_spin",
                    description: `Wheel of Fortune: Paid spin (${spinCost} credits)`,
                },
            });
        }

        await tx.wheelSpin.create({
            data: {
                userId: session.user.id,
                prizeId: selectedPrize.id,
                prizeName: selectedPrize.name,
                prizeValue: selectedPrize.value,
            },
        });

        if (selectedPrize.type === "credits" && selectedPrize.value > 0) {
            await tx.user.update({
                where: { id: session.user.id },
                data: { creditBalance: { increment: selectedPrize.value } },
            });
            await tx.creditTransaction.create({
                data: {
                    userId: session.user.id,
                    amount: selectedPrize.value,
                    type: "wheel_prize",
                    description: `Wheel of Fortune: ${selectedPrize.name}`,
                },
            });
        } else if (couponCode) {
            await tx.coupon.create({
                data: {
                    code: couponCode,
                    description: `Wheel of Fortune prize: ${selectedPrize.name}`,
                    type: "FIXED",
                    value: selectedPrize.value,
                    usageLimit: 1,
                    isActive: true,
                },
            });
        }

        return true;
    });

    if (!spun) {
        return NextResponse.json(
            { error: `Not enough credits. You need ${spinCost} credits for another spin.`, code: "wheel_not_enough_credits", cost: spinCost },
            { status: 429 },
        );
    }

    // Find index for frontend animation
    const prizeIndex = prizes.findIndex((p) => p.id === selectedPrize.id);

    // Fire hooks + activity feed entry
    const { doActionAsync } = await import("@/core/sdk");
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
            // Without this a coupon prize was uncollectable: the row was
            // written and the code existed only in the database.
            code: couponCode,
        },
        cost: spinCost,
    });
}
