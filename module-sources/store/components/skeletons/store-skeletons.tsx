"use client";

import { Skeleton } from "@/core/sdk/ui";

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

export function SkeletonProductGrid({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

export function SkeletonServerModes() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card rounded-lg border border-border p-6 flex flex-col items-center">
                    <Skeleton className="w-20 h-20 rounded-lg mb-3" />
                    <Skeleton className="h-5 w-24" />
                </div>
            ))}
        </div>
    );
}
