import { NextRequest, NextResponse } from "next/server";
import { isAdmin, log, moduleSettings, prisma, readJsonBody, sanitizeHtml } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { productSchema } from "../../../lib/validations";
import { availabilityData } from "../../../lib/availability-input";
import { PUBLIC_PRODUCT } from "../../../lib/public-product";
import { availabilityFor, type ProductRow } from "../../../lib/availability-server";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/store/products/[id] - Get single product
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        // Switched off is a filter, not a check after the fact: the row never
        // leaves the database, so there is nothing to leak by mistake later.
        const product = await prisma.product.findFirst({
            where: {
                isActive: true,
                OR: [
                    { id },
                    { slug: id },
                    ...(isNaN(Number(id)) ? [] : [{ number: Number(id) }]),
                ],
            },
            select: PUBLIC_PRODUCT,
        });

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        // The page needs to know whether it may offer a buy button, and why
        // not when it may not. Per-person counting needs the session, which is
        // why this answer is not shared-cached the way the listing is.
        const session = await auth();
        const state = await availabilityFor(
            prisma,
            product as unknown as ProductRow,
            session?.user?.id ?? null,
        );

        // A product an operator asked to hide while it is shut is not here as
        // far as a visitor is concerned - the same answer as one that does not
        // exist, so the two cannot be told apart.
        const hidden = product.outsideWindow === "hidden"
            && state.state !== "open" && state.state !== "limit_reached";
        if (hidden && !(session?.user?.id && await isAdmin(session.user.id))) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const { lowStockAt } = await moduleSettings<{ lowStockAt: number }>("store");

        return NextResponse.json({
            product: {
                ...product,
                lowStockAt,
                availability: {
                    state: state.state,
                    buyable: state.buyable,
                    opensAt: state.opensAt,
                    closesAt: state.closesAt,
                    remainingForPerson: state.remainingForPerson,
                    remainingInPeriod: state.remainingInPeriod,
                },
                price: state.price,
                was: state.was,
                onSale: state.onSale,
            },
        });
    } catch (error) {
        log.error("Get product error", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH /api/v1/store/products/[id] - Update product (admin)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminCheck = await isAdmin(session.user.id);
        if (!adminCheck) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await readJsonBody(request);
        if (body instanceof NextResponse) return body;
        const validation = productSchema.partial().safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            );
        }

        const existing = await prisma.product.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const data = { ...validation.data };
        if (data.description !== undefined) {
            data.description = sanitizeHtml(data.description);
        }

        // The schedule arrives as wall-clock strings; the column holds
        // instants. Splitting them out keeps the string fields off the update.
        const scheduled = await availabilityData(data);
        for (const key of Object.keys(scheduled)) {
            delete (data as Record<string, unknown>)[key];
        }

        const product = await prisma.product.update({
            where: { id },
            data: { ...data, ...scheduled },
            include: { category: true },
        });

        return NextResponse.json({ product });
    } catch (error) {
        log.error("Update product error", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE /api/v1/store/products/[id] - Delete product (admin)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminCheck = await isAdmin(session.user.id);
        if (!adminCheck) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;

        const existing = await prisma.product.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        // Soft delete - set inactive instead of hard delete
        await prisma.product.update({ where: { id }, data: { isActive: false } });

        return NextResponse.json({ message: "Product archived" });
    } catch (error) {
        log.error("Delete product error", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
