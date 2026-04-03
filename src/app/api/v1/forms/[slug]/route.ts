import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { slug } = await params;
    const form = await prisma.customForm.findFirst({
        where: { OR: [{ slug }, { id: slug }], isActive: true },
    });
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });
    return NextResponse.json({ form });
}

// Submit form
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { slug } = await params;
    const session = await auth();

    const form = await prisma.customForm.findFirst({
        where: { OR: [{ slug }, { id: slug }], isActive: true },
    });
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

    const { data } = await request.json();
    if (!data) return NextResponse.json({ error: "Form data required" }, { status: 400 });

    const submission = await prisma.customFormSubmission.create({
        data: {
            formId: form.id,
            userId: session?.user?.id || null,
            data,
        },
    });
    return NextResponse.json({ submission }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { slug } = await params;
    const form = await prisma.customForm.findFirst({ where: { OR: [{ slug }, { id: slug }] } });
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.customForm.delete({ where: { id: form.id } });
    return NextResponse.json({ message: "Deleted" });
}
