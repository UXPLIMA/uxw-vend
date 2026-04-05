import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIP, rateLimits } from "./rate-limit";

/**
 * Apply rate limiting to an API handler
 */
export function withRateLimit(
    handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
    config = rateLimits.api
) {
    return async (request: NextRequest, ...args: unknown[]) => {
        const ip = getClientIP(request.headers);
        const { success, remaining, resetAt } = await rateLimit(ip, config);

        if (!success) {
            return NextResponse.json(
                { error: "Too many requests. Please try again later." },
                {
                    status: 429,
                    headers: {
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
                        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
                    },
                }
            );
        }

        const response = await handler(request, ...args);
        response.headers.set("X-RateLimit-Remaining", String(remaining));
        return response;
    };
}

/**
 * Standard API response format
 */
export function apiSuccess<T>(data: T, status = 200) {
    return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Standard paginated response
 */
export function apiPaginated<T>(items: T[], total: number, page: number, limit: number) {
    return NextResponse.json({
        success: true,
        data: items,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        },
    });
}
