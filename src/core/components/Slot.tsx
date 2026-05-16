"use client";

import React from "react";
import { ModuleSlotContents, SlotContentRegistry } from "@/core/generated/module-registry";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";

/**
 * Named slot — any module's template can declare a <Slot name="xxx"> and
 * other modules can inject content into it via their manifest.slotContents.
 *
 * Example:
 *   // In blog article page template:
 *   <article>
 *     <h1>{article.title}</h1>
 *     <Slot name="blog.article.aboveContent" context={{ articleId: article.id }} />
 *     <div dangerouslySetInnerHTML={{ __html: article.content }} />
 *     <Slot name="blog.article.belowContent" context={{ articleId: article.id }} />
 *   </article>
 *
 *   // In another module's manifest.json:
 *   "slotContents": [
 *     { "slot": "blog.article.belowContent", "component": "components/RelatedProducts", "order": 10 }
 *   ]
 *
 * This is the template-extension pattern: modules contribute output into
 * another module's render tree without either side knowing about the other.
 * Slot consumers don't know who injects; injectors don't know who exposes.
 *
 * Naming convention: `<module>.<view>.<position>`
 *   blog.article.aboveContent
 *   blog.article.belowContent
 *   store.product.aboveDescription
 *   forum.topic.belowFirstPost
 *   homepage.hero
 *   homepage.belowHero
 */

interface SlotProps {
    name: string;
    context?: Record<string, unknown>;
    /** Render this if no modules contribute to the slot. */
    fallback?: React.ReactNode;
}

export function Slot({ name, context, fallback = null }: SlotProps) {
    const moduleStatus = useAllModules();

    const contributions = ModuleSlotContents
        .filter((sc) => sc.slot === name)
        .filter((sc) => moduleStatus[sc.module] === true)
        .filter((sc) => (SlotContentRegistry as Record<string, React.ComponentType<Record<string, unknown>>>)[sc.id])
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    if (contributions.length === 0) return <>{fallback}</>;

    return (
        <>
            {contributions.map((sc) => {
                const Component = (SlotContentRegistry as Record<string, React.ComponentType<Record<string, unknown>>>)[sc.id];
                return (
                    <ModuleErrorBoundary key={sc.id} fallbackLabel={`Failed: ${sc.id}`}>
                        <Component {...(context || {})} />
                    </ModuleErrorBoundary>
                );
            })}
        </>
    );
}

/**
 * Server-side variant: returns the list of contributions so a server
 * component can render them without the module-provider context.
 * The component still renders on the client (they are "use client" modules).
 */
export function getSlotContributions(name: string): { id: string; module: string; order: number }[] {
    return ModuleSlotContents
        .filter((sc) => sc.slot === name)
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
        .map((sc) => ({ id: sc.id, module: sc.module, order: sc.order ?? 999 }));
}
