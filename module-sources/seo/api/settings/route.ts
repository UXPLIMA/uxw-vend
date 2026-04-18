import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { z } from "zod";

const SEO_KEYS = [
    "seo_default_title",
    "seo_title_template",
    "seo_default_description",
    "seo_default_og_image",
    "seo_google_verification",
    "seo_bing_verification",
] as const;

export async function GET() {
    try {
        const settings = await prisma.setting.findMany({
            where: { key: { in: [...SEO_KEYS] } },
        });

        const result: Record<string, string> = {};
        for (const s of settings) {
            result[s.key] = s.value as string;
        }

        return NextResponse.json({ settings: result });
    } catch {
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const body = await request.json();

        const schema = z.object({
            seo_default_title: z.string().max(200).optional(),
            seo_title_template: z.string().max(200).optional(),
            seo_default_description: z.string().max(500).optional(),
            seo_default_og_image: z.string().max(2000).optional(),
            seo_google_verification: z.string().max(200).optional(),
            seo_bing_verification: z.string().max(200).optional(),
        });

        const validation = schema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
        }

        const data = validation.data;

        for (const key of SEO_KEYS) {
            const value = data[key];
            if (value !== undefined) {
                await prisma.setting.upsert({
                    where: { key },
                    update: { value: value as string, module: "seo" },
                    create: { key, value: value as string, module: "seo" },
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
