import { cn } from "@/core/lib/utils";

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-muted",
                className
            )}
            style={style}
        />
    );
}

// Pre-built skeleton components for common use cases

export function SkeletonCard() {
    return (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
            <Skeleton className="h-44 w-full rounded-none" />
            <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
            </div>
        </div>
    );
}

export function SkeletonSidebar() {
    return (
        <div className="space-y-5">
            {/* Generic widget skeleton */}
            <div className="bg-card rounded-xl border border-border p-5">
                <Skeleton className="h-5 w-32 mb-4" />
                <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>

            {/* Generic card skeleton */}
            <div className="bg-card rounded-xl border border-border p-5">
                <Skeleton className="h-5 w-28 mb-4" />
                <div className="flex flex-col items-center">
                    <Skeleton className="w-20 h-20 rounded-lg mb-3" />
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-5 w-16 mb-3" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>

            {/* Generic list skeleton */}
            <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex justify-between mb-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 mb-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-12" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SkeletonHeroBanner() {
    return (
        <div className="relative h-[280px] overflow-hidden bg-muted animate-pulse">
            <div className="relative container mx-auto px-4 h-full">
                <div className="flex items-center justify-between h-full">
                    {/* Left */}
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-11 h-11 rounded-full" />
                        <div className="space-y-1">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                    </div>

                    {/* Center */}
                    <Skeleton className="w-28 h-28 rounded-full" />

                    {/* Right */}
                    <div className="flex items-center gap-3">
                        <div className="space-y-1 text-right">
                            <Skeleton className="h-3 w-24 ml-auto" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                        <Skeleton className="w-11 h-11 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Admin page skeleton patterns
// ---------------------------------------------------------------------------

/** Dashboard: KPI row + panel row */
export function SkeletonDashboard() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-9 w-28 rounded-md" />
            </div>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-lg border border-border p-4">
                        <Skeleton className="h-3 w-20 mb-2" />
                        <Skeleton className="h-7 w-16" />
                    </div>
                ))}
            </div>
            {/* Panel row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-lg border border-border p-4">
                        <Skeleton className="h-4 w-32 mb-4" />
                        {Array.from({ length: 4 }).map((_, j) => (
                            <div key={j} className="flex items-center gap-3 mb-3">
                                <Skeleton className="w-8 h-8 rounded-full" />
                                <div className="flex-1">
                                    <Skeleton className="h-3 w-3/4 mb-1" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Generic list page: title + stats row + table */
export function SkeletonListPage({ columns = 5, rows = 8 }: { columns?: number; rows?: number } = {}) {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-28 rounded-md" />
            </div>
            {/* Table */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
                {/* Header row */}
                <div className="flex gap-4 px-4 py-3 border-b border-border bg-muted/40">
                    {Array.from({ length: columns }).map((_, i) => (
                        <Skeleton key={i} className="h-3 flex-1" style={{ maxWidth: i === 0 ? "30%" : "15%" }} />
                    ))}
                </div>
                {/* Data rows */}
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
                        {Array.from({ length: columns }).map((_, j) => (
                            <Skeleton key={j} className="h-4 flex-1" style={{ maxWidth: j === 0 ? "30%" : "15%" }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Settings page: title + card grid */
export function SkeletonSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-6 w-44 mb-2" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-lg border border-border p-6 space-y-4">
                        <Skeleton className="h-5 w-36 mb-4" />
                        {Array.from({ length: 3 }).map((_, j) => (
                            <div key={j}>
                                <Skeleton className="h-3 w-24 mb-2" />
                                <Skeleton className="h-9 w-full rounded-md" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Stats page with KPI cards + chart grid */
export function SkeletonStatsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-6 w-36 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-48 rounded-md" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-lg border border-border p-4">
                        <Skeleton className="h-3 w-16 mb-2" />
                        <Skeleton className="h-7 w-12" />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-lg border border-border p-4">
                        <div className="flex justify-between mb-4">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-5 w-16" />
                        </div>
                        <Skeleton className="h-48 w-full rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Simple detail/form page */
export function SkeletonDetailPage() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-80" />
            </div>
            <div className="bg-card rounded-lg border border-border p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i}>
                        <Skeleton className="h-3 w-28 mb-2" />
                        <Skeleton className="h-9 w-full rounded-md" />
                    </div>
                ))}
                <Skeleton className="h-9 w-24 rounded-md mt-4" />
            </div>
        </div>
    );
}

/** Media grid page */
export function SkeletonMediaPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-6 w-40 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-9 w-24 rounded-md" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-9 flex-1 rounded-md" />
                <Skeleton className="h-9 w-24 rounded-md" />
                <Skeleton className="h-9 w-32 rounded-md" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
            </div>
        </div>
    );
}

export function SkeletonNavbar() {
    return (
        <header className="bg-card border-b border-border sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-9 w-20" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                </div>
            </div>
        </header>
    );
}
