import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";
import { prisma } from "@/core/lib/db";
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";

const MODULES_DIR = path.join(process.cwd(), "src/modules");

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: moduleId } = await params;

    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 2. Check if module directory exists
    const moduleDir = path.join(MODULES_DIR, moduleId);
    const exists = await fs.access(moduleDir).then(() => true).catch(() => false);
    if (!exists) {
        return NextResponse.json({ error: "Module not found on disk" }, { status: 404 });
    }

    try {
        // 4. Remove module directory
        await fs.rm(moduleDir, { recursive: true, force: true });

        // 5. Regenerate registry + rebuild
        try {
            execFileSync("npx", ["tsx", "scripts/generate-registry.ts"], { cwd: process.cwd(), timeout: 30000, stdio: "pipe" });
            if (process.env.NODE_ENV === "production") {
                execFileSync("npm", ["run", "build"], { cwd: process.cwd(), timeout: 120000, stdio: "pipe" });
            }
        } catch {
            // Registry/build failed but module is already removed
        }

        // 6. Remove DB record
        await prisma.moduleConfig.deleteMany({
            where: { id: moduleId },
        });

        return NextResponse.json({ message: "Module deleted successfully" });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: "Delete failed: " + message }, { status: 500 });
    }
}
