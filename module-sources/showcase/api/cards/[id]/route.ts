import { NextRequest, NextResponse } from "next/server";
import { isAdmin, logActivity, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { z } from "zod";
import { cardImage, cardLink } from "../../../lib/card";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Editing and removing one card.
 *
 * The addresses are held to the same rule as on the way in. An edit that
 * pastes a `javascript:` link into a card that already exists is the same
 * hazard as creating one with it, and the two paths used to be the place
 * where a check exists on one and not the other.
 */
const cardPatchSchema = z.object({
    title: z.string().min(1).max(120).optional(),
    body: z.string().max(500).nullable().optional(),
    image: z.string().max(1000).nullable().optional(),
    href: z.string().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
    order: z.number().int().min(0).max(9999).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const parsed = cardPatchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    if (parsed.data.href && !cardLink(parsed.data.href)) {
        return NextResponse.json(
            { error: "A link has to be a path on this site or a whole https address", code: "showcase_bad_link" },
            { status: 400 },
        );
    }
    if (parsed.data.image && !cardImage(parsed.data.image)) {
        return NextResponse.json(
            { error: "A picture has to be a path on this site or a whole https address", code: "showcase_bad_image" },
            { status: 400 },
        );
    }

    const changed = await prisma.showcaseCard.updateMany({ where: { id }, data: parsed.data });
    if (changed.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await logActivity({
        userId: session.user.id,
        action: "showcase.card.updated",
        entity: "showcase_card",
        entityId: id,
    }).catch(() => {});

    const card = await prisma.showcaseCard.findUnique({ where: { id } });
    return NextResponse.json({ card });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    // Removed outright: a card is a thing an operator wrote, with nothing
    // pointing at it and no history worth keeping.
    const gone = await prisma.showcaseCard.deleteMany({ where: { id } });
    if (gone.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await logActivity({
        userId: session.user.id,
        action: "showcase.card.deleted",
        entity: "showcase_card",
        entityId: id,
    }).catch(() => {});

    return NextResponse.json({ deleted: true });
}
