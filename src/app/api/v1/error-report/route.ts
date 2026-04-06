import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/core/lib/logger";
import { rateLimit, getClientIP, rateLimits } from "@/core/lib/rate-limit";

export async function POST(request: NextRequest) {
    // Rate limit error reports (use API limit)
    const ip = getClientIP(request.headers);
    const rl = await rateLimit(`error-report:${ip}`, rateLimits.api);
    if (!rl.success) return NextResponse.json({ error: "Too many reports" }, { status: 429 });

    try {
        const body = await request.json();
        const logger = createLogger();

        logger.error("client_error", {
            clientMessage: typeof body.message === "string" ? body.message.slice(0, 500) : "unknown",
            url: typeof body.url === "string" ? body.url.slice(0, 500) : "",
            stack: typeof body.stack === "string" ? body.stack.slice(0, 2000) : undefined,
            componentStack: typeof body.componentStack === "string" ? body.componentStack.slice(0, 1000) : undefined,
            userAgent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 300) : "",
            ip,
        });

        return NextResponse.json({ received: true });
    } catch {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
}
