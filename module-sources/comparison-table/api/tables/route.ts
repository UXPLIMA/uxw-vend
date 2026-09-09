import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/sdk/server";
import { buildGrid } from "../../lib/grid";

/**
 * GET /api/v1/comparison-tables?slug=... - one table, ready to draw.
 *
 * The whole table in one answer: a reader comparing five plans across twenty
 * features should not cost a hundred requests. Public and the same for
 * everybody, so it may be kept for a minute.
 */
export async function GET(request: NextRequest) {
    const slug = request.nextUrl.searchParams.get("slug");

    if (!slug) {
        const tables = await prisma.comparisonTable.findMany({
            where: { isActive: true },
            orderBy: [{ order: "asc" }, { title: "asc" }],
            select: { slug: true, title: true, description: true },
            take: 50,
        });
        return NextResponse.json({ tables }, { headers: { "Cache-Control": "public, max-age=60" } });
    }

    const table = await prisma.comparisonTable.findFirst({
        where: { slug, isActive: true },
        include: {
            columns: { orderBy: { order: "asc" } },
            groups: { orderBy: { order: "asc" } },
            rows: { orderBy: { order: "asc" }, include: { cells: true } },
        },
    });
    if (!table) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const grid = buildGrid(
        table.columns.map((column) => ({ id: column.id, label: column.label, order: column.order })),
        table.groups.map((group) => ({ id: group.id, label: group.label, order: group.order })),
        table.rows.map((row) => ({ id: row.id, groupId: row.groupId, label: row.label, order: row.order })),
        table.rows.flatMap((row) =>
            row.cells.map((cell) => ({
                rowId: cell.rowId,
                columnId: cell.columnId,
                kind: cell.kind as "yes" | "no" | "value",
                value: cell.value,
            })),
        ),
    );

    return NextResponse.json(
        {
            table: {
                slug: table.slug,
                title: table.title,
                description: table.description,
                columns: table.columns.map((column) => ({
                    id: column.id,
                    label: column.label,
                    subtitle: column.subtitle,
                    href: column.href,
                    highlight: column.highlight,
                })),
                groups: grid.groups,
            },
        },
        { headers: { "Cache-Control": "public, max-age=60" } },
    );
}
