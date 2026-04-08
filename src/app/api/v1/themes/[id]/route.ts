import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import fs from "fs";
import path from "path";
import { logActivity } from "@/core/lib/activity-log";

const THEMES_DIR = path.join(process.cwd(), "src/themes");
const PROTECTED_THEMES = ["flat"];

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;

    // Security: validate ID format (only alphanumeric + hyphens)
    if (!/^[a-z0-9-]+$/.test(id)) {
        return NextResponse.json({ error: "Invalid theme ID" }, { status: 400 });
    }

    if (PROTECTED_THEMES.includes(id)) {
        return NextResponse.json({ error: "Cannot delete built-in themes" }, { status: 400 });
    }

    const themeDir = path.resolve(THEMES_DIR, id);

    // Security: ensure resolved path is within THEMES_DIR
    if (!themeDir.startsWith(path.resolve(THEMES_DIR) + path.sep)) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (!fs.existsSync(themeDir)) {
        return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    fs.rmSync(themeDir, { recursive: true, force: true });

    logActivity({
        userId: session.user.id,
        action: "theme.uninstall",
        entity: "theme",
        entityId: id,
    }).catch(() => {});

    return NextResponse.json({ message: `Theme "${id}" deleted.` });
}
