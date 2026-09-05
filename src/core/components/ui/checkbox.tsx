"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/core/lib/utils";

/**
 * A checkbox that looks like the rest of the panel.
 *
 * There were twenty-nine of them across core and the modules, written as a
 * bare `<input type="checkbox">`, and between them they used ten different
 * class strings: `rounded`, `w-4 h-4`, `w-3 h-3`, `mt-1`, `mt-0.5 h-4 w-4
 * accent-primary`, and five that said nothing at all. So the servers form's
 * boxes were a different size from the roles form's, both were painted by the
 * operating system in the system's own blue rather than the site's colour,
 * and on a dark panel they stayed white with a black hairline.
 *
 * Same approach as `NativeSelect`: keep the real element, because that is
 * what a keyboard, a screen reader and an enclosing `<form>` all understand,
 * and take away only its appearance. The box and the tick are drawn here.
 *
 * `peer` on the input and `peer-checked:` on the mark is what connects the
 * two without JavaScript, so a checkbox inside an uncontrolled form still
 * ticks.
 */

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
    /** Draws the dash used for "some of the children, not all". */
    indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, indeterminate, ...props }, ref) => {
        const inner = React.useRef<HTMLInputElement | null>(null);

        React.useEffect(() => {
            // `indeterminate` is a property, not an attribute: React cannot
            // set it from JSX at all.
            if (inner.current) inner.current.indeterminate = indeterminate === true;
        }, [indeterminate]);

        return (
            <span className={cn("relative inline-flex h-4 w-4 shrink-0 align-middle", className)}>
                <input
                    type="checkbox"
                    ref={(node) => {
                        inner.current = node;
                        if (typeof ref === "function") ref(node);
                        else if (ref) ref.current = node;
                    }}
                    className={cn(
                        "peer h-4 w-4 cursor-pointer appearance-none rounded border border-border bg-background",
                        "transition-colors duration-150",
                        "hover:border-primary/60",
                        "checked:border-primary checked:bg-primary",
                        "indeterminate:border-primary indeterminate:bg-primary",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                    {...props}
                />
                {indeterminate ? (
                    <Minus
                        aria-hidden="true"
                        strokeWidth={3}
                        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-primary-foreground"
                    />
                ) : (
                    <Check
                        aria-hidden="true"
                        strokeWidth={3}
                        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
                    />
                )}
            </span>
        );
    },
);
Checkbox.displayName = "Checkbox";

/**
 * The checkbox with its label, which is how all twenty-nine of them were
 * actually used - and where most of the inconsistency lived, because each
 * caller picked its own gap, its own text size and its own vertical
 * alignment.
 *
 * The whole row is the `<label>`, so the words are a click target too. The
 * box is aligned to the first line rather than centred, so a two-line
 * description does not leave it floating in the middle.
 */
export interface CheckboxFieldProps extends CheckboxProps {
    label: React.ReactNode;
    /** A second, quieter line under the label. */
    description?: React.ReactNode;
    /** Class for the wrapping label, not for the box. */
    rowClassName?: string;
}

const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
    ({ label, description, rowClassName, disabled, ...props }, ref) => (
        <label
            className={cn(
                "flex items-start gap-2.5 text-sm",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                rowClassName,
            )}
        >
            <Checkbox ref={ref} disabled={disabled} className="mt-0.5" {...props} />
            <span className="min-w-0">
                <span className="block leading-5">{label}</span>
                {description && (
                    <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{description}</span>
                )}
            </span>
        </label>
    ),
);
CheckboxField.displayName = "CheckboxField";

export { Checkbox, CheckboxField };
