"use client";

import * as React from "react";
import { cn } from "@/core/lib/utils";

/**
 * The one-of-several to `Checkbox`'s any-of-several.
 *
 * Same treatment, for the same reason: the three radios in the panel were
 * bare `<input type="radio">`, painted by the operating system in its own
 * blue, sitting beside a themed checkbox that had just stopped being. Keeping
 * the native input keeps arrow-key navigation within the group, which is
 * behaviour a div cannot be given cheaply and a keyboard user expects.
 *
 * The dot is drawn with a ring rather than a child element, so there is
 * nothing to position and nothing to fall out of alignment.
 */
export type RadioProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size">;

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
    ({ className, ...props }, ref) => (
        <input
            type="radio"
            ref={ref}
            className={cn(
                "h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-full border border-border bg-background",
                "transition-colors duration-150",
                "hover:border-primary/60",
                // A filled centre made out of the ring: the border stays the
                // outer circle and the background becomes the dot.
                "checked:border-primary checked:bg-primary checked:ring-2 checked:ring-inset checked:ring-background",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    ),
);
Radio.displayName = "Radio";

export interface RadioFieldProps extends RadioProps {
    label: React.ReactNode;
    /** A second, quieter line under the label. */
    description?: React.ReactNode;
    /** Class for the wrapping label, not for the control. */
    rowClassName?: string;
}

const RadioField = React.forwardRef<HTMLInputElement, RadioFieldProps>(
    ({ label, description, rowClassName, disabled, ...props }, ref) => (
        <label
            className={cn(
                "flex items-start gap-2.5 text-sm",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                rowClassName,
            )}
        >
            <Radio ref={ref} disabled={disabled} className="mt-0.5" {...props} />
            <span className="min-w-0">
                <span className="block leading-5">{label}</span>
                {description && (
                    <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{description}</span>
                )}
            </span>
        </label>
    ),
);
RadioField.displayName = "RadioField";

export { Radio, RadioField };
