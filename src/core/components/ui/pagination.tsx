"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonClassName } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Link, usePathname, useRouter } from "@/core/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@/core/lib/utils";
import { pageWindow } from "@/core/lib/page-window";

/**
 * Paging, once, and drawn the same way wherever it appears.
 *
 * Eight admin screens had written their own: two ghost buttons with a chevron
 * each, `disabled={page === 1}`, and a "Page 2 / 9" caption. Nine other lists
 * that grow without bound - roles, API keys, IP blocks, broadcasts - had none
 * at all and rendered every row. And with only a previous and a next button,
 * reaching page 40 of a log takes thirty-nine clicks.
 *
 * So: numbered pages with an ellipsis where the middle is elided, and a box to
 * type a page number into when there are more pages than fit.
 *
 * The shape is the one the homepage news section had, because that is the
 * pager a visitor meets first: a labelled previous and next around the page
 * numbers, centred under what it pages. Eleven screens had drawn their own
 * variation of it - text links, icon-only chevrons, the raw characters « and »
 * - and a reader who learns where "next" is in one place found something else
 * in the next. `a-pager-is-drawn-one-way.test.ts` keeps it to one.
 *
 * Below `sm` the numbers and the labels are too much for the width, so the
 * chevrons stand alone with the page count between them. It is the same
 * control, narrowed, not a second design.
 *
 * Two forms, because the callers come in two kinds. `onPageChange` renders
 * buttons, for a client component holding the page in state. `pageParam`
 * renders links, for a server component that reads the page out of the URL:
 * it names the query parameter, and the links are built here from the live
 * path and search string. It used to be an `hrefFor` callback instead, which
 * a Server Component cannot pass - a function does not survive the boundary,
 * and the users screen threw on every request because of it. Building the
 * href here also keeps whatever else is in the query, which the callback's
 * hand-written `?page=N` was dropping.
 */

interface PaginationBase {
    /** 1-based. */
    page: number;
    /** Total number of pages, at least 1. */
    pages: number;
    /** Total row count, shown under the controls when given. */
    total?: number;
    className?: string;
}

interface PaginationWithHandler extends PaginationBase {
    onPageChange: (page: number) => void;
    pageParam?: never;
}

interface PaginationWithHref extends PaginationBase {
    /** Query parameter carrying the page number, e.g. "page". */
    pageParam: string;
    onPageChange?: never;
}

export type PaginationProps = PaginationWithHandler | PaginationWithHref;

export function usePagedRows<T>(rows: T[], pageSize = 10) {
    const [page, setPage] = React.useState(1);
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const current = Math.min(page, pages);

    React.useEffect(() => {
        // Deleting the last row of the last page must not strand the reader on
        // a page that no longer exists.
        if (page > pages) setPage(pages);
    }, [page, pages]);

    return {
        page: current,
        pages,
        setPage,
        total: rows.length,
        rows: rows.slice((current - 1) * pageSize, current * pageSize),
    };
}

export function Pagination(props: PaginationProps) {
    // `useSearchParams` is only reached by the URL form: a screen that pages
    // through state must not touch it at all. No Suspense boundary around it -
    // every admin route is `force-dynamic`, so there is no prerender to bail
    // out of, and an extra boundary the server has to finish is a boundary
    // that can fail to finish.
    if (props.pageParam) return <UrlPagination {...props} />;
    return <PaginationBar {...props} hrefFor={null} />;
}

function UrlPagination({ pageParam, ...rest }: PaginationWithHref) {
    const pathname = usePathname();
    const search = useSearchParams();

    // Page 1 is the bare address: `?page=1` and no parameter are the same
    // screen, and only one of them should be linkable. Every other parameter
    // - a filter, a search term - rides along.
    const hrefFor = (n: number) => {
        const params = new URLSearchParams(search?.toString() ?? "");
        if (n <= 1) params.delete(pageParam);
        else params.set(pageParam, String(n));
        const query = params.toString();
        return query ? `${pathname}?${query}` : pathname;
    };

    return <PaginationBar {...rest} hrefFor={hrefFor} />;
}

