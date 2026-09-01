"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/core/components/ui/input";
import { AlertTriangle, Lock, Search } from "lucide-react";
import type { ModuleOption } from "../types";
import { CATEGORY_ORDER, categoryLabel } from "./categories";
import { parseDependency, resolveInstallPlan, installPlanErrorMessage } from "@/core/lib/install-plan";

interface ModulesStepProps {
    catalog: ModuleOption[];
    picked: string[];
    plan: ReturnType<typeof resolveInstallPlan>;
    onToggle: (id: string) => void;
    onClear: () => void;
}

export function ModulesStep({ catalog, picked, plan, onToggle, onClear }: ModulesStepProps) {
    const t = useTranslations("setup.modules");
    const [query, setQuery] = useState("");

    const pickedSet = useMemo(() => new Set(picked), [picked]);
    const autoAddedSet = useMemo(() => new Set(plan.autoAdded), [plan.autoAdded]);

    /** For an auto-added module, which picked modules pulled it in. */
    const requiredBy = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const m of catalog) {
            if (!plan.order.includes(m.id)) continue;
            for (const spec of m.dependencies) {
                const dep = parseDependency(spec).id;
                if (!map.has(dep)) map.set(dep, []);
                map.get(dep)!.push(m.id);
            }
        }
        return map;
    }, [catalog, plan.order]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return catalog;
        return catalog.filter(
            (m) =>
                m.name.toLowerCase().includes(q) ||
                m.description.toLowerCase().includes(q) ||
                m.id.includes(q) ||
                m.tags.some((tag) => tag.toLowerCase().includes(q)),
        );
    }, [catalog, query]);

    // Group by whatever categories the catalog actually declares. Known ones
    // lead in a fixed order; anything else follows alphabetically, so a module
    // inventing a category still shows up rather than vanishing.
    const grouped = useMemo(() => {
        const byCategory = new Map<string, ModuleOption[]>();
        for (const m of filtered) {
            const key = m.category || "other";
            if (!byCategory.has(key)) byCategory.set(key, []);
            byCategory.get(key)!.push(m);
        }
        const known = CATEGORY_ORDER.filter((c) => byCategory.has(c));
        const rest = [...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
        return [...known, ...rest].map((c) => [c, byCategory.get(c)!] as const);
    }, [filtered]);

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>

            {catalog.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t("empty")}</p>
            ) : (
                <>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("search")}
                            className="pl-9"
                        />
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-foreground font-medium">
                            {t("selectedCount", { count: pickedSet.size })}
                        </span>
                        {autoAddedSet.size > 0 && (
                            <span className="text-blue-700">
                                {t("autoAddedCount", { count: autoAddedSet.size })}
                            </span>
                        )}
                        {pickedSet.size > 0 && (
                            <button
                                type="button"
                                onClick={onClear}
                                className="ml-auto text-muted-foreground hover:text-foreground underline"
                            >
                                {t("clear")}
                            </button>
                        )}
                    </div>

                    {plan.errors.length > 0 && (
                        <div className="rounded-md border border-red-300 bg-red-50 p-3 space-y-1">
                            {plan.errors.map((e, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-red-800">
                                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{installPlanErrorMessage(e)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {filtered.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">{t("noResults", { query })}</p>
                    ) : (
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                            {grouped.map(([category, mods]) => (
                                <div key={category}>
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                        {categoryLabel(t, category)}
                                    </h3>
                                    <div className="space-y-2">
                                        {mods.map((m) => {
                                            const isPicked = pickedSet.has(m.id);
                                            const isAuto = autoAddedSet.has(m.id);
                                            const pulledBy = requiredBy.get(m.id) ?? [];
                                            const deps = m.dependencies.map((s) => parseDependency(s).id);
                                            return (
                                                <label
                                                    key={m.id}
                                                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                                        isAuto
                                                            ? "border-blue-300 bg-blue-50/60 cursor-default"
                                                            : "border-border hover:bg-accent/30 cursor-pointer"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isPicked || isAuto}
                                                        // An auto-added module can't be unchecked here:
                                                        // it is only present because something selected
                                                        // needs it. Deselect that instead.
                                                        disabled={isAuto && !isPicked}
                                                        onChange={() => onToggle(m.id)}
                                                        className="mt-1"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-foreground flex items-center gap-1.5">
                                                            {m.name}
                                                            {isAuto && !isPicked && (
                                                                <Lock className="w-3 h-3 text-blue-600" />
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {m.description}
                                                        </div>
                                                        {isAuto && !isPicked && pulledBy.length > 0 && (
                                                            <div className="text-[11px] text-blue-700 mt-1">
                                                                {t("requiredBy", { modules: pulledBy.join(", ") })}
                                                            </div>
                                                        )}
                                                        {!isAuto && deps.length > 0 && (
                                                            <div className="text-[11px] text-muted-foreground mt-1">
                                                                {t("requires", { modules: deps.join(", ") })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * Falls back to the raw slug when a module declares a category we have no
 * label for. Membership is checked against our own list rather than asking the
 * translator, so an unlabelled category renders its slug instead of a missing
 * -key warning.
 */
