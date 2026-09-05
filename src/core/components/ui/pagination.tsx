"use client";

import * as React from "react";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonClassName } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Link, usePathname, useRouter } from "@/core/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@/core/lib/utils";
import { pageWindow } from "@/core/lib/page-window";

/**
 * Paging, once.
 *
 * Eight admin screens had written their own: two ghost buttons with a chevron
 * each, `disabled={page === 1}`, and a "Page 2 / 9" caption. Nine other lists
 * that grow without bound - roles, API keys, IP blocks, broadcasts - had none
 * at all and rendered every row. And with only a previous and a next button,
 * reaching page 40 of a log takes thirty-nine clicks.
 *
 * So: numbered pages with an ellipsis where the middle is elided, first and
 * last, and a box to type a page number into when there are more pages than
 * fit.
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
    /** Total row count, shown in the summary when given. */
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
    // `useSearchParams` is only reached by the URL form, and only inside its
    // own Suspense boundary: a page that pages through state must not be
    // pushed into client-side rendering by a hook it never uses.
    if (props.pageParam) {
        return (
            <React.Suspense fallback={null}>
                <UrlPagination {...props} />
            </React.Suspense>
        );
    }
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

    // One page is not a pager. The summary is still worth showing, so the
    // caller keeps its own count line rather than getting an empty strip.
    if (pages <= 1) {
        if (total === undefined) return null;
        return (
            <div className={cn("flex items-center justify-between gap-3 p-3 border-t border-border", className)}>
                <span className="text-xs text-muted-foreground">{t("paginationTotal", { total })}</span>
            </div>
        );
    }

    const step = (target: number, label: string, icon: React.ReactNode, disabled: boolean) => {
        if (hrefFor && !disabled) {
            return (
                <Link
                    href={hrefFor(clamp(target))}
                    aria-label={label}
                    className={buttonClassName("outline", "sm")}
                >
                    {icon}
                </Link>
            );
        }
        return (
            <Button
                variant="outline"
                size="sm"
                aria-label={label}
                disabled={disabled}
                onClick={() => go(target)}
            >
                {icon}
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
        <div className={cn("flex flex-wrap items-center justify-between gap-3 p-3 border-t border-border", className)}>
            <span className="text-xs text-muted-foreground">
                {total !== undefined && `${t("paginationTotal", { total })} · `}
                {t("paginationPageOf", { page, pages })}
            </span>

            <div className="flex items-center gap-1">
                {step(1, t("paginationFirstPage"), <ChevronsLeft className="w-3.5 h-3.5" />, page === 1)}
                {step(page - 1, t("previousPage"), <ChevronLeft className="w-3.5 h-3.5" />, page === 1)}

                <div className="hidden sm:flex items-center gap-1">
                    {pageWindow(page, pages).map((n, i) =>
                        n === null ? (
                            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-xs text-muted-foreground">
                                ...
                            </span>
                        ) : (
                            numberButton(n)
                        ),
                    )}
                </div>

                {step(page + 1, t("nextPage"), <ChevronRight className="w-3.5 h-3.5" />, page === pages)}
                {step(pages, t("paginationLastPage"), <ChevronsRight className="w-3.5 h-3.5" />, page === pages)}

                {pages > 7 && (
                    <form onSubmit={submitJump} className="flex items-center gap-1 ml-2">
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
        </div>
    );
}