function PaginationBar({
    page,
    pages,
    total,
    className,
    onPageChange,
    hrefFor,
}: PaginationBase & {
    onPageChange?: (page: number) => void;
    hrefFor: ((page: number) => string) | null;
}) {
    const t = useTranslations("common");
    const router = useRouter();
    const [jump, setJump] = React.useState("");

    const clamp = (n: number) => Math.min(Math.max(1, n), pages);
    const go = (n: number) => onPageChange?.(clamp(n));

    const submitJump = (event: React.FormEvent) => {
        event.preventDefault();
        const parsed = Number.parseInt(jump, 10);
        if (!Number.isFinite(parsed)) return;
        const target = clamp(parsed);
        setJump("");
        if (hrefFor) router.push(hrefFor(target));
        else go(target);
    };

    const summary = total === undefined ? null : (
        <p className="text-xs text-muted-foreground">{t("paginationTotal", { total })}</p>
    );

    // One page is not a pager. The count is still worth showing, so the caller
    // gets its line rather than an empty strip.
    if (pages <= 1) {
        if (!summary) return null;
        return <div className={cn("flex justify-center py-3", className)}>{summary}</div>;
    }

    /**
     * Previous and next. The label is what makes the control readable; it is
     * dropped below `sm` because at that width the row has to choose between
     * the label and the page numbers, and the numbers are the thing a chevron
     * cannot replace.
     */
    const step = (target: number, label: string, side: "prev" | "next") => {
        const icon = side === "prev"
            ? <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            : <ChevronRight className="w-4 h-4" aria-hidden="true" />;
        const body = (
            <>
                {side === "prev" && icon}
                <span className="hidden sm:inline">{label}</span>
                {side === "next" && icon}
            </>
        );
        const disabled = side === "prev" ? page === 1 : page === pages;

        if (hrefFor && !disabled) {
            return (
                <Link
                    href={hrefFor(clamp(target))}
                    aria-label={label}
                    className={buttonClassName("outline", "sm")}
                >
                    {body}
                </Link>
            );
        }
        return (
            <Button variant="outline" size="sm" aria-label={label} disabled={disabled} onClick={() => go(target)}>
                {body}
            </Button>
        );
    };

    const numberButton = (n: number) => {
        const current = n === page;
        const shared = {
            "aria-label": t("paginationPageOf", { page: n, pages }),
            "aria-current": current ? ("page" as const) : undefined,
            className: "min-w-9 px-2",
        };
        if (hrefFor && !current) {
            return (
                <Link
                    key={n}
                    href={hrefFor(n)}
                    aria-label={shared["aria-label"]}
                    className={buttonClassName("outline", "sm", shared.className)}
                >
                    {n}
                </Link>
            );
        }
        return (
            <Button
                key={n}
                variant={current ? "default" : "outline"}
                size="sm"
                {...shared}
                onClick={() => go(n)}
            >
                {n}
            </Button>
        );
    };

    return (
        <div className={cn("flex flex-col items-center gap-2 py-4", className)}>
            <div className="flex items-center justify-center gap-2">
                {step(page - 1, t("previousPage"), "prev")}

                <div className="hidden sm:flex items-center gap-2">
                    {pageWindow(page, pages).map((n, i) =>
                        n === null ? (
                            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-sm text-muted-foreground">
                                ...
                            </span>
                        ) : (
                            numberButton(n)
                        ),
                    )}
                </div>

                {/* The numbers do not fit a phone, so the reader is told where
                    they are instead. Hidden from a screen reader on both
                    sides: every number button already names itself. */}
                <span className="sm:hidden px-2 text-sm text-muted-foreground">
                    {t("paginationPageOf", { page, pages })}
                </span>

                {step(page + 1, t("nextPage"), "next")}

                {pages > 7 && (
                    <form onSubmit={submitJump} className="hidden sm:flex items-center gap-1 ml-2">
                        <Input
                            type="number"
                            min={1}
                            max={pages}
                            value={jump}
                            onChange={(e) => setJump(e.target.value)}
                            aria-label={t("paginationGoToPage")}
                            placeholder={String(page)}
                            className="h-9 w-16 px-2 text-center"
                        />
                        <Button type="submit" variant="outline" size="sm" disabled={jump === ""}>
                            {t("paginationGo")}
                        </Button>
                    </form>
                )}
            </div>

            {summary}
        </div>
    );
}
