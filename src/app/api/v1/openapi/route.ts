import { NextResponse } from "next/server";
import spec from "@/core/generated/openapi.json";

/**
 * Serves the pre-generated OpenAPI 3.0 spec.
 *
 * Generation is handled by scripts/generate-openapi.ts (runs as part of
 * `npm run prebuild`). Serving from a static JSON keeps this route cheap
 * and avoids re-reading module manifests on every request.
 */
export async function GET() {
    return NextResponse.json(spec, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300",
        },
    });
}
