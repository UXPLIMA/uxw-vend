"use client";

import { Skeleton } from "@/core/sdk/ui";

/**
 * Drawn to the measurements of the card it stands in for: an `h-44` cover
 * over a date, a two line headline and a two line summary. A placeholder that
 * is a different size from its answer is a layout shift waiting to happen.
 */
export function SkeletonNewsCard() {
    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Skeleton className="h-44 w-full rounded-none" />
            <div className="p-4">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-12 w-3/4 mb-1" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    );
}

export function SkeletonNewsGrid({ count = 4 }: { count?: number }) {
    return (
        <div className="grid md:grid-cols-2 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonNewsCard key={i} />
            ))}
        </div>
    );
}
