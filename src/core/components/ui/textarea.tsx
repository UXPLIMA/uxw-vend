"use client";

import * as React from "react";
import { cn } from "@/core/lib/utils";

/**
 * The multi-line `Input`, and it has to look like one.
 *
 * It used to say `border-input`, `ring-ring` and `ring-offset-background`.
 * Two of those name colours the theme does not define - the palette is
 * `--color-border`, `--color-primary` and friends - and Tailwind does not
 * emit a utility for a colour that does not exist. So `border-input`
 * generated no rule at all, the element fell back to the browser's default
 * `border-color: currentColor`, and every textarea on the site was drawn with
 * a near-black outline sitting beside inputs with a pale grey one. That is
 * what "the description box's border is blacker than the others" was.
 *
 * Everything here now matches `Input` exactly: same radius, same padding,
 * same border, same focus ring.
 */
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    "flex min-h-[80px] w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Textarea.displayName = "Textarea";

export { Textarea };
