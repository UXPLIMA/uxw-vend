import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isStaff } from "@/core/lib/permissions";
import { issueWarning, listWarnings } from "@/core/lib/warnings";

/** GET ?userId=xxx — list warnings for a user (staff only) */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isStaff(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const warnings = await listWarnings(userId);
    return NextResponse.json({ warnings });
}

const issueSchema = z.object({
    userId: z.string().min(1),
    reason: z.string().min(1).max(500),
    points: z.number().int().min(1).max(100).default(1),
    expiresAt: z.string().datetime().optional(),
});

/** POST — issue a warning (staff only) */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isStaff(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = issueSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    const result = await issueWarning({
        userId: parsed.data.userId,
        issuedById: session.user.id,
        reason: parsed.data.reason,
        points: parsed.data.points,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });

    return NextResponse.json(result, { status: 201 });
}
