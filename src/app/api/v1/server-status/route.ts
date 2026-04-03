import { NextResponse } from "next/server";
import { getServerStatus } from "@/core/lib/server-query";

// GET /api/v1/server-status - Public
export async function GET() {
    const status = await getServerStatus();
    return NextResponse.json(status);
}
