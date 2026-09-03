/** Presentation helpers for the modules screen. */

import { parseDependency } from "@/core/lib/install-plan";
import { satisfiesRange } from "@/core/lib/semver-range";

export const categoryColors: Record<string, string> = {
    commerce: "bg-blue-100 text-blue-700",
    community: "bg-green-100 text-green-700",
    management: "bg-purple-100 text-purple-700",
    gaming: "bg-orange-100 text-orange-700",
    content: "bg-muted text-foreground",
};

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
