"use client";

import * as React from "react";
import { cn } from "@/core/lib/utils";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
    ({ className, ...props }, ref) => {
        return (
            <label
                ref={ref}
                className={cn(
                    // A label sat flush against its control everywhere in the
                    // panel, because every caller wrapped the pair in a bare
                    // `<div>` and none of them added a gap. The margin belongs
                    // here, once, where `cn` still lets a caller drop it.
                    "mb-1.5 block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                    className
                )}
                {...props}
            />
        );
    }
);
Label.displayName = "Label";

export { Label };
