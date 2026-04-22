import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";
import { prisma } from "@/core/lib/db";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";

const THEMES_DIR = path.join(process.cwd(), "src/themes");
const PROTECTED_THEMES = ["flat"];

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Security: validate ID format (only alphanumeric + hyphens)
    if (!/^[a-z0-9-]+$/.test(id)) {
        return NextResponse.json({ error: "Invalid theme ID" }, { status: 400 });
    }

    if (PROTECTED_THEMES.includes(id)) {
        return NextResponse.json({ error: "Cannot delete built-in themes" }, { status: 400 });
    }

    const state = await prisma.themeState.findFirst();
    if (state?.themeId === id) {
        return NextResponse.json({ error: "Cannot delete the active theme — switch first." }, { status: 409 });
    }

    const themeDir = path.resolve(THEMES_DIR, id);

    // Security: ensure resolved path is within THEMES_DIR
    if (!themeDir.startsWith(path.resolve(THEMES_DIR) + path.sep)) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    await prisma.$transaction([
        prisma.themeCustomization.deleteMany({ where: { themeId: id } }),
        prisma.themeSetting.deleteMany({ where: { themeId: id } }),
    ]);
    await fs.rm(themeDir, { recursive: true, force: true });

    try {
        execFileSync("npx", ["tsx", "scripts/generate-theme-registry.ts"], { timeout: 30000, stdio: "pipe" });
    } catch (err) {
        return NextResponse.json({ error: `Registry regen failed: ${(err as Error).message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
