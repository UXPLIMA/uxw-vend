import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/community-goal - Public endpoint
export async function GET() {
    try {
        const settings = await prisma.setting.findMany({
            where: { key: { startsWith: "community_goal_" } },
        });

        const settingsMap: Record<string, unknown> = {};
        for (const s of settings) {
            settingsMap[s.key] = s.value;
        }

        const target = Number(settingsMap.community_goal_target) || 0;
        const title = (settingsMap.community_goal_title as string) || "Monthly Goal";
        const endDate = (settingsMap.community_goal_end_date as string) || null;

        if (target <= 0) {
            return NextResponse.json({ target: 0, current: 0, title, endDate: null });
        }

        // Calculate current from completed orders this month (or since goal start)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const result = await prisma.order.aggregate({
            _sum: { total: true },
            where: {
                status: "COMPLETED",
                createdAt: { gte: monthStart },
            },
        });

        const current = Number(result._sum.total) || 0;

        return NextResponse.json({ target, current, title, endDate });
    } catch (error) {
        console.error("Community goal error:", error);
        return NextResponse.json({ target: 0, current: 0, title: "Monthly Goal", endDate: null });
    }
}

// PATCH /api/v1/community-goal - Admin only
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const updates: { key: string; value: unknown }[] = [];
    if (body.target !== undefined) updates.push({ key: "community_goal_target", value: body.target });
    if (body.title !== undefined) updates.push({ key: "community_goal_title", value: body.title });
    if (body.endDate !== undefined) updates.push({ key: "community_goal_end_date", value: body.endDate });

    for (const { key, value } of updates) {
        await prisma.setting.upsert({
            where: { key },
            update: { value: value as any },
            create: { key, value: value as any },
        });
    }

    return NextResponse.json({ message: "Goal updated" });
}
