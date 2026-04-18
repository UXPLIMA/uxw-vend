import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { sendRconCommand, getRconEnabled } from "../../lib/rcon";

// POST /api/v1/rcon - Send RCON command (admin only)
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!getRconEnabled()) {
        return NextResponse.json({ error: "RCON not configured" }, { status: 400 });
    }

    const { command } = await request.json();
    if (!command) return NextResponse.json({ error: "Command required" }, { status: 400 });

    try {
        const response = await sendRconCommand(command);
        return NextResponse.json({ response });
    } catch (err) {
        return NextResponse.json({
            error: err instanceof Error ? err.message : "RCON command failed",
        }, { status: 500 });
    }
}

// GET /api/v1/rcon - Check RCON status
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ enabled: getRconEnabled() });
}
