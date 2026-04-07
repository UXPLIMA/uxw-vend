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
