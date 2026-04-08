import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import {
    ROLE_MULTIPLIER_SETTING_KEY,
    invalidateRoleMultiplierCache,
} from "@/core/lib/rate-limit";

/**
 * Admin API for managing per-role rate limit multipliers.
 *
 * The multipliers are stored in Setting { key: "rate_limit_role_multipliers" }
 * as a JSON object mapping role name -> number (0 = unlimited, otherwise
 * multiplies the base limit). Defaults to 1 for any role not present.
 */

// Role name must match how roles are stored; allow a safe subset.
const roleNameSchema = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid role name format");

// Multipliers: integer-ish number between 0 and 100 (inclusive).
const multiplierSchema = z
    .number()
    .finite()
    .min(0, "Multiplier must be >= 0")
    .max(100, "Multiplier must be <= 100");

const bodySchema = z.object({
    multipliers: z.record(roleNameSchema, multiplierSchema),
});

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

// GET /api/v1/admin/rate-limits
// Returns { roles: [{id,name,displayName,priority}], multipliers: { role: number } }
export async function GET() {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    const [roles, setting] = await Promise.all([
        prisma.role.findMany({
            orderBy: { priority: "desc" },
            select: { id: true, name: true, displayName: true, priority: true },
        }),
        prisma.setting.findUnique({ where: { key: ROLE_MULTIPLIER_SETTING_KEY } }),
    ]);

    let multipliers: Record<string, number> = {};
    if (setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)) {
        for (const [role, raw] of Object.entries(setting.value as Record<string, unknown>)) {
            const num = typeof raw === "number" ? raw : Number(raw);
            if (Number.isFinite(num) && num >= 0 && num <= 100) {
                multipliers[role] = num;
            }
        }
    }

    // Fill in defaults (1) for any role that has no entry yet.
    for (const r of roles) {
        if (!(r.name in multipliers)) multipliers[r.name] = 1;
    }

    return NextResponse.json({ roles, multipliers });
}

// POST /api/v1/admin/rate-limits
// Body: { multipliers: { [roleName]: number } }
export async function POST(request: NextRequest) {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid multipliers", issues: parsed.error.issues },
            { status: 400 }
        );
    }

    const value = parsed.data.multipliers as Prisma.InputJsonValue;
    await prisma.setting.upsert({
        where: { key: ROLE_MULTIPLIER_SETTING_KEY },
        update: { value },
        create: { key: ROLE_MULTIPLIER_SETTING_KEY, value, module: "core" },
    });

    // Force the next rateLimitForRole() call to reload from DB.
    invalidateRoleMultiplierCache();

    return NextResponse.json({ ok: true, multipliers: parsed.data.multipliers });
}
