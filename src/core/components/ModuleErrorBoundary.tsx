"use client";

import React from "react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";

interface Props {
    children: React.ReactNode;
    /**
     * Which module component this boundary wraps. It names the component in
     * the console when one fails; it is not shown to the reader, because the
     * id of a slot is a fact about the codebase and not about the page.
     */
    componentId?: string;
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

    static getDerivedStateFromError(error: Error): State {
        // A module component that calls `notFound()` or `redirect()` signals by
        // throwing. Swallowing that here turns the signal into an inline
        // "failed to load" box on a page that still answers 200.
        unstable_rethrow(error);
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        unstable_rethrow(error);
        console.error(
            `[ModuleErrorBoundary] ${this.props.componentId ?? "component"} failed to render:`,
            error,
            info.componentStack,
        );
    }

    render() {
        if (this.state.hasError) {
            return <SlotFailed onRetry={() => this.setState({ hasError: false })} />;
        }

        return this.props.children;
    }
}

/**
 * The notice, in the reader's language.
 *
 * It used to be an English string built from the failing module's id, passed
 * in by each of the six call sites. That put a developer's identifier in front
 * of a visitor, in a language that may not be theirs, and it left six places
 * to keep in step. A class component cannot call a hook, so the notice is a
 * function component; every boundary renders under the locale layout's
 * provider, so it has a catalogue to ask.
 */
function SlotFailed({ onRetry }: { onRetry: () => void }) {
    const t = useTranslations("common");

    return (
        <div className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 inline-flex items-center gap-1">
            <span>{t("componentFailed")}</span>
            <button onClick={onRetry} className="text-primary hover:underline ml-1">
                {t("retry")}
            </button>
        </div>
    );
}
