import { NextRequest, NextResponse } from "next/server";
import { isAdmin, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { sendRconCommand, isRconAvailable } from "../../lib/rcon";
import { rconCommandSchema } from "../../lib/validations";

async function requireAdmin(): Promise<NextResponse | null> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return null;
}

// POST /api/v1/rcon - Send an RCON command (admin only).
// `serverId` picks a server; without it the command goes to the default one.
export async function POST(request: NextRequest) {
    const denied = await requireAdmin();
    if (denied) return denied;

    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;
    const parsed = rconCommandSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Command required" }, { status: 400 });
    const { command } = parsed.data;
    const serverId = parsed.data.serverId || null;

    try {
        return NextResponse.json({ response: await sendRconCommand(command, serverId) });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "RCON command failed" },
            { status: 400 },
        );
    }
}

// GET /api/v1/rcon - Whether any server on this install can take a command.
export async function GET() {
    const denied = await requireAdmin();
    if (denied) return denied;
    return NextResponse.json({ enabled: await isRconAvailable() });
}
