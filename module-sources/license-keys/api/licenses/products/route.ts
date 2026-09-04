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
import { licenseProductSchema } from "../../../lib/validations";

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
    const parsed = licenseProductSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { productId } = parsed.data;

    const data = {
        keysPerUnit: parsed.data.keysPerUnit ?? 1,
        maxActivations: parsed.data.maxActivations ?? 1,
        validDays: parsed.data.validDays ?? null,
        prefix: parsed.data.prefix || null,
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
