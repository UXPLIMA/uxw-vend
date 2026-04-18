import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { canAccessForm } from "../../lib/can-access-form";

// GET /api/v1/forms/submissions - list submissions.
// Access:
//   - admin / custom-forms.manage role perm → all forms
//   - users with a granular "custom-forms.form" view grant → only that form
//     (a formId query param is required in this case)
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formId = request.nextUrl.searchParams.get("formId");
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "50") || 50));

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        // Non-admins must scope the listing to a single form and must have
        // either the role perm or a granular grant on that specific form.
        if (!formId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!(await canAccessForm(session.user.id, formId, "view"))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    const where: Record<string, unknown> = {};
    if (formId) where.formId = formId;

    const [submissions, total] = await Promise.all([
        prisma.customFormSubmission.findMany({
            where,
            include: {
                form: { select: { id: true, title: true, slug: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.customFormSubmission.count({ where }),
    ]);

    return NextResponse.json({ submissions, total, pages: Math.ceil(total / limit) });
}
