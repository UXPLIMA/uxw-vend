import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { productSchema } from "@/core/lib/validations";
import { slugify } from "@/core/lib/utils";
import { isAdmin } from "@/core/lib/permissions";

// GET /api/v1/store/products - List products
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "12");
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
                skip: (page - 1) * limit,
                take: limit,
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
        });
    } catch (error) {
        console.error("List products error:", error);
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

        const body = await request.json();
        const validation = productSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
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
                description: data.description,
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
            },
            include: {
                category: true,
            },
        });

        return NextResponse.json({ product }, { status: 201 });
    } catch (error) {
        console.error("Create product error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
