import React from "react";
import { ModuleSlotContents, SlotContentRegistry } from "@/core/generated/module-registry";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";

/**
 * Server-rendered variant of `<Slot>`.
 *
 * `<Slot>` is a client component: it reads which modules are enabled from the
 * module provider, which only exists inside `<body>`. `head.extra` renders
 * inside `<head>`, above that provider, so it needs a slot that takes the
 * module states as a prop instead of reading them from context.
 *
 * That is the whole difference. Contributions, ordering and the per-module
 * error boundary behave exactly as they do in `<Slot>`.
 */
interface ServerSlotProps {
    name: string;
    /** Enabled state per module id, as the root layout already computes it. */
    moduleStates: Record<string, boolean>;
    context?: Record<string, unknown>;
    fallback?: React.ReactNode;
}

export function ServerSlot({ name, moduleStates, context, fallback = null }: ServerSlotProps) {
    const registry = SlotContentRegistry as Record<string, React.ComponentType<Record<string, unknown>>>;

    const contributions = ModuleSlotContents
        .filter((sc) => sc.slot === name)
        .filter((sc) => moduleStates[sc.module] === true)
        .filter((sc) => registry[sc.id])
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    if (contributions.length === 0) return <>{fallback}</>;

    return (
        <>
            {contributions.map((sc) => {
                const Component = registry[sc.id];
                return (
                    <ModuleErrorBoundary key={sc.id} fallbackLabel={`Failed: ${sc.id}`}>
                        <Component {...(context || {})} />
                    </ModuleErrorBoundary>
                );
            })}
        </>
    );
}
