import { createHash } from "crypto";

/**
 * Deterministic checksum of the manifest bytes a module was installed
 * with. We hash the canonical JSON payload (keys sorted) so a reformat
 * that doesn't change semantics still produces the same digest — only a
 * real content change moves the hash.
 */
export function manifestHash(manifest: unknown): string {
    return createHash("sha256").update(canonicalJson(manifest)).digest("hex");
}

function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) {
        return "[" + value.map(canonicalJson).join(",") + "]";
    }
    if (value !== null && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return (
            "{" +
            entries
                .map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v))
                .join(",") +
            "}"
        );
    }
    return JSON.stringify(value);
}
