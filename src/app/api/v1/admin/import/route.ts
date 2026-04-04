import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { generateSlug } from "@/core/lib/utils";

// POST /api/v1/admin/import?type=products
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin(session.user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const type = request.nextUrl.searchParams.get("type") || "products";
    const text = await request.text();
    const lines = text.split("\n").filter((l) => l.trim());

    if (lines.length < 2) return NextResponse.json({ error: "CSV must have header + at least 1 row" }, { status: 400 });

    const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
    let imported = 0;

    switch (type) {
        case "products": {
            try {
                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    const row: Record<string, string> = {};
                    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

                    const name = row.name;
                    if (!name) continue;

                    const slug = row.slug || generateSlug(name);
                    const existing = await prisma.product.findUnique({ where: { slug } });
                    if (existing) continue;

                    await prisma.product.create({
                        data: {
                            name,
                            slug,
                            price: parseFloat(row.price) || 0,
                            comparePrice: row.comparePrice ? parseFloat(row.comparePrice) : null,
                            stock: row.stock ? parseInt(row.stock) : null,
                            isActive: row.isActive !== "false",
                            isFeatured: row.isFeatured === "true",
                            type: (row.type as any) || "DIGITAL",
                            description: row.description || null,
                        },
                    });
                    imported++;
                }
            } catch {
                return NextResponse.json({ error: "No data available" }, { status: 400 });
            }
            break;
        }
        default:
            return NextResponse.json({ error: "Only product import is supported currently" }, { status: 400 });
    }

    return NextResponse.json({ message: `Imported ${imported} items`, imported });
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
        current += char;
    }
    result.push(current.trim());
    return result;
}
