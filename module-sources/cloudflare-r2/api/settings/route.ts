import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

const SETTING_KEY = "cloudflare_r2_config";
const ACTIVE_KEY = "storage_active_provider";

const configSchema = z.object({
    accountId: z.string().min(1),
    bucket: z.string().min(1),
    accessKey: z.string().min(1),
    secretKey: z.string().min(1),
    publicUrl: z.string().url(),
    setActive: z.boolean().optional(),
});

export async function GET() {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [config, active] = await Promise.all([
        prisma.setting.findUnique({ where: { key: SETTING_KEY } }),
        prisma.setting.findUnique({ where: { key: ACTIVE_KEY } }),
    ]);

    return NextResponse.json({
        config: config?.value || null,
        isActive: active?.value === "cloudflare-r2" || (typeof active?.value === "object" && active?.value && (active.value as { id?: string }).id === "cloudflare-r2"),
    });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid config" }, { status: 400 });
    }

    const { setActive, ...config } = parsed.data;

    await prisma.setting.upsert({
        where: { key: SETTING_KEY },
        create: { key: SETTING_KEY, value: config, module: "cloudflare-r2" },
        update: { value: config },
    });

    if (setActive) {
        await prisma.setting.upsert({
            where: { key: ACTIVE_KEY },
            create: { key: ACTIVE_KEY, value: "cloudflare-r2", module: "core" },
            update: { value: "cloudflare-r2" },
        });
    }

    return NextResponse.json({ ok: true });
}
