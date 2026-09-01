/** Presentation helpers for the modules screen. */

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
