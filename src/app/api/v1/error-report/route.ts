import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/core/lib/logger";
import { rateLimit, getClientIP, rateLimits } from "@/core/lib/rate-limit";
import { readJsonBody } from "@/core/lib/api-body";
import { z } from "zod";

/**
 * What a browser may report about a client-side crash. Every field is
 * optional and bounded: this endpoint is anonymous, and the report ends up in
 * the log stream, so a field with no ceiling is a way to write to it.
 */
const errorReportSchema = z.object({
    message: z.string().max(500).optional(),
    url: z.string().max(500).optional(),
    stack: z.string().max(2000).optional(),
    componentStack: z.string().max(1000).optional(),
    userAgent: z.string().max(300).optional(),
});

export async function POST(request: NextRequest) {
    // Rate limit error reports (use API limit)
    const ip = getClientIP(request.headers);
    const rl = await rateLimit(`error-report:${ip}`, rateLimits.api);
    if (!rl.success) return NextResponse.json({ error: "Too many reports" }, { status: 429 });

    try {
        const body = await readJsonBody(request);
        if (body instanceof NextResponse) return body;
        // Non-strict on purpose: a browser may send more than we log, and a
        // crash report is not worth refusing over an extra field.
        const report = errorReportSchema.safeParse(body);
        if (!report.success) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }
        const { message, url, stack, componentStack, userAgent } = report.data;
        const logger = createLogger();

        logger.error("client_error", {
            clientMessage: message ?? "unknown",
            url: url ?? "",
            stack,
            componentStack,
            userAgent: userAgent ?? "",
            ip,
        });

        return NextResponse.json({ received: true });
    } catch {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
}
