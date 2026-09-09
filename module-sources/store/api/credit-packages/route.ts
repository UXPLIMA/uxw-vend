import { NextResponse } from "next/server";
import { prisma } from "@/core/sdk/server";
import { buyableNow } from "../../lib/credit-packages";

/**
 * GET /api/v1/store/credit-packages - what a buyer may pick.
 *
 * Public and the same for everybody, so it may be kept for a moment. It says
 * what each package costs and what it gives, which is what the screen has to
 * draw; the bonus is shown separately because that is the reason to buy the
 * larger one.
 */
export async function GET() {
    const packages = await prisma.creditPackage.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { price: "asc" }],
        take: 50,
    });

    return NextResponse.json(
        {
            packages: packages.filter(buyableNow).map((pack) => ({
                id: pack.id,
                name: pack.name,
                credits: pack.credits,
                bonusCredits: pack.bonusCredits,
                price: Number(pack.price),
            })),
        },
        { headers: { "Cache-Control": "public, max-age=60" } },
    );
}
