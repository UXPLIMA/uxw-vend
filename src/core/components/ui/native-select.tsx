"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/core/lib/utils";

/**
 * A `<select>` that looks like the rest of the panel.
 *
 * There is a `Select` next to this one, built out of a button and a popover.
 * It is the right choice when an option needs an icon, a description or a
 * swatch. It is the wrong choice for the forty-odd plain "pick one of these
 * strings" controls in the admin, which were written as a bare `<select>` and
 * therefore rendered in the browser's own chrome: square corners, a hairline
 * black border, a system font, and on the roles screen a red native invalid
 * outline sitting beside a rounded themed input.
 *
 * So this keeps the real element - a native listbox is what a phone, a screen
 * reader and a keyboard all handle best - and only takes its appearance away
 * with `appearance-none`, matching `Input` exactly. The chevron is drawn on
 * top because removing the appearance removes the platform's own arrow.
 *
 * `bg-background` on the element and `bg-background text-foreground` on the
 * options: a dark theme otherwise gets a white dropdown list, because the
 * popup is painted by the operating system and does not inherit.
 */

/**
 * The chevron is positioned against the wrapper, so a width or a margin the
 * caller meant for the control has to land on the wrapper too - left on the
 * `<select>` it would size the element inside a wider box and strand the arrow
 * at the box's edge. Everything else (colour, borders) stays on the element.
 */
const LAYOUT_CLASS = /^-?(?:w|min-w|max-w|m|mt|mb|ml|mr|mx|my|col-span|flex|self)-/;

function splitLayout(className?: string): [string, string] {
    if (!className) return ["", ""];
    const layout: string[] = [];
    const rest: string[] = [];
    for (const token of className.split(/\s+/).filter(Boolean)) {
        (LAYOUT_CLASS.test(token) || token === "flex-1" ? layout : rest).push(token);
    }
    return [layout.join(" "), rest.join(" ")];
}

export interface NativeSelectProps
    extends React.SelectHTMLAttributes<HTMLSelectElement> {
    error?: string;
    /** Renders the compact height used inside toolbars and table rows. */
    inputSize?: "default" | "sm";
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
    ({ className, children, error, inputSize = "default", id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
        const reactId = React.useId();
        const selectId = id || reactId;
        const errorId = error ? `${selectId}-error` : undefined;
        const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;
        const [layoutClass, selectClass] = splitLayout(className);

        return (
            <div className={cn("relative", inputSize === "sm" ? "w-auto" : "w-full", layoutClass)}>
                <select
                    id={selectId}
                    ref={ref}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    className={cn(
                        "appearance-none rounded-lg border border-border bg-background text-foreground",
                        "[&>option]:bg-background [&>option]:text-foreground",
                        "[&>optgroup]:bg-background [&>optgroup]:text-foreground",
                        "text-sm transition-colors duration-200 cursor-pointer",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "w-full",
                        inputSize === "sm" ? "h-9 pl-3 pr-8" : "h-10 pl-4 pr-10",
                        error && "border-destructive focus:ring-destructive/50 focus:border-destructive",
                        selectClass,
                    )}
                    {...props}
                >
                    {children}
                </select>
                <ChevronDown
                    aria-hidden="true"
                    className={cn(
                        "pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
                        inputSize === "sm" ? "right-2.5" : "right-3.5",
                    )}
                />
                {error && (
                    <p id={errorId} className="mt-1.5 text-sm text-destructive">{error}</p>
                )}
            </div>
        );
    },
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
