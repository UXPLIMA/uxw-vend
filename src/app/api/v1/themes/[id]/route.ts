import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import fs from "fs";
import path from "path";

const THEMES_DIR = path.join(process.cwd(), "src/themes");
const PROTECTED_THEMES = ["flat", "retro"];

type RouteParams = { params: Promise<{ id: string }> };

// DELETE /api/v1/themes/[id] - Delete an installed theme
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    if (PROTECTED_THEMES.includes(id)) {
        return NextResponse.json({ error: "Cannot delete built-in themes" }, { status: 400 });
    }

    const themeDir = path.join(THEMES_DIR, id);

    if (!fs.existsSync(themeDir)) {
        return NextResponse.json({ error: "Theme not found" }, { status: 404 });
    }

    // Remove directory recursively
    fs.rmSync(themeDir, { recursive: true, force: true });

    return NextResponse.json({ message: `Theme "${id}" deleted. Run theme generation to update.` });
}
