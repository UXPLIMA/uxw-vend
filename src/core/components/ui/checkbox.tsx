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
            // The fade for a disabled box belongs on the wrapper, not on the
            // input: the tick is drawn as a sibling, so dimming only the input
            // left a full-strength tick floating on a washed-out box.
            <span className={cn("relative inline-flex h-[18px] w-[18px] shrink-0 align-middle has-[:disabled]:opacity-50", className)}>
                <input
                    type="checkbox"
                    ref={(node) => {
                        inner.current = node;
                        if (typeof ref === "function") ref(node);
                        else if (ref) ref.current = node;
                    }}
                    className={cn(
                        // 18px rather than 16: the label beside it is 14px, and
                        // a box smaller than the text it belongs to reads as an
                        // afterthought. `uxw-checkbox-radius`, not `rounded`,
                        // because the site-wide radius is written for buttons
                        // and drew this one as a circle - the radio's shape.
                        "peer h-[18px] w-[18px] cursor-pointer appearance-none uxw-checkbox-radius",
                        "border border-border bg-background",
                        "transition-colors duration-150",
                        "hover:border-primary/70",
                        "checked:border-primary checked:bg-primary",
                        "indeterminate:border-primary indeterminate:bg-primary",
                        // Offset so the ring sits around the box rather than on
                        // its edge, where it looked like a second border.
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "disabled:cursor-not-allowed",
                    )}
                    {...props}
                />
                {/*
                  * The mark is 12px inside an 18px box, which leaves it room to
                  * be a tick rather than a glyph wedged corner to corner - the
                  * shape that made a checked box read as a solid block with
                  * something wrong in it. Stroke 2.5 for the same reason.
                  */}
                {indeterminate ? (
                    <Minus
                        aria-hidden="true"
                        strokeWidth={2.5}
                        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-primary-foreground"
                    />
                ) : (
                    <Check
                        aria-hidden="true"
                        strokeWidth={2.5}
                        className={cn(
                            "pointer-events-none absolute inset-0 m-auto h-3 w-3 text-primary-foreground",
                            // Grows into place instead of appearing: the same
                            // 150ms the box takes to fill.
                            "scale-75 opacity-0 transition duration-150",
                            "peer-checked:scale-100 peer-checked:opacity-100",
                        )}
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
                disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
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
