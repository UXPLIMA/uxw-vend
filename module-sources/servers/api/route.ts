import { NextRequest, NextResponse } from "next/server";
import { encryptSecret, isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { serverCreateSchema } from "../lib/validations";

export async function GET() {
    const servers = await prisma.gameServer.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: { id: true, name: true, type: true, host: true, port: true, queryPort: true, isDefault: true, isActive: true, order: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ servers });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = serverCreateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const fields = parsed.data;

    const server = await prisma.gameServer.create({
        data: {
            name: fields.name,
            type: fields.type || "minecraft",
            host: fields.host,
            port: fields.port || 25565,
            rconPort: fields.rconPort || null,
            // RCON password is stored encrypted at rest (AES-256-GCM).
            // Read back via decryptSecret() when the connection is opened.
            rconPassword: fields.rconPassword ? encryptSecret(fields.rconPassword) : null,
            queryPort: fields.queryPort || null,
            isDefault: fields.isDefault || false,
            order: fields.order || 0,
        },
    });
    return NextResponse.json({ server }, { status: 201 });
}
