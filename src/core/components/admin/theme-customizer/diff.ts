export function computeOverrideDiff(
    defaults: Record<string, unknown>,
    current: Record<string, unknown>,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(current)) {
        const d = defaults[k];
        if (v && typeof v === "object" && !Array.isArray(v) && d && typeof d === "object" && !Array.isArray(d)) {
            const nested = computeOverrideDiff(d as Record<string, unknown>, v as Record<string, unknown>);
            if (Object.keys(nested).length > 0) out[k] = nested;
        } else if (!Object.is(v, d)) {
            out[k] = v;
        }
    }
    return out;
}

export function applyOverrides(
    defaults: Record<string, unknown>,
    overrides: Record<string, unknown>,
): Record<string, unknown> {
    const out: Record<string, unknown> = { ...defaults };
    for (const [k, v] of Object.entries(overrides)) {
        if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] !== null && !Array.isArray(out[k])) {
            out[k] = applyOverrides(out[k] as Record<string, unknown>, v as Record<string, unknown>);
        } else {
            out[k] = v;
        }
    }
    return out;
}
