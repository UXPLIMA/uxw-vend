import { NextRequest, NextResponse } from "next/server";
import { resolveRedirect } from "@/core/sdk";
import { isAdmin, invalidate, logActivity, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { z } from "zod";

/**
 * The signs on the doors of pages that moved.
 *
 * A new rule is checked against the ones already there before it is written.
 * A circle is two rules that each look right alone, and the only place both
 * are visible is here: leaving it to the visitor means a browser following
 * twenty hops and giving up on an error page nobody sees.
 */
const redirectSchema = z.object({
    from: z.string().min(1).max(500),
    to: z.string().min(1).max(1000),
    permanent: z.boolean().default(true),
    note: z.string().max(200).optional(),
});

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const redirects = await prisma.urlRedirect.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
    });
    return NextResponse.json({ redirects }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = redirectSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { from, to, permanent, note } = parsed.data;

    const existing = await prisma.urlRedirect.findMany({
        where: { isActive: true },
        select: { from: true, to: true, permanent: true },
        take: 500,
    });

    // Asked of the resolver rather than checked by hand: it is the thing that
    // will decide at request time, so it is the thing that has to accept this.
    const wouldGo = resolveRedirect(from, "en", [...existing, { from, to, permanent }]);
    if (!wouldGo) {
        /*
         * Either the target is not a destination, or following it comes back
         * here, and an operator can act on either - so the two are told apart
         * rather than given one sentence.
         *
         * Asking the same rule from a path nothing else uses is what separates
         * them: it takes the loop out of the question and leaves only whether
         * the target is somewhere to go. Asking with the rule as written would
         * call `/self` to `/self` a bad target, which is the commonest mistake
         * and the one worth naming correctly.
         */
        const probe = resolveRedirect("/__redirect_probe", "en", [
            { from: "/__redirect_probe", to, permanent },
        ]);
        return NextResponse.json(
            {
                error: probe ? "That would send visitors in a circle" : "That is not a destination",
                code: probe ? "redirect_loop" : "redirect_bad_target",
            },
            { status: 400 },
        );
    }

    try {
        const redirect = await prisma.urlRedirect.create({
            data: { from, to, permanent, note: note ?? null },
        });

        // Core keeps the rules for a minute; an operator who just wrote one
        // should not have to wait to try it.
        await invalidate("uxw:routing:redirects");

        await logActivity({
            userId: session.user.id,
            action: "url_redirects.created",
            entity: "url_redirect",
            entityId: redirect.id,
            metadata: { from, to },
        }).catch(() => {});

        return NextResponse.json({ redirect }, { status: 201 });
    } catch (err) {
        if (err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === "P2002") {
            return NextResponse.json(
                { error: "There is already a sign on that door", code: "redirect_exists" },
                { status: 409 },
            );
        }
        throw err;
    }
}
