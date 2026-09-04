import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { downloadCreateSchema } from "../lib/validations";

export async function GET() {
    const downloads = await prisma.download.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        // The page renders every row it is given, so this is the ceiling on
        // one response rather than a page size.
        take: 200,
    });
    return NextResponse.json({ downloads });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const jsonBody = await readJsonBody(request);
    if (jsonBody instanceof NextResponse) return jsonBody;
    const parsed = downloadCreateSchema.safeParse(jsonBody);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
    }
    const { title, description, fileName, fileUrl, fileSize } = parsed.data;

    const download = await prisma.download.create({
        data: { title, description: description || null, fileName, fileUrl, fileSize: fileSize || null },
    });
    return NextResponse.json({ download }, { status: 201 });
}
