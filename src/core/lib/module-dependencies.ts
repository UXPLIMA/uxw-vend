import { prisma } from "./db";
import { parseDependency } from "./install-plan";
import type { ValidatedModuleManifest } from "./module-manifest-schema";
import { CORE_API_VERSION } from "./core-version";
import { satisfiesRange } from "./semver-range";


export interface VersionMismatch {
    id: string;
    required: string;
    /** `"unknown"` when the module is installed but its version can't be read. */
    installed: string;
}

export interface DependencyCheckFailure {
    ok: false;
    missingDependencies?: string[];
    disabledDependencies?: string[];
    activeConflicts?: string[];
    versionMismatches?: VersionMismatch[];
    coreIncompatible?: { required: string; actual: string };
}

export type DependencyCheckResult = { ok: true } | DependencyCheckFailure;

type CompatManifest = Pick<
    ValidatedModuleManifest,
    "id" | "dependencies" | "conflicts"
> & { coreVersion?: string };

/**
 * Checks a module's declared `coreVersion` against the running core contract.
 *
 * Returns ok for a manifest that declares nothing - every manifest written
 * before the field existed implicitly accepts any core.
 */
export function checkCoreCompatibility(
    manifest: Pick<CompatManifest, "coreVersion">,
    coreApiVersion: string = CORE_API_VERSION,
): DependencyCheckResult {
    const required = manifest.coreVersion;
    if (!required) return { ok: true };
    if (satisfiesRange(coreApiVersion, required)) return { ok: true };
    return { ok: false, coreIncompatible: { required, actual: coreApiVersion } };
}

/**
 * Builds the `installedVersions` lookup from the loaded module definitions.
 *
 * Takes the definitions rather than importing the module system so this file
 * stays free of the generated registry and remains unit-testable.
 */
export function installedVersionsFrom(
    definitions: ReadonlyArray<{ id: string; version?: string }>,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of definitions) {
        if (d.version) out[d.id] = d.version;
    }
    return out;
}

export interface DependencyCheckOptions {
    /**
     * Installed module id -> version, normally built from the on-disk
     * manifests (`moduleSystem.getDefinitions()`). Required to verify a
     * dependency that declares a range: a range we cannot check is reported as
     * a mismatch rather than waved through.
     */
    installedVersions?: Readonly<Record<string, string>>;
    coreApiVersion?: string;
}

/**
 * Verify that every module listed in `dependencies` is installed AND enabled
 * AND (when a range is declared) at an acceptable version, that no module
 * listed in `conflicts` is currently enabled, and that the running core
 * satisfies `coreVersion`.
 *
 * Runs before install / update / enable so operators can't accidentally
 * activate a module whose prerequisites aren't in place, or a module that
 * breaks an incompatible one already running.
 *
 * Return shape is structured so the caller can relay a clean 409 with the
 * specific names the operator needs to act on.
 */
export async function checkModuleDependencies(
    manifest: CompatManifest,
    options: DependencyCheckOptions = {},
): Promise<DependencyCheckResult> {
    const dependencies = (manifest.dependencies ?? []).map(parseDependency);
    const conflicts = (manifest.conflicts ?? []).map(parseDependency);

    const core = checkCoreCompatibility(manifest, options.coreApiVersion);
    const coreIncompatible = core.ok ? undefined : core.coreIncompatible;

    if (dependencies.length === 0 && conflicts.length === 0) {
        return coreIncompatible ? { ok: false, coreIncompatible } : { ok: true };
    }

    const involvedIds = [...new Set([...dependencies, ...conflicts].map((d) => d.id))];
    const rows = await prisma.moduleConfig.findMany({
        where: { id: { in: involvedIds } },
        select: { id: true, enabled: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r.enabled]));
    const versions = options.installedVersions ?? {};

    const missingDependencies: string[] = [];
    const disabledDependencies: string[] = [];
    const versionMismatches: VersionMismatch[] = [];

    for (const dep of dependencies) {
        if (!byId.has(dep.id)) {
            missingDependencies.push(dep.id);
            continue;
        }
        if (byId.get(dep.id) === false) {
            disabledDependencies.push(dep.id);
        }
        // A disabled dependency is already a failure; still report a version
        // problem so the operator fixes both in one pass rather than enabling
        // it only to be rejected again.
        if (dep.range) {
            const installed = versions[dep.id];
            if (!installed || !satisfiesRange(installed, dep.range)) {
                versionMismatches.push({
                    id: dep.id,
                    required: dep.range,
                    installed: installed ?? "unknown",
                });
            }
        }
    }

    // A conflict only matters when the other module is actually running. A
    // ranged conflict narrows that further: only the named versions clash.
    const activeConflicts = conflicts
        .filter((c) => byId.get(c.id) === true)
        .filter((c) => {
            if (!c.range) return true;
            const installed = versions[c.id];
            // An unreadable version can't be cleared, so treat it as clashing.
            return !installed || satisfiesRange(installed, c.range);
        })
        .map((c) => c.id);

    if (
        !coreIncompatible &&
        missingDependencies.length === 0 &&
        disabledDependencies.length === 0 &&
        activeConflicts.length === 0 &&
        versionMismatches.length === 0
    ) {
        return { ok: true };
    }

    return {
        ok: false,
        ...(missingDependencies.length ? { missingDependencies } : {}),
        ...(disabledDependencies.length ? { disabledDependencies } : {}),
        ...(activeConflicts.length ? { activeConflicts } : {}),
        ...(versionMismatches.length ? { versionMismatches } : {}),
        ...(coreIncompatible ? { coreIncompatible } : {}),
    };
}

export function dependencyErrorMessage(failure: DependencyCheckFailure): string {
    const parts: string[] = [];
    if (failure.coreIncompatible) {
        parts.push(
            `requires core ${failure.coreIncompatible.required} (running ${failure.coreIncompatible.actual})`,
        );
    }
    if (failure.missingDependencies?.length) {
        parts.push(`requires not-installed modules: ${failure.missingDependencies.join(", ")}`);
    }
    if (failure.disabledDependencies?.length) {
        parts.push(`requires disabled modules: ${failure.disabledDependencies.join(", ")}`);
    }
    if (failure.versionMismatches?.length) {
        parts.push(
            `requires incompatible versions: ${failure.versionMismatches
                .map((v) => `${v.id}@${v.required} (installed ${v.installed})`)
                .join(", ")}`,
        );
    }
    if (failure.activeConflicts?.length) {
        parts.push(`conflicts with active modules: ${failure.activeConflicts.join(", ")}`);
    }
    return parts.join("; ") || "module dependency check failed";
}

// The pure planner lives in ./install-plan so the setup wizard can run it in
// the browser. Re-exported here so callers have one import for the whole
// dependency story.
export {
    parseDependency,
    resolveInstallPlan,
    installPlanErrorMessage,
} from "./install-plan";
export type {
    ParsedDependency,
    CatalogEntry,
    InstallPlan,
    InstallPlanError,
} from "./install-plan";
