import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { addBlock, isValidIpOrCidr, listBlocks } from "@/core/lib/ip-blocks";
import { logActivity } from "@/core/lib/activity-log";

/**
 * Admin API for managing the IP allowlist / blocklist.
 *
 * GET  — list every block (including expired ones) for the admin UI.
 * POST — create a new block. Body matches createSchema below.
 */

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { session };
}

export async function GET() {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    const blocks = await listBlocks();
    return NextResponse.json({ blocks });
}

const createSchema = z.object({
    ip: z.string().min(1).max(64),
    scope: z.enum(["all", "admin", "api"]).default("all"),
    reason: z.string().max(500).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
});

export async function POST(request: NextRequest) {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message || "Invalid input", issues: parsed.error.issues },
            { status: 400 },
        );
    }

    if (!isValidIpOrCidr(parsed.data.ip)) {
        return NextResponse.json(
            { error: "IP must be a valid IPv4 address or IPv4 CIDR (e.g. 1.2.3.4 or 10.0.0.0/8)" },
            { status: 400 },
        );
    }

    try {
        const block = await addBlock({
            ip: parsed.data.ip,
            scope: parsed.data.scope,
            reason: parsed.data.reason ?? undefined,
            expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
            createdById: guard.session?.user?.id,
        });

        logActivity({
            userId: guard.session?.user?.id,
            action: "ip-block.create",
            entity: "ipBlock",
            entityId: block.id,
            metadata: {
                ip: block.ip,
                scope: block.scope,
                reason: block.reason ?? null,
                expiresAt: block.expiresAt ? block.expiresAt.toISOString() : null,
            },
        }).catch(() => {});

        return NextResponse.json({ block }, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create block";
        if (message.includes("Unique constraint")) {
            return NextResponse.json({ error: "That IP is already blocked" }, { status: 409 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
