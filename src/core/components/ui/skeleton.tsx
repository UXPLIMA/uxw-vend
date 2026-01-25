"use client";

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
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
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
                <div key={i} className="bg-white rounded-lg border border-gray-100 p-6 flex flex-col items-center">
                    <Skeleton className="w-20 h-20 rounded-lg mb-3" />
                    <Skeleton className="h-5 w-24" />
                </div>
            ))}
        </div>
    );
}

export function SkeletonCategories({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-100 p-6 flex flex-col items-center">
                    <Skeleton className="w-20 h-20 rounded-lg mb-3" />
                    <Skeleton className="h-5 w-24" />
                </div>
            ))}
        </div>
    );
}

export function SkeletonVIPTable() {
    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200 p-4">
                <Skeleton className="w-[180px] h-8" />
                <div className="flex-1 flex justify-around">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <Skeleton className="w-24 h-32 rounded-lg" />
                            <Skeleton className="w-16 h-4" />
                            <Skeleton className="w-20 h-5" />
                            <Skeleton className="w-16 h-8 rounded" />
                        </div>
                    ))}
                </div>
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex border-b border-gray-100 p-3">
                    <Skeleton className="w-[180px] h-5" />
                    <div className="flex-1 flex justify-around">
                        {Array.from({ length: 5 }).map((_, j) => (
                            <Skeleton key={j} className="w-12 h-5" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

export function SkeletonNewsCard() {
    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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

export function SkeletonSidebar() {
    return (
        <div className="space-y-5">
            {/* Discord Widget Skeleton */}
            <Skeleton className="h-[300px] w-full rounded-xl" />

            {/* Featured Product Skeleton */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <Skeleton className="h-5 w-32 mb-4" />
                <div className="flex flex-col items-center">
                    <Skeleton className="w-20 h-20 rounded-lg mb-3" />
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-5 w-16 mb-3" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>

            {/* Payment Goal Skeleton */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <Skeleton className="h-5 w-28 mb-4" />
                <Skeleton className="h-3 w-full rounded-full mb-2" />
                <Skeleton className="h-4 w-32 mx-auto" />
            </div>

            {/* Top Buyers Skeleton */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
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
                <div className="bg-white rounded-lg border border-gray-100 p-6 space-y-4">
                    <Skeleton className="h-7 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="border-t border-gray-100 pt-4 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                    <div className="border-t border-gray-100 pt-4 space-y-2">
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
                <div className="bg-white rounded-lg border border-gray-100 p-6 space-y-4">
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
                    <div className="border-t border-gray-100 pt-4 flex justify-between">
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
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
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
