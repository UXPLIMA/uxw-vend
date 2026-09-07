import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody, rateLimitForRoleAsync } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { staffApplicationSchema } from "../../lib/validations";

/**
 * Most rows this list will hand back at once.
 *
 * The table fills up while the site is used, so reading all of it gets slower
 * every week and says nothing until the screen stops answering. One more than
 * the ceiling is fetched so the answer can admit it was cut rather than look
 * complete.
 */
const MAX_ROWS = 500;

// GET - Admin: all applications, User: own applications
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminCheck = await isAdmin(session.user.id);
    const where = adminCheck ? {} : { userId: session.user.id };

    const rows = await prisma.staffApplication.findMany({
        where,
        include: { user: { select: { id: true, username: true, avatar: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS + 1,
    });
    return NextResponse.json({
        applications: rows.slice(0, MAX_ROWS),
        truncated: rows.length > MAX_ROWS,
    });
}

// POST - Submit application
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await rateLimitForRoleAsync(
        `staff-application:${session.user.id}`,
        { maxRequests: 10, windowMs: 3_600_000 },
        session.user.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests", code: "rate_limited" }, { status: 429 });
    }

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = staffApplicationSchema.safeParse(jsonBody);
    if (!parsed.success) {
        return NextResponse.json({ error: "Position and content required" }, { status: 400 });
    }
    const { position, content } = parsed.data;

    // Check for existing pending application
    const existing = await prisma.staffApplication.findFirst({
        where: { userId: session.user.id, status: "pending" },
    });
    if (existing) return NextResponse.json({ error: "You already have a pending application" }, { status: 400 });

    const application = await prisma.staffApplication.create({
        data: { userId: session.user.id, position, content },
    });
    return NextResponse.json({ application }, { status: 201 });
}
