/**
 * Which products come with a key, and how many.
 *
 * The product id is opaque on purpose: this module holds no foreign key into
 * the store's tables, so it keeps working when the store is uninstalled and
 * the mapping survives to mean something again when it comes back.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma, isAdmin, readJsonBody } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

async function denyUnlessAdmin(): Promise<NextResponse | null> {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return null;
}

export async function GET() {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;
    return NextResponse.json({
        products: await prisma.licenseProduct.findMany({ orderBy: { createdAt: "desc" } }),
    });
}

export async function POST(request: NextRequest) {
    const denied = await denyUnlessAdmin();
    if (denied) return denied;

    const body = await readJsonBody(request, { fallback: {} });
    if (body instanceof NextResponse) return body;
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const data = {
        keysPerUnit: Math.max(1, Number(body.keysPerUnit) || 1),
        maxActivations: Math.max(1, Number(body.maxActivations) || 1),
        validDays: body.validDays ? Math.max(1, Number(body.validDays)) : null,
        prefix: typeof body.prefix === "string" && body.prefix ? body.prefix : null,
    };

    // Upsert rather than create: mapping the same product twice is a correction,
    // not an error worth showing an admin.
    const product = await prisma.licenseProduct.upsert({
        where: { productId },
        create: { productId, ...data },
        update: data,
    });
    return NextResponse.json({ product }, { status: 201 });
}
