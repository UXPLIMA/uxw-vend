import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

const SETTING_KEY = "cloudflare_turnstile_config";

const configSchema = z.object({
    siteKey: z.string().max(200).default(""),
    secretKey: z.string().max(200).default(""),
    enableOnLogin: z.boolean().default(false),
    enableOnRegister: z.boolean().default(false),
});

export async function GET() {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    return NextResponse.json(setting?.value || { siteKey: "", secretKey: "", enableOnLogin: false, enableOnRegister: false });
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

    await prisma.setting.upsert({
        where: { key: SETTING_KEY },
        create: { key: SETTING_KEY, value: parsed.data, module: "cloudflare-turnstile" },
        update: { value: parsed.data },
    });

    return NextResponse.json({ ok: true });
}
