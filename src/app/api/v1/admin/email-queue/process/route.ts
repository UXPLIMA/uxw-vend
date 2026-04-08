import { NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { processEmailQueue } from "@/core/lib/email";

// POST /api/v1/admin/email-queue/process - Drain the email queue immediately
export async function POST() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await processEmailQueue();
    return NextResponse.json(result);
}
