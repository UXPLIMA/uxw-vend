"use client";

import { useState, useCallback, createContext, useContext } from "react";
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

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({ open: true, options, resolve });
        });
    }, []);

    const handleClose = (result: boolean) => {
        state.resolve?.(result);
        setState({ open: false, options: { message: "" }, resolve: null });
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {state.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" onClick={() => handleClose(false)} />
                    <div className="relative bg-card border border-[var(--color-border)] rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-fade-in">
                        <div className="flex items-start gap-4">
                            {state.options.variant === "danger" && (
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                </div>
                            )}
                            <div className="flex-1">
                                {state.options.title && (
                                    <h3 className="font-semibold text-foreground mb-1">{state.options.title}</h3>
                                )}
                                <p className="text-sm text-muted-foreground">{state.options.message}</p>
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
