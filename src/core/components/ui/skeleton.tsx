import { cn } from "@/core/lib/utils";

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

/**
 * A grey block that pulses.
 *
 * Nothing in this product draws one. It drew ten page shaped compositions
 * built out of this - a list, a dashboard, a media grid - and every one of
 * them was a second copy of a layout that nothing kept in step with the
 * first: the list placeholder was eight rows against a twenty row table, and
 * the shop's card image was 176px against 200px. They are gone, and a region
 * waiting for a request says so with `Waiting` instead.
 *
 * This stays because it is published in `@/core/sdk/ui`, and removing a name
 * a module may be written against is a major CORE_API_VERSION bump rather
 * than a tidy up. `a-wait-is-not-a-drawing` is what keeps this product from
 * reaching for it again.
 */
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
