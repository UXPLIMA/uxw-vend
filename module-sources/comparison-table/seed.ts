import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * The table a shop puts next to its ranks.
 *
 * Three columns, two groups of rows, and a mix of every cell kind the module
 * draws - because the one thing this screen has to get right is the difference
 * between "no" and "nobody said". A demo where every cell is a tick or a cross
 * shows nothing of that, and the unstated cell is the one that was wrong here
 * before anybody noticed.
 */
const COLUMNS: { label: string; subtitle: string; highlight?: true }[] = [
    { label: "Free", subtitle: "Everyone who joins" },
    { label: "VIP", subtitle: "A few a month", highlight: true },
    { label: "Gold", subtitle: "The long-haul one" },
];

/** `null` is the unstated cell: nobody has answered for that pair yet. */
type Cell = { kind: "yes" | "no" | "value" | "unstated"; value?: string };
const YES: Cell = { kind: "yes" };
const NO: Cell = { kind: "no" };
const UNSTATED: Cell = { kind: "unstated" };
const value = (v: string): Cell => ({ kind: "value", value: v });

const GROUPS: { label: string; rows: { label: string; cells: [Cell, Cell, Cell] }[] }[] = [
    {
        label: "On the server",
        rows: [
            { label: "Homes you can set", cells: [value("1"), value("5"), value("15")] },
            { label: "Queue priority", cells: [NO, YES, YES] },
            { label: "Coloured name in chat", cells: [NO, YES, YES] },
            { label: "Fly in the lobby", cells: [NO, NO, YES] },
        ],
    },
    {
        label: "On the site",
        rows: [
            { label: "Forum signature", cells: [NO, YES, YES] },
            { label: "Badge beside your name", cells: [NO, YES, YES] },
            { label: "Early access to events", cells: [NO, UNSTATED, YES] },
            { label: "Support reply time", cells: [value("When we can"), value("2 days"), value("Same day")] },
        ],
    },
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        const slug = "ranks";
        const existing = await ctx.prisma.comparisonTable.findFirst({ where: { slug } });
        if (existing) { ctx.log("already there"); return; }

        const table = await ctx.create("comparisonTable", () => ctx.prisma.comparisonTable.create({
            data: {
                slug,
                title: "What each rank gets you",
                description: "Everything below is per account, not per character.",
                createdAt: ctx.daysAgo(200),
            },
        }));

        const columns: { id: string }[] = [];
        for (const [order, column] of COLUMNS.entries()) {
            columns.push(await ctx.create("comparisonColumn", () => ctx.prisma.comparisonColumn.create({
                data: {
                    tableId: table.id,
                    label: column.label,
                    subtitle: column.subtitle,
                    highlight: column.highlight === true,
                    order,
                },
            })));
        }

        let rowOrder = 0;
        for (const [groupOrder, group] of GROUPS.entries()) {
            const created = await ctx.create("comparisonGroup", () => ctx.prisma.comparisonGroup.create({
                data: { tableId: table.id, label: group.label, order: groupOrder },
            }));

            for (const row of group.rows) {
                const createdRow = await ctx.create("comparisonRow", () => ctx.prisma.comparisonRow.create({
                    data: { tableId: table.id, groupId: created.id, label: row.label, order: rowOrder++ },
                }));

                for (const [index, cell] of row.cells.entries()) {
                    // An unstated cell is stored, not skipped. A missing row is
                    // how "nobody said" and "no" became the same thing once.
                    await ctx.create("comparisonCell", () => ctx.prisma.comparisonCell.create({
                        data: {
                            rowId: createdRow.id,
                            columnId: columns[index].id,
                            kind: cell.kind,
                            value: cell.value ?? null,
                        },
                    }));
                }
            }
        }
        ctx.log(`1 table, ${COLUMNS.length} columns, ${GROUPS.reduce((n, g) => n + g.rows.length, 0)} rows`);
    },
};
