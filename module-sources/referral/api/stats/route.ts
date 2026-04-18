import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/referral/stats — Admin referral stats
export async function GET() {
    const session = await auth();
    if (!session?.user || !(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const totalReferrals = await prisma.referral.count();
    const completedReferrals = await prisma.referral.count({
        where: { status: { in: ["completed", "rewarded"] } },
    });
    const pendingReferrals = await prisma.referral.count({
        where: { status: "pending" },
    });

    const totalRewards = await prisma.referral.aggregate({
        _sum: { rewardAmount: true },
        where: { status: "rewarded" },
    });

    // Top referrers
    const topReferrers = await prisma.referral.groupBy({
        by: ["referrerId"],
        _count: { id: true },
        _sum: { rewardAmount: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
    });

    // Get user details for top referrers
    const referrerIds = topReferrers.map(r => r.referrerId);
    const referrerUsers = await prisma.user.findMany({
        where: { id: { in: referrerIds } },
        select: { id: true, username: true, avatar: true },
    });

    const topReferrersWithUsers = topReferrers.map(r => {
        const user = referrerUsers.find(u => u.id === r.referrerId);
        return {
            username: user?.username || "Unknown",
            avatar: user?.avatar || null,
            referralCount: r._count.id,
            totalReward: Number(r._sum.rewardAmount || 0),
        };
    });

    // Get reward amount setting
    const rewardSetting = await prisma.setting.findUnique({
        where: { key: "referral_reward_amount" },
    });

    return NextResponse.json({
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        totalRewards: Number(totalRewards._sum.rewardAmount || 0),
        topReferrers: topReferrersWithUsers,
        rewardAmount: Number(rewardSetting?.value) || 5,
    });
}

// POST /api/v1/referral/stats — Update referral settings (admin)
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user || !(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rewardAmount } = await request.json();
    if (typeof rewardAmount !== "number" || rewardAmount < 0) {
        return NextResponse.json({ error: "Invalid reward amount" }, { status: 400 });
    }

    await prisma.setting.upsert({
        where: { key: "referral_reward_amount" },
        update: { value: String(rewardAmount) },
        create: { key: "referral_reward_amount", value: String(rewardAmount) },
    });

    return NextResponse.json({ message: "Settings updated" });
}
