"use client";

import React from "react";

interface Props {
    children: React.ReactNode;
    fallbackLabel?: string;
}

interface State {
    hasError: boolean;
}

/**
 * Per-slot error boundary for module components (widgets, navbar icons, layout components).
 * Catches render errors from a single module component and shows an inline fallback
 * instead of crashing the entire page.
 */
export class ModuleErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("[ModuleErrorBoundary] Component failed to render:", error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 inline-flex items-center gap-1">
                    <span>{this.props.fallbackLabel || "Failed to load component"}</span>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="text-primary hover:underline ml-1"
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
