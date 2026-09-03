/**
 * Install planning - pure functions over a module catalog.
 *
 * Split out of `module-dependencies.ts` because that file imports Prisma:
 * the setup wizard runs this planner in the browser to show which
 * dependencies a selection will pull in, and a client bundle cannot carry a
 * database client.
 *
 * Nothing here touches the database or the filesystem. Everything it needs is
 * in the catalog it is handed, which is what makes the ordering and cycle
 * rules testable without a running app.
 */
import { CORE_API_VERSION } from "./core-version";
import { satisfiesRange } from "./semver-range";

export interface ParsedDependency {
    id: string;
    /** Absent means "any installed version" - the pre-contract behaviour. */
    range?: string;
}

const DEPENDENCY_SPEC = /^([a-z0-9][a-z0-9-]*)(?:@(.+))?$/;

/**
 * Splits an `id` or `id@range` dependency spec.
 *
 * The manifest schema has already rejected malformed specs by the time this
 * runs, so an unparseable string here means the value bypassed validation
 * (a hand-edited DB row, a legacy record). Treating the whole string as an id
 * makes that surface as a clean "missing dependency" rather than a crash.
 */
export function parseDependency(spec: string): ParsedDependency {
    const m = DEPENDENCY_SPEC.exec(spec);
    if (!m) return { id: spec };
    return m[2] === undefined ? { id: m[1] } : { id: m[1], range: m[2] };
}

export interface CatalogEntry {
    id: string;
    version: string;
    dependencies?: string[];
    conflicts?: string[];
    coreVersion?: string;
}

export type InstallPlanError =
    | { kind: "unknown"; id: string; requiredBy: string | null }
    | { kind: "cycle"; ids: string[] }
    | { kind: "conflict"; a: string; b: string }
    | { kind: "version"; id: string; required: string; available: string; requiredBy: string }
    | { kind: "core"; id: string; required: string; actual: string };

export interface InstallPlan {
    /** Topologically sorted: a module never precedes something it depends on. */
    order: string[];
    /** Pulled in transitively - the operator did not select these. */
    autoAdded: string[];
    errors: InstallPlanError[];
}

/**
 * Expands a requested module selection into a complete, ordered install plan.
 *
 * Pure: no database, no filesystem. Everything it needs is in the catalog, so
 * the ordering and cycle rules are testable without a running app.
 *
 * `autoAdded` exists so the UI can tell the operator what it is about to
 * install on their behalf. Expanding a selection silently is the failure this
 * function exists to prevent - the point is not just to get the order right,
 * but to make the expansion visible.
 */
export function resolveInstallPlan(
    requested: readonly string[],
    catalog: readonly CatalogEntry[],
    options: { coreApiVersion?: string } = {},
): InstallPlan {
    const coreApiVersion = options.coreApiVersion ?? CORE_API_VERSION;
    const byId = new Map(catalog.map((e) => [e.id, e]));
    const errors: InstallPlanError[] = [];

    const selected = [...new Set(requested)];
    const included = new Set<string>();
    const autoAdded: string[] = [];

    // Breadth-first closure over dependencies. `requiredBy` is carried so an
    // error names the module that pulled the missing piece in, not just the
    // piece.
    const queue: Array<{ id: string; requiredBy: string | null; range?: string }> = selected.map(
        (id) => ({ id, requiredBy: null }),
    );

    while (queue.length > 0) {
        const item = queue.shift()!;
        const entry = byId.get(item.id);

        if (!entry) {
            if (!errors.some((e) => e.kind === "unknown" && e.id === item.id)) {
                errors.push({ kind: "unknown", id: item.id, requiredBy: item.requiredBy });
            }
            continue;
        }

        if (item.range && !satisfiesRange(entry.version, item.range)) {
            errors.push({
                kind: "version",
                id: item.id,
                required: item.range,
                available: entry.version,
                requiredBy: item.requiredBy ?? item.id,
            });
        }

        if (included.has(item.id)) continue;
        included.add(item.id);
        if (item.requiredBy !== null && !selected.includes(item.id)) {
            autoAdded.push(item.id);
        }

        if (entry.coreVersion && !satisfiesRange(coreApiVersion, entry.coreVersion)) {
            errors.push({
                kind: "core",
                id: entry.id,
                required: entry.coreVersion,
                actual: coreApiVersion,
            });
        }

        for (const spec of entry.dependencies ?? []) {
            const dep = parseDependency(spec);
            queue.push({ id: dep.id, requiredBy: entry.id, range: dep.range });
        }
    }

    // Conflicts are checked across the resolved set, not just the selection:
    // a conflict pulled in transitively is still a conflict.
    for (const id of included) {
        for (const spec of byId.get(id)?.conflicts ?? []) {
            const other = parseDependency(spec);
            if (!included.has(other.id)) continue;
            const otherEntry = byId.get(other.id);
            if (other.range && otherEntry && !satisfiesRange(otherEntry.version, other.range)) {
                continue;
            }
            const [a, b] = [id, other.id].sort();
            if (!errors.some((e) => e.kind === "conflict" && e.a === a && e.b === b)) {
                errors.push({ kind: "conflict", a, b });
            }
        }
    }

    // Kahn's algorithm over the included subgraph. Edges point dependency ->
    // dependent, so the emitted order installs prerequisites first. Ties break
    // alphabetically to keep the plan deterministic across runs.
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    for (const id of included) {
        inDegree.set(id, 0);
        dependents.set(id, []);
    }
    for (const id of included) {
        for (const spec of byId.get(id)?.dependencies ?? []) {
            const depId = parseDependency(spec).id;
            if (!included.has(depId)) continue;
            inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
            dependents.get(depId)!.push(id);
        }
    }

    const ready = [...included].filter((id) => inDegree.get(id) === 0).sort();
    const order: string[] = [];
    while (ready.length > 0) {
        const id = ready.shift()!;
        order.push(id);
        for (const dependent of dependents.get(id) ?? []) {
            const next = (inDegree.get(dependent) ?? 0) - 1;
            inDegree.set(dependent, next);
            if (next === 0) {
                // Keep the queue sorted so the plan is reproducible.
                const at = ready.findIndex((x) => x > dependent);
                ready.splice(at === -1 ? ready.length : at, 0, dependent);
            }
        }
    }

    if (order.length !== included.size) {
        // Whatever never reached in-degree zero is in, or downstream of, a
        // cycle. Installing part of a cycle is worse than refusing the plan.
        const stuck = [...included].filter((id) => !order.includes(id)).sort();
        errors.push({ kind: "cycle", ids: stuck });
    }

    return { order, autoAdded: autoAdded.sort(), errors };
}

/** Human-readable rendering of a plan error, for API responses and logs. */
export function installPlanErrorMessage(error: InstallPlanError): string {
    switch (error.kind) {
        case "unknown":
            return error.requiredBy
                ? `"${error.id}" is not in the catalog (required by "${error.requiredBy}")`
                : `"${error.id}" is not in the catalog`;
        case "cycle":
            return `circular dependency between: ${error.ids.join(", ")}`;
        case "conflict":
            return `"${error.a}" conflicts with "${error.b}"`;
        case "version":
            return `"${error.requiredBy}" requires ${error.id}@${error.required}, catalog has ${error.available}`;
        case "core":
            return `"${error.id}" requires core ${error.required} (running ${error.actual})`;
    }
}
