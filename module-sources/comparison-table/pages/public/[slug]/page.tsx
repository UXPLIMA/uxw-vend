"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageFrame } from "@/core/sdk/layout";
import { Card, CardContent, LoadFailed, buttonClassName } from "@/core/sdk/ui";
import { Link } from "@/core/sdk/navigation";
import { Check, Loader2, Minus, X } from "lucide-react";

/**
 * One comparison, drawn.
 *
 * Three marks, not two. A tick is a claim, a cross is a claim, and a dash is
 * the absence of one - which is what a cell nobody filled in means. The page
 * this replaces drew a cross there, telling a reader that a plan lacked
 * something nobody had said either way.
 */
interface GridCell {
    columnId: string;
    kind: "yes" | "no" | "value" | "unstated";
    value: string | null;
}

interface Comparison {
    slug: string;
    title: string;
    description: string | null;
    columns: { id: string; label: string; subtitle: string | null; href: string | null; highlight: boolean }[];
    groups: { id: string | null; label: string | null; rows: { id: string; label: string; cells: GridCell[] }[] }[];
}

/**
 * A tick, a cross or a dash - and the word behind it.
 *
 * The mark is the whole content of the cell, so somebody reading with a screen
 * reader gets the name or nothing at all. It is translated for the same reason
 * every other string is: a reader in one language should not hear another.
 */
function Mark({ cell, says }: { cell: GridCell; says: (kind: GridCell["kind"]) => string }) {
    if (cell.kind === "value") return <span className="text-sm font-medium">{cell.value}</span>;
    if (cell.kind === "yes") return <Check className="mx-auto h-5 w-5 text-success" aria-label={says("yes")} />;
    if (cell.kind === "no") return <X className="mx-auto h-5 w-5 text-destructive" aria-label={says("no")} />;
    // Neither a tick nor a cross: nobody said.
    return <Minus className="mx-auto h-5 w-5 text-muted-foreground/60" aria-label={says("unstated")} />;
}

export default function ComparisonTablePage() {
    const t = useTranslations("comparisonTable");
    // A module page is served through core's catch-all, so `useParams` hands
    // back the whole path (`["compare", "plans"]`) rather than this route's
    // own `[slug]`. Reading it as a string gave "compare,plans" and every
    // lookup missed - which the page then showed as a failed load.
    const routed = useParams()?.slug;
    const segments = Array.isArray(routed) ? routed : typeof routed === "string" ? routed.split("/") : [];
    const slug = segments[segments.length - 1] ?? "";
    const [table, setTable] = useState<Comparison | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!slug) return;
        let cancelled = false;
        setLoading(true);
        fetch(`/api/v1/comparison-tables?slug=${encodeURIComponent(slug)}`)
            .then((res) => { if (!res.ok) throw new Error("load"); return res.json(); })
            .then((data) => { if (!cancelled) { setTable(data.table ?? null); setFailed(false); } })
            .catch(() => { if (!cancelled) setFailed(true); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [slug, reloadKey]);

    if (loading) {
        return (
            <PageFrame title={t("title")}>
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            </PageFrame>
        );
    }

    if (failed) {
        return (
            <PageFrame title={t("title")}>
                <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
            </PageFrame>
        );
    }

    if (!table) {
        return (
            <PageFrame title={t("title")}>
                <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">{t("notFound")}</p></CardContent></Card>
            </PageFrame>
        );
    }

    return (
        <PageFrame title={table.title} description={table.description ?? undefined}>
            <Card>
                <CardContent className="p-0">
                    {/* Narrow screens: a comparison is wide by nature. */}
                    <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                                    {t("feature")}
                                </th>
                                {table.columns.map((column) => (
                                    <th
                                        key={column.id}
                                        scope="col"
                                        className={`px-4 py-4 text-center ${column.highlight ? "bg-primary/5" : ""}`}
                                    >
                                        <span className="block font-semibold">{column.label}</span>
                                        {column.subtitle && (
                                            <span className="block text-xs text-muted-foreground">{column.subtitle}</span>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        {table.groups.map((group) => (
                            <tbody key={group.id ?? "ungrouped"}>
                                {group.label && (
                                    <tr className="bg-muted/50">
                                        <th
                                            scope="colgroup"
                                            colSpan={table.columns.length + 1}
                                            className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                        >
                                            {group.label}
                                        </th>
                                    </tr>
                                )}
                                {group.rows.map((row) => (
                                    <tr key={row.id} className="border-b border-border/50">
                                        <th scope="row" className="px-6 py-3 text-left text-sm font-normal">{row.label}</th>
                                        {row.cells.map((cell) => (
                                            <td
                                                key={cell.columnId}
                                                className={`px-4 py-3 text-center ${
                                                    table.columns.find((column) => column.id === cell.columnId)?.highlight
                                                        ? "bg-primary/5"
                                                        : ""
                                                }`}
                                            >
                                                <Mark cell={cell} says={(kind) => t(`mark_${kind}`)} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        ))}
                        <tfoot>
                            <tr>
                                <td className="px-6 py-4" />
                                {table.columns.map((column) => (
                                    <td key={column.id} className={`px-4 py-4 text-center ${column.highlight ? "bg-primary/5" : ""}`}>
                                        {column.href && (
                                            <Link href={column.href} className={buttonClassName("default", "sm")}>
                                                {t("choose")}
                                            </Link>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                </CardContent>
            </Card>
            <p className="mt-3 text-xs text-muted-foreground">{t("unstatedNote")}</p>
        </PageFrame>
    );
}
