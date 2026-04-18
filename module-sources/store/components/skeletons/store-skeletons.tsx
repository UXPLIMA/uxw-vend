"use client";

import { Skeleton } from "@/core/components/ui/skeleton";

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

export function SkeletonProductDetail() {
    return (
        <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Side - Image & Description */}
            <div className="lg:col-span-2 space-y-6">
                {/* Image Carousel Skeleton */}
                <Skeleton className="w-full rounded-lg" style={{ aspectRatio: '16/9' }} />

                {/* Thumbnail Strip */}
                <div className="flex gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="w-20 h-14 rounded-lg" />
                    ))}
                </div>

                {/* Product Info */}
                <div className="bg-card rounded-lg border border-border p-6 space-y-4">
                    <Skeleton className="h-7 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="border-t border-border pt-4 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                    <div className="border-t border-border pt-4 space-y-2">
                        <Skeleton className="h-5 w-24" />
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Skeleton className="w-4 h-4 rounded-full" />
                                <Skeleton className="h-4 w-40" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side - Payment Box */}
            <div className="lg:col-span-1">
                <div className="bg-card rounded-lg border border-border p-6 space-y-4">
                    <Skeleton className="h-8 w-24" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-2 h-2 rounded-full" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <Skeleton className="w-12 h-6" />
                            <Skeleton className="w-10 h-10 rounded-lg" />
                        </div>
                    </div>
                    <div className="border-t border-border pt-4 flex justify-between">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-6 w-20" />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-10 flex-1 rounded" />
                        <Skeleton className="h-10 flex-1 rounded" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SkeletonCategories() {
    return (
        <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
        </div>
    );
}
