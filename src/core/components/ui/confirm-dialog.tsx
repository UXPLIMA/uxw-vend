"use client";

import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { Button } from "@/core/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "default";
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType>({
    confirm: () => Promise.resolve(false),
});

export function useConfirm() {
    return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<{
        open: boolean;
        options: ConfirmOptions;
        resolve: ((value: boolean) => void) | null;
    }>({
        open: false,
        options: { message: "" },
        resolve: null,
    });

    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            previousFocusRef.current = document.activeElement as HTMLElement;
            setState({ open: true, options, resolve });
        });
    }, []);

    const handleClose = useCallback((result: boolean) => {
        state.resolve?.(result);
        setState({ open: false, options: { message: "" }, resolve: null });
        // Restore focus to trigger element
        previousFocusRef.current?.focus();
    }, [state]);

    // Focus trap + keyboard handling
    useEffect(() => {
        if (!state.open || !dialogRef.current) return;

        // Focus the confirm button on open
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        firstEl?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") { handleClose(false); return; }
            if (e.key !== "Tab") return;

            if (e.shiftKey) {
                if (document.activeElement === firstEl) { e.preventDefault(); lastEl?.focus(); }
            } else {
                if (document.activeElement === lastEl) { e.preventDefault(); firstEl?.focus(); }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [state.open, handleClose]);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {state.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center" role="presentation">
                    <div className="fixed inset-0 bg-black/50" onClick={() => handleClose(false)} aria-hidden="true" />
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirm-title"
                        aria-describedby="confirm-message"
                        className="relative bg-card border border-[var(--ux-border)] rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto animate-fade-in"
                    >
                        <div className="flex items-start gap-4">
                            {state.options.variant === "danger" && (
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
                                </div>
                            )}
                            <div className="flex-1">
                                {state.options.title && (
                                    <h3 id="confirm-title" className="font-semibold text-foreground mb-1">{state.options.title}</h3>
                                )}
                                <p id="confirm-message" className="text-sm text-muted-foreground">{state.options.message}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                                {state.options.cancelText || "Cancel"}
                            </Button>
                            <Button
                                variant={state.options.variant === "danger" ? "destructive" : "default"}
                                size="sm"
                                onClick={() => handleClose(true)}
                            >
                                {state.options.confirmText || "Confirm"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
