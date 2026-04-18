import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";

const SETTING_KEY = "currency_config";

const currencySchema = z.object({
    code: z.string().min(2).max(8),
    name: z.string().min(1).max(64),
    symbol: z.string().min(1).max(8),
    rate: z.number().positive(),
    enabled: z.boolean().default(true),
});

const configSchema = z.object({
    base: z.string().min(2).max(8),
    currencies: z.array(currencySchema).min(1),
}).refine((c) => c.currencies.some((cur) => cur.code === c.base), {
    message: "Base currency must exist in currencies list",
});

const DEFAULT_CONFIG = {
    base: "USD",
    currencies: [
        { code: "USD", name: "US Dollar", symbol: "$", rate: 1.0, enabled: true },
        { code: "EUR", name: "Euro", symbol: "€", rate: 0.92, enabled: true },
        { code: "TRY", name: "Turkish Lira", symbol: "₺", rate: 32.5, enabled: true },
    ],
};

export async function GET() {
    const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    if (!setting) {
        return NextResponse.json(DEFAULT_CONFIG);
    }
    return NextResponse.json(setting.value);
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid config" }, { status: 400 });
    }

    await prisma.setting.upsert({
        where: { key: SETTING_KEY },
        create: { key: SETTING_KEY, value: parsed.data, module: "currency" },
        update: { value: parsed.data },
    });

    return NextResponse.json(parsed.data);
}
