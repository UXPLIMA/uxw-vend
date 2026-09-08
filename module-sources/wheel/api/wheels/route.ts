import { NextRequest, NextResponse } from "next/server";
import { isAdmin, prisma, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { wheelSchema } from "../../lib/validations";
import { refusalFor, nextTurnAt } from "../../lib/wheels";

/**
 * The wheels this visitor can see, and what each of them will let them do.
 *
 * One answer rather than a list plus a probe per wheel: the page draws a
 * button per wheel and every one of them needs the same four facts - is it on,
 * may I turn it, when may I turn it next, and what does it cost.
 */
export async function GET() {
    const session = await auth();
    const moderator = session?.user?.id ? await isAdmin(session.user.id) : false;

    // The admin screen edits every wheel, including the ones switched off and
    // the rules a visitor has no business reading.
    if (moderator) {
        const all = await prisma.wheel.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
        return NextResponse.json({
            // `roleId` is what the form writes: one role is the question an
            // operator asks, and the column stays a list so several stay
            // possible through the API.
            wheels: all.map((wheel) => ({ ...wheel, roleId: wheel.roleIds[0] ?? "" })),
        });
    }

    const [wheels, user] = await Promise.all([
        prisma.wheel.findMany({
            where: { isActive: true },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            include: {
                prizes: {
                    where: { isActive: true },
                    orderBy: { order: "asc" },
                    select: { id: true, name: true, color: true, type: true, value: true },
                },
            },
        }),
        session?.user?.id
            ? prisma.user.findUnique({
                where: { id: session.user.id },
                select: { creditBalance: true, roleId: true },
            })
            : Promise.resolve(null),
    ]);

    // One query for every wheel's last turn rather than one per wheel.
    const lastTurns = session?.user?.id
        ? await prisma.wheelSpin.groupBy({
            by: ["wheelId"],
            where: { userId: session.user.id },
            _max: { createdAt: true },
        })
        : [];
    const lastTurnOf = new Map(lastTurns.map((row) => [row.wheelId, row._max.createdAt]));

    return NextResponse.json({
        wheels: wheels.map((wheel) => {
            const rules = {
                cooldown: wheel.cooldown,
                cooldownHours: wheel.cooldownHours,
                cost: wheel.cost,
                roleIds: wheel.roleIds,
                isActive: wheel.isActive,
            };
            const lastTurn = lastTurnOf.get(wheel.id) ?? null;
            const refusal = refusalFor(rules, {
                signedIn: Boolean(session?.user?.id),
                roleId: user?.roleId ?? null,
                credits: Number(user?.creditBalance ?? 0),
                lastTurn,
            });
            return {
                id: wheel.id,
                slug: wheel.slug,
                name: wheel.name,
                description: wheel.description,
                cost: wheel.cost,
                cooldown: wheel.cooldown,
                cooldownHours: wheel.cooldownHours,
                restricted: wheel.roleIds.length > 0,
                prizes: wheel.prizes,
                canTurn: refusal === null,
                refusal,
                nextTurnAt: nextTurnAt(rules, lastTurn),
            };
        }),
        credits: Number(user?.creditBalance ?? 0),
    });
}

// POST /api/v1/wheel/wheels - create one (admin)
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    const parsed = wheelSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const existing = await prisma.wheel.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return NextResponse.json({ error: "That address is taken" }, { status: 409 });

    const { roleId, ...fields } = parsed.data;
    const wheel = await prisma.wheel.create({
        data: { ...fields, roleIds: roleId ? [roleId] : (fields.roleIds ?? []) },
    });
    return NextResponse.json({ wheel }, { status: 201 });
}
