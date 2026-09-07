import { NextRequest, NextResponse } from "next/server";
import { slugify } from "@/core/sdk";
import { isAdmin, log, pageParams, prisma, readJsonBody, sanitizeHtml } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { productSchema } from "../../lib/validations";
import { PUBLIC_PRODUCT } from "../../lib/public-product";
import { popularWindow } from "../../lib/popular-window";
import type { Prisma } from "@prisma/client";

/**
 * The listing is the same whoever asked: it filters on query parameters and
 * reads no session. `s-maxage` speaks to shared caches and not to browsers,
 * so no visitor's own cache is involved. If this ever starts varying by who
 * is asking, it has to lose this.
 */
const SHARED_CACHE = { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" };


/**
 * Products ordered by how many of them people have actually bought.
 *
 * It used to be `orderBy: { orderItems: { _count: "desc" } }`, which counts an
 * order item whatever became of its order - and checkout writes the `Order`
 * with `status: "PENDING"` before the buyer pays. An abandoned checkout raised
 * a product's ranking for good, so anyone could put anything at the top of the
 * shop by starting checkouts and walking away. Measured on a seeded database:
 * a product with no paid orders and five thousand abandoned ones came back
 * first.
 *
 * Prisma cannot filter the relation it counts inside `orderBy` - both spellings
 * were tried and rejected - so the ranking is read from a `groupBy`, the same
 * way this module's admin statistics have always read it. The route's own
 * filter object goes in under `product`, so a category or a search narrows the
 * ranking exactly as it narrows the list, with no second copy of it in SQL.
 *
 * A product nobody has bought still belongs in the list, after the ones people
 * have, which is what `popularWindow` works out. The `notIn` there is bounded
 * by how many products have ever sold, and only a page reaching past them
 * pays for it.
 */
async function mostSoldFirst(where: Prisma.ProductWhereInput, skip: number, take: number) {
    const ranked = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: { status: "COMPLETED" }, productId: { not: null }, product: where },
        _count: { productId: true },
        orderBy: { _count: { productId: "desc" } },
    });
    const rankedIds = ranked
        .map((row) => row.productId)
        .filter((id): id is string => typeof id === "string");

    const window = popularWindow(rankedIds, skip, take);

    const [sold, neverSold] = await Promise.all([
        window.ids.length
            ? prisma.product.findMany({ where: { ...where, id: { in: window.ids } }, select: PUBLIC_PRODUCT })
            : Promise.resolve([]),
        window.tailTake
            ? prisma.product.findMany({
                  where: rankedIds.length ? { ...where, id: { notIn: rankedIds } } : where,
                  select: PUBLIC_PRODUCT,
                  orderBy: { createdAt: "desc" },
                  skip: window.tailSkip,
                  take: window.tailTake,
              })
            : Promise.resolve([]),
    ]);

    // `in` promises no order of its own, so the ranking is reapplied here.
    const byId = new Map(sold.map((product) => [product.id, product]));
    const inRankOrder = window.ids
        .map((id) => byId.get(id))
        .filter((product): product is (typeof sold)[number] => product !== undefined);

    return [...inRankOrder, ...neverSold];
}

// GET /api/v1/store/products - List products
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const { page, limit, skip, take } = pageParams(searchParams, { defaultLimit: 12 });
        const category = searchParams.get("category");
        const featured = searchParams.get("featured") === "true";
        const search = searchParams.get("search") || "";
        const sort = searchParams.get("sort") || "newest";

        // Always. A product an operator switched off is not on the shelf,
        // and this answer is public: it used to drop the filter for anyone
        // who wrote `?all=true`, and since it became something a proxy may
        // hold, that answer would have been cached and served as well as
        // computed. The screen that needs the full list asks
        // /api/v1/store/admin/products, which checks who is asking.
        const where = {
            isActive: true,
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
            sort === "popular"
                ? mostSoldFirst(where, skip, take)
                : prisma.product.findMany({
                      where,
                      select: PUBLIC_PRODUCT,
                      skip,
                      take,
                      orderBy: sort === "price_asc" ? { price: "asc" }
                          : sort === "price_desc" ? { price: "desc" }
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
