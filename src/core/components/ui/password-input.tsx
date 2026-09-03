"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "./input";
import { cn } from "@/core/lib/utils";

export interface PasswordInputProps extends Omit<InputProps, "type"> {
    /** Accessible label for the toggle while the password is hidden. */
    showLabel?: string;
    /** Accessible label for the toggle while the password is visible. */
    hideLabel?: string;
}

/**
 * A password field with a reveal toggle.
 *
 * Typing a password you cannot see is how people end up locked out of an
 * account whose password they know, so every password field in core uses this
 * rather than a bare `<Input type="password">`. The toggle is a real button
 * and keeps its place in the tab order; screen readers get the state from
 * `aria-pressed`.
 *
 * The button is pinned to the middle of the 44px input rather than the middle
 * of the wrapper, so it stays put when `Input` renders an error message
 * underneath.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
    ({ className, showLabel = "Show password", hideLabel = "Hide password", ...props }, ref) => {
        const [visible, setVisible] = React.useState(false);
        const Icon = visible ? EyeOff : Eye;
        return (
            <div className="relative">
                <Input
                    ref={ref}
                    type={visible ? "text" : "password"}
                    className={cn("pr-11", className)}
                    {...props}
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? hideLabel : showLabel}
                    aria-pressed={visible}
                    disabled={props.disabled}
                    className="absolute right-3 top-[22px] -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>
        );
    },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
