/**
 * Who owns an API address.
 *
 * `matchApiRoute` resolves a request with the first declaration whose path
 * equals the URL. That makes the winner a function of enumeration order, and
 * a module's manifest arrives in a ZIP from outside, so the loser can be an
 * endpoint that has been answering for months. Nav group declarations already
 * get reconciled this way; addresses did not.
 *
 * Kept free of imports, like `nav-group-conflicts.ts`, so an install route, a
 * build script and a test can all ask the same question.
 */

/** The addresses one module says it answers. */
export interface ModuleApiClaim {
    module: string;
    paths: string[];
}

export interface ApiPathConflict {
    /** The address as the incoming manifest spelled it. */
    path: string;
    /** The module already answering there. */
    owner: string;
}

/**
 * One address, one spelling. The matcher compares a request path literally,
 * so `/store/orders` and `/store/orders/` are the same door with two names
 * and a check on the raw strings would let the second one through.
 */
function normalize(path: string): string {
    const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
    return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
}

/**
 * Addresses the incoming module claims that another module already answers.
 *
 * Declaring one handler at several paths is legal and common, and so is a
 * module re-declaring its own addresses: an upgrade reinstalls what is
 * already there. Only another module's address is a conflict.
 */
export function findApiPathConflicts(
    incoming: ModuleApiClaim,
    installed: ModuleApiClaim[],
): ApiPathConflict[] {
    const owners = new Map<string, string>();
    for (const claim of installed) {
        if (claim.module === incoming.module) continue;
        for (const path of claim.paths) {
            const key = normalize(path);
            if (!owners.has(key)) owners.set(key, claim.module);
        }
    }

    const conflicts: ApiPathConflict[] = [];
    for (const path of incoming.paths) {
        const owner = owners.get(normalize(path));
        if (owner) conflicts.push({ path, owner });
    }
    return conflicts;
}
