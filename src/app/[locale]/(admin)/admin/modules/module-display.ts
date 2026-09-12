/** Presentation helpers for the modules screen. */

import { parseDependency } from "@/core/lib/install-plan";
import { satisfiesRange } from "@/core/lib/semver-range";

/**
 * A chip colour for a category the panel has never heard of.
 *
 * The manifest schema says `category` is free text "so core owns no category
 * vocabulary - the catalog groups by whatever values are present". This file
 * then kept a map of the five it did know and fell through to grey for the
 * rest: forty modules declare one that was not on the list, so the largest
 * group in the catalogue was the one with no colour, and a module inventing
 * its own could never have one. It also put core in the position of naming a
 * sector, which is a position this product does not take.
 *
 * The name decides its own tone. The same category is always the same colour,
 * and none of them is written down here.
 */
export type CategoryTone = "neutral" | "success" | "warning" | "info" | "secondary";

const TONES: CategoryTone[] = ["info", "success", "warning", "secondary", "neutral"];

export function categoryTone(category: string): CategoryTone {
    let sum = 0;
    for (const char of category.toLowerCase()) sum = (sum * 31 + char.charCodeAt(0)) % 100_003;
    return TONES[sum % TONES.length];
}

const TONE_CLASS: Record<CategoryTone, string> = {
    info: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    secondary: "bg-secondary/10 text-secondary",
    neutral: "bg-muted text-foreground",
};

export function categoryClassName(category: string): string {
    return TONE_CLASS[categoryTone(category)];
}

/** Simple semver comparison. Returns positive when a > b. */
export function compareVersions(a: string, b: string): number {
    const ap = a.split(".").map((n) => parseInt(n, 10) || 0);
    const bp = b.split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        const av = ap[i] || 0;
        const bv = bp[i] || 0;
        if (av !== bv) return av - bv;
    }
    return 0;
}

/**
 * How one entry of a module's `dependencies` array should be shown.
 *
 * A dependency is written `id` or `id@range` ("store@^2.0.0"). Comparing the
 * whole spec against installed module ids never matches when a range is
 * present, which is how every payment gateway came to advertise its
 * dependency on `store` as missing on an install that had `store` enabled.
 */
export interface DependencyBadge {
    /** The raw spec. Unique within a module's list, so it works as a React key. */
    spec: string;
    id: string;
    range?: string;
    /** Display name, with the range appended when the dependency declares one. */
    label: string;
    /** Installed, enabled, and (if a range is declared) at a matching version. */
    satisfied: boolean;
    /** Installed and enabled but at a version the range rejects. */
    versionMismatch: boolean;
}

export interface DependencyLookupEntry {
    id: string;
    name?: string;
    version?: string;
    enabled?: boolean;
}

/**
 * Resolves one dependency spec against the installed modules.
 *
 * `fallbackNames` supplies display names for dependencies that are not
 * installed yet - the marketplace catalogue knows them, the installed list
 * cannot.
 */
export function resolveDependencyBadge(
    spec: string,
    installed: ReadonlyArray<DependencyLookupEntry>,
    fallbackNames: ReadonlyArray<{ id: string; name: string }> = [],
): DependencyBadge {
    const { id, range } = parseDependency(spec);
    const match = installed.find((m) => m.id === id);
    const name = match?.name || fallbackNames.find((m) => m.id === id)?.name || id;
    // `enabled` is optional on catalogue rows; only an explicit false counts
    // as disabled.
    const active = match !== undefined && match.enabled !== false;
    // A range we cannot check (installed module with no version) is a
    // mismatch, not a pass - the same call the installer's own check makes.
    const versionOk = !range || (match?.version ? satisfiesRange(match.version, range) : false);
    return {
        spec,
        id,
        ...(range ? { range } : {}),
        label: range ? `${name} ${range}` : name,
        satisfied: active && versionOk,
        versionMismatch: active && !versionOk,
    };
}
