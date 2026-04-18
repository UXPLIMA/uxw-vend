"use client";

import { Skeleton } from "@/core/components/ui/skeleton";

export function SkeletonNewsCard() {
    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Skeleton className="h-48 w-full rounded-none" />
            <div className="p-4 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
            </div>
        </div>
    );
}

export function SkeletonNewsGrid({ count = 4 }: { count?: number }) {
    return (
        <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonNewsCard key={i} />
            ))}
        </div>
    );
}
