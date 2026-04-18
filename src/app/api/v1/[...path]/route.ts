import { NextRequest, NextResponse } from "next/server";
import { ModuleApiRegistry } from "@/core/generated/module-registry";
import { matchApiRoute } from "@/core/lib/api-matcher";
import { logRequest } from "@/core/lib/logger";
import { recordMetric } from "@/core/lib/metrics";

async function handleRequest(req: NextRequest, paramsPromise: Promise<{ path: string[] }>, method: string) {
    const { path } = await paramsPromise;
    const fullPath = `/api/v1/${path.join("/")}`;
    const requestStart = Date.now();
    const { correlationId, finish } = logRequest(method, fullPath);
    const match = matchApiRoute(path);

    if (!match) {
        finish(404);
        recordMetric(method, fullPath, 404, Date.now() - requestStart);
        return NextResponse.json({ error: "API route not found" }, { status: 404 });
    }

    // Enforce method restriction from module manifest
    if (match.method && match.method !== "ALL" && match.method !== method) {
        finish(405);
        recordMetric(method, fullPath, 405, Date.now() - requestStart);
        return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
    }

    const loadHandler = ModuleApiRegistry[match.key];
    if (!loadHandler) {
        finish(500, { error: "handler_missing", handler: match.key });
        recordMetric(method, fullPath, 500, Date.now() - requestStart);
        return NextResponse.json({ error: "API handler missing" }, { status: 500 });
    }

    try {
        const handlerModule = await loadHandler();
        const handler = handlerModule[method] as
            | ((req: NextRequest, ctx: { params: Record<string, string | string[]> }) => Promise<NextResponse>)
            | undefined;

        if (typeof handler !== "function") {
            finish(405);
            recordMetric(method, fullPath, 405, Date.now() - requestStart);
            return NextResponse.json({ error: `Method ${method} not allowed` }, { status: 405 });
        }

        const response: NextResponse = await handler(req, { params: { ...match.params } });
        const status = response.status || 200;
        finish(status, { handler: match.key });
        recordMetric(method, fullPath, status, Date.now() - requestStart);
        response.headers.set("x-correlation-id", correlationId);
        return response;
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        finish(500, { error: errMsg, handler: match.key });
        recordMetric(method, fullPath, 500, Date.now() - requestStart);
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
