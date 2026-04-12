import * as React from "react";
import { cn } from "@/core/lib/utils";

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
        const reactId = React.useId();
        const inputId = id || reactId;
        const errorId = error ? `${inputId}-error` : undefined;
        const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;
        return (
            <div className="w-full">
                <input
                    id={inputId}
                    type={type}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    className={cn(
                        "flex h-11 w-full rounded-lg border border-border bg-background pl-4 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        error && "border-destructive focus:ring-destructive/50 focus:border-destructive",
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {error && (
                    <p id={errorId} className="mt-1.5 text-sm text-destructive">{error}</p>
                )}
            </div>
        );
    }
);
Input.displayName = "Input";

export { Input };
