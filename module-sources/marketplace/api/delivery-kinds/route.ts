import { NextResponse } from "next/server";
import { applyFiltersAsync } from "@/core/sdk";
import { auth } from "@/core/sdk/auth";

/**
 * GET /api/v1/marketplace/delivery-kinds - what can be handed over here.
 *
 * The list a seller picks from. Behind a session because it describes what
 * this site has installed, which is nobody else's business.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const kinds = await applyFiltersAsync("marketplace.delivery.kinds", [], {});
    return NextResponse.json({ kinds }, { headers: { "Cache-Control": "private, no-store" } });
}
