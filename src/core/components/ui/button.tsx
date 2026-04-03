import * as React from "react";
import { cn } from "@/core/lib/utils";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        return (
            <button
                className={cn(
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]",
                    {
                        "bg-primary text-black hover:brightness-110 shadow-[0_0_20px_rgba(0,212,255,0.2)] hover:shadow-[0_0_30px_rgba(0,212,255,0.35)]":
                            variant === "default",
                        "bg-destructive text-white hover:brightness-110 shadow-[0_0_20px_rgba(255,71,87,0.2)]":
                            variant === "destructive",
                        "border border-[var(--color-border)] bg-transparent hover:bg-white/5 hover:border-primary/40 text-foreground":
                            variant === "outline",
                        "bg-secondary text-white hover:brightness-110 shadow-[0_0_20px_rgba(124,58,237,0.2)]":
                            variant === "secondary",
                        "hover:bg-white/5 text-muted-foreground hover:text-foreground": variant === "ghost",
                        "text-primary underline-offset-4 hover:underline": variant === "link",
                        "h-10 px-5 py-2": size === "default",
                        "h-8 rounded-md px-3 text-xs": size === "sm",
                        "h-12 rounded-lg px-8 text-base": size === "lg",
                        "h-10 w-10": size === "icon",
                    },
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button };
