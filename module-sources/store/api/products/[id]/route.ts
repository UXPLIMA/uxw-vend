import { NextRequest, NextResponse } from "next/server";
import { isAdmin, log, prisma, readJsonBody, sanitizeHtml } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { productSchema } from "../../../lib/validations";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/store/products/[id] - Get single product
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        const product = await prisma.product.findFirst({
            where: {
                OR: [
                    { id },
                    { slug: id },
                    ...(isNaN(Number(id)) ? [] : [{ number: Number(id) }]),
                ],
            },
            include: {
                category: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });

        const notFound = () =>
            NextResponse.json({ error: "Product not found" }, { status: 404 });

        if (!product) return notFound();

        // A switched-off product is not on the shelf, and this route answers by
        // `number` as well as by id and slug - a sequential integer, so walking
        // 1, 2, 3 read every product the listing was careful to hide. It answers
        // exactly as it does for a product that never existed, so the 404 says
        // nothing about which of the two it is.
        //
        // The administrator exception is not a loophole: the edit screen loads a
        // product from this endpoint, and the one an operator most needs to open
        // is the one they just switched off. The check runs only when the
        // product is off, so the page a visitor actually asks for does not pay
        // for a session lookup it never needs.
        if (!product.isActive) {
            const session = await auth();
            const viewerIsAdmin = session?.user?.id ? await isAdmin(session.user.id) : false;
            if (!viewerIsAdmin) return notFound();
        }

        return NextResponse.json({ product });
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

        const product = await prisma.product.update({
            where: { id },
            data,
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
