import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { rateLimitForRoleAsync } from "@/core/lib/rate-limit";

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

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown";
    const identifier = session?.user?.id ? `custom-forms:submit:${session.user.id}` : `custom-forms:submit:${ip}`;
    const allowed = await rateLimitForRoleAsync(
        identifier,
        { maxRequests: 5, windowMs: 60_000 },
        session?.user?.role
    );
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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

    // Fire hook for cross-module reactions
    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("customforms.submission.created", { form, submission });

    // Private activity feed entry (only if logged in)
    if (session?.user?.id) {
        await prisma.activityFeedItem.create({
            data: {
                type: "customforms.submission.created",
                actorId: session.user.id,
                title: `Submitted form: ${form.title}`,
                href: `/forms/${form.slug}`,
                icon: "ClipboardList",
                isPublic: false,
            },
        }).catch(() => {});
    }

    return NextResponse.json({ submission }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { slug } = await params;
    const form = await prisma.customForm.findFirst({ where: { OR: [{ slug }, { id: slug }] } });
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (Array.isArray(body.fields)) data.fields = body.fields;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const updated = await prisma.customForm.update({ where: { id: form.id }, data });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("customforms.form.updated", updated);

    return NextResponse.json({ form: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { slug } = await params;
    const form = await prisma.customForm.findFirst({ where: { OR: [{ slug }, { id: slug }] } });
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.customForm.delete({ where: { id: form.id } });

    const { doActionAsync } = await import("@/core/lib/hooks");
    await doActionAsync("customforms.form.deleted", form);

    return NextResponse.json({ message: "Deleted" });
}
