"use client";

import { useState, useCallback, useRef, createContext, useContext } from "react";
import { useModalDialog } from "@/core/hooks/useModalDialog";
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

    const stateRef = useRef(state);
    stateRef.current = state;

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({ open: true, options, resolve });
        });
    }, []);

    const handleClose = useCallback((result: boolean) => {
        stateRef.current.resolve?.(result);
        setState({ open: false, options: { message: "" }, resolve: null });
    }, []);

    // Escape, the Tab trap and returning focus to whatever opened the dialog
    // all live in one place now. This component used to be the only one in the
    // product that had them, which is how the other eleven dialogs came to ship
    // `aria-modal="true"` over a page Tab could still walk into.
    const dialogRef = useModalDialog<HTMLDivElement>(state.open, () => handleClose(false));

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
                        className="relative bg-card border border-[var(--uxw-color-border)] rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto animate-fade-in"
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
