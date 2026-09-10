import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, prisma, readJsonBody, settingsForStorage, withoutSecrets } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";

const SETTING_KEY = "cloudflare_turnstile_config";

const configSchema = z.object({
    siteKey: z.string().max(200).default(""),
    // Empty is "leave the stored one alone". The screen never receives the
    // secret key, so an empty field means untouched, not cleared - otherwise
    // toggling "require on login" would silently switch the widget off by
    // wiping the key it verifies with.
    secretKey: z.string().max(200).default(""),
    enableOnLogin: z.boolean().default(false),
    enableOnRegister: z.boolean().default(false),
});

/** The sealed secret key exactly as stored, for a save that is not changing it. */
async function storedSecretKey(): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const value = row?.value;
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const stored = (value as Record<string, unknown>).secretKey;
    return typeof stored === "string" ? stored : "";
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const { settings, secretsConfigured } = withoutSecrets({ [SETTING_KEY]: setting?.value ?? null });
    const config = settings[SETTING_KEY] || { siteKey: "", enableOnLogin: false, enableOnRegister: false };
    return NextResponse.json({ ...(config as object), secretsConfigured });
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(session.user.id, session.user.role))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await readJsonBody(request, { fallback: null });
    if (body instanceof NextResponse) return body;
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid config" }, { status: 400 });
    }

    const kept = parsed.data.secretKey === "" ? await storedSecretKey() : parsed.data.secretKey;
    const value = settingsForStorage({
        [SETTING_KEY]: { ...parsed.data, secretKey: kept },
    })[SETTING_KEY];

    await prisma.setting.upsert({
        where: { key: SETTING_KEY },
        create: { key: SETTING_KEY, value: value as object, module: "cloudflare-turnstile" },
        update: { value: value as object },
    });

    return NextResponse.json({ ok: true });
}
