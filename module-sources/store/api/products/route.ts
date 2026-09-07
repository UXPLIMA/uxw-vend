import { NextRequest, NextResponse } from "next/server";
import { slugify } from "@/core/sdk";
import { isAdmin, log, pageParams, prisma, readJsonBody, sanitizeHtml } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { productSchema } from "../../lib/validations";

/**
 * The listing is the same whoever asked: it filters on query parameters and
 * reads no session. `s-maxage` speaks to shared caches and not to browsers,
 * so no visitor's own cache is involved. If this ever starts varying by who
 * is asking, it has to lose this.
 */
const SHARED_CACHE = { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" };

// GET /api/v1/store/products - List products
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const { page, limit, skip, take } = pageParams(searchParams, { defaultLimit: 12 });
        const category = searchParams.get("category");
        const featured = searchParams.get("featured") === "true";
        const search = searchParams.get("search") || "";
        const sort = searchParams.get("sort") || "newest";

        const showAll = searchParams.get("all") === "true";

        const where = {
            ...(!showAll && { isActive: true }),
            ...(category && { category: { slug: category } }),
            ...(featured && { isFeatured: true }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" as const } },
                    { description: { contains: search, mode: "insensitive" as const } },
                ],
            }),
        };

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    category: {
                        select: { id: true, name: true, slug: true },
                    },
                },
                skip,
                take,
                orderBy: sort === "price_asc" ? { price: "asc" }
                    : sort === "price_desc" ? { price: "desc" }
                    : sort === "popular" ? { orderItems: { _count: "desc" } }
                    : { createdAt: "desc" },
            }),
            prisma.product.count({ where }),
        ]);

        return NextResponse.json({
            products,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        }, { headers: SHARED_CACHE });
    } catch (error) {
        log.error("List products error", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// POST /api/v1/store/products - Create product (admin)
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminCheck = await isAdmin(session.user.id);
        if (!adminCheck) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await readJsonBody(request);
        if (body instanceof NextResponse) return body;
        const validation = productSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.issues[0].message },
                { status: 400 }
            );
        }

        const data = validation.data;
        const slug = data.slug || slugify(data.name);

        // Check if slug exists
        const existing = await prisma.product.findUnique({ where: { slug } });
        if (existing) {
            return NextResponse.json(
                { error: "A product with this slug already exists" },
                { status: 400 }
            );
        }

        const product = await prisma.product.create({
            data: {
                name: data.name,
                slug,
                description: data.description !== undefined ? sanitizeHtml(data.description) : data.description,
                shortDesc: data.shortDesc,
                price: data.price,
                comparePrice: data.comparePrice,
                image: data.image,
                images: data.images || [],
                stock: data.stock,
                isActive: data.isActive ?? true,
                isFeatured: data.isFeatured ?? false,
                type: data.type || "DIGITAL",
                categoryId: data.categoryId,
                deliveryData: data.deliveryData,
                subscriptionInterval: data.type === "SUBSCRIPTION" ? data.subscriptionInterval : null,
                subscriptionIntervalCount: data.type === "SUBSCRIPTION" ? data.subscriptionIntervalCount : null,
            },
            include: {
                category: true,
            },
        });

        const { doActionAsync } = await import("@/core/sdk");
        await doActionAsync("store.product.created", product);

        return NextResponse.json({ product }, { status: 201 });
    } catch (error) {
        log.error("Create product error", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
