
import { NextRequest, NextResponse } from "next/server";
import { ModuleApiRegistry } from "@/core/generated/module-registry";
import { matchApiRoute } from "@/core/lib/api-matcher";

async function handleRequest(req: NextRequest, paramsPromise: Promise<{ path: string[] }>, method: string) {
    const { path } = await paramsPromise;
    const match = matchApiRoute(path);

    if (!match) {
        // If not matched, it might be handled by another specialized route or it's a 404
        return NextResponse.json({ error: "API route not found" }, { status: 404 });
    }

    const loadHandler = ModuleApiRegistry[match.key];
    if (!loadHandler) {
        console.error(`API handler not found in registry: ${match.key}`);
        return NextResponse.json({ error: "API handler missing" }, { status: 500 });
    }

    try {
        const handlerModule = await loadHandler();
        const handler = handlerModule[method];

        if (!handler) {
            return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
        }

        // Call the handler
        // We pass the request and context merging the original params with dynamic route params
        return handler(req, { params: { ...match.params } });
    } catch (error) {
        console.error(`Error executing API handler for ${match.key}:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "GET");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "POST");
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "PUT");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "DELETE");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    return handleRequest(req, params, "PATCH");
}
