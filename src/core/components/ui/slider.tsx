"use client";

import * as React from "react";
import { cn } from "@/core/lib/utils";

/**
 * A range input in the site's colour.
 *
 * There were two of these, both bare, so both were drawn in whatever blue the
 * operating system uses for form controls - next to buttons and checkboxes
 * painted in the theme's own primary. `accent-color` is the one property that
 * recolours a native range's track and thumb in every current browser without
 * rebuilding the control out of divs, which is worth keeping: a real range
 * input is draggable, focusable, and answers to the arrow keys already.
 */
export type SliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, ...props }, ref) => (
        <input
            type="range"
            ref={ref}
            className={cn(
                "h-8 w-full cursor-pointer accent-primary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded",
                "disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    ),
);
Slider.displayName = "Slider";

export { Slider };
