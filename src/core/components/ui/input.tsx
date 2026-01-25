import * as React from "react";
import { cn } from "@/core/lib/utils";

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, ...props }, ref) => {
        return (
            <div className="w-full">
                <input
                    type={type}
                    className={cn(
                        "flex h-11 w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        error && "border-destructive focus:ring-destructive/50 focus:border-destructive",
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {error && (
                    <p className="mt-1.5 text-sm text-destructive">{error}</p>
                )}
            </div>
        );
    }
);
Input.displayName = "Input";

export { Input };
