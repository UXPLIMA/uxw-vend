import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { logActivity } from "@/core/lib/activity-log";
import { ModuleModerationProviders } from "@/core/generated/module-moderation";
import { getModuleStates } from "@/core/lib/module-cache";

async function loadActiveProviders() {
    const states = await getModuleStates();
    return ModuleModerationProviders.filter((p) => states[p.module] !== false);
}

/**
 * GET /api/v1/admin/moderation?type=<provider-id>&page=1
 * Returns pending items for one provider. When type is omitted, returns
 * the per-provider pending counts.
 */
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const providers = await loadActiveProviders();
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const perPage = 20;

    if (!typeParam) {
        const counts: Record<string, number> = {};
        const labels: Record<string, {
            label: string;
            labelKey?: string;
            settingKey?: string;
            settingLabelKey?: string;
            settingDescKey?: string;
        }> = {};
        await Promise.all(
            providers.map(async (p) => {
                labels[p.id] = {
                    label: p.label,
                    labelKey: p.labelKey,
                    settingKey: p.settingKey,
                    settingLabelKey: p.settingLabelKey,
                    settingDescKey: p.settingDescKey,
                };
                try {
                    const mod = await p.loader();
                    counts[p.id] = await mod.default.count();
                } catch {
                    counts[p.id] = 0;
                }
            }),
        );
        return NextResponse.json({ counts, types: labels });
    }

    const provider = providers.find((p) => p.id === typeParam);
    if (!provider) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    try {
        const mod = await provider.loader();
        const { items, total } = await mod.default.list((page - 1) * perPage, perPage);
        return NextResponse.json({
            items: items.map((i) => ({ ...i, type: provider.id })),
            total,
            page,
            pages: Math.max(1, Math.ceil(total / perPage)),
        });
    } catch (err) {
        console.error("[moderation] fetch failed:", err);
        return NextResponse.json({ items: [], total: 0, page: 1, pages: 1 });
    }
}

const actionSchema = z.object({
    ids: z.array(z.string().min(1)).min(1),
    type: z.string().min(1),
    action: z.enum(["approve", "reject"]),
});

/**
 * POST /api/v1/admin/moderation
 * Body: { ids: string[], type, action: "approve" | "reject" }
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });
    }

    const providers = await loadActiveProviders();
    const provider = providers.find((p) => p.id === parsed.data.type);
    if (!provider) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const { ids, action } = parsed.data;
    const newState = action === "approve" ? "APPROVED" : "REJECTED";

    let affected = 0;
    try {
        const mod = await provider.loader();
        affected = await mod.default.bulkUpdate(ids, newState);
    } catch (err) {
        console.error("[moderation] action failed:", err);
        return NextResponse.json({ error: "Operation failed" }, { status: 500 });
    }

    logActivity({
        userId: session.user.id,
        action: `moderation.${action}`,
        entity: provider.id,
        metadata: { ids, count: affected },
    }).catch(() => { });

    return NextResponse.json({ ok: true, affected });
}
