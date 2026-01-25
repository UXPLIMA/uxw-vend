"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/core/lib/utils";

interface SelectContextValue {
    value: string;
    onValueChange: (value: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
    const context = React.useContext(SelectContext);
    if (!context) {
        throw new Error("Select components must be used within a Select");
    }
    return context;
}

interface SelectProps {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
}

function Select({ value = "", onValueChange, children }: SelectProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <SelectContext.Provider
            value={{
                value,
                onValueChange: onValueChange || (() => { }),
                open,
                setOpen,
            }}
        >
            <div className="relative">{children}</div>
        </SelectContext.Provider>
    );
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
    children?: React.ReactNode;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
    ({ className, children, ...props }, ref) => {
        const { open, setOpen } = useSelectContext();

        return (
            <button
                ref={ref}
                type="button"
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                onClick={() => setOpen(!open)}
                {...props}
            >
                {children}
                <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", open && "rotate-180")} />
            </button>
        );
    }
);
SelectTrigger.displayName = "SelectTrigger";

interface SelectValueProps {
    placeholder?: string;
}

function SelectValue({ placeholder }: SelectValueProps) {
    const { value } = useSelectContext();

    return (
        <span className={cn(!value && "text-muted-foreground")}>
            {value || placeholder}
        </span>
    );
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
    ({ className, children, ...props }, ref) => {
        const { open, setOpen } = useSelectContext();

        React.useEffect(() => {
            const handleClickOutside = (e: MouseEvent) => {
                if (open && !(e.target as Element).closest("[data-select-content]")) {
                    setOpen(false);
                }
            };
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, [open, setOpen]);

        if (!open) return null;

        return (
            <div
                ref={ref}
                data-select-content
                className={cn(
                    "absolute z-50 min-w-[8rem] w-full mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
                    className
                )}
                {...props}
            >
                <div className="p-1">{children}</div>
            </div>
        );
    }
);
SelectContent.displayName = "SelectContent";

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string;
    children?: React.ReactNode;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
    ({ className, value, children, ...props }, ref) => {
        const { value: selectedValue, onValueChange, setOpen } = useSelectContext();
        const isSelected = selectedValue === value;

        return (
            <div
                ref={ref}
                className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent text-accent-foreground",
                    className
                )}
                onClick={() => {
                    onValueChange(value);
                    setOpen(false);
                }}
                {...props}
            >
                {isSelected && (
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <Check className="h-4 w-4" />
                    </span>
                )}
                {children}
            </div>
        );
    }
);
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
