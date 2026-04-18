import { prisma } from "./db";
import type { ValidatedModuleManifest } from "./module-manifest-schema";

export interface DependencyCheckFailure {
    ok: false;
    missingDependencies?: string[];
    disabledDependencies?: string[];
    activeConflicts?: string[];
}

export type DependencyCheckResult = { ok: true } | DependencyCheckFailure;

/**
 * Verify that every module listed in `dependencies` is installed AND
 * enabled, and that no module listed in `conflicts` is currently enabled.
 *
 * Runs before install / update / enable so operators can't accidentally
 * activate a module whose prerequisites aren't in place, or a module that
 * breaks an incompatible one already running.
 *
 * Return shape is structured so the caller can relay a clean 409 with the
 * specific names the operator needs to act on.
 */
export async function checkModuleDependencies(
    manifest: Pick<ValidatedModuleManifest, "id" | "dependencies" | "conflicts">,
): Promise<DependencyCheckResult> {
    const dependencies = manifest.dependencies ?? [];
    const conflicts = manifest.conflicts ?? [];

    if (dependencies.length === 0 && conflicts.length === 0) {
        return { ok: true };
    }

    const involvedIds = [...new Set([...dependencies, ...conflicts])];
    const rows = await prisma.moduleConfig.findMany({
        where: { id: { in: involvedIds } },
        select: { id: true, enabled: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r.enabled]));

    const missingDependencies = dependencies.filter((d) => !byId.has(d));
    const disabledDependencies = dependencies.filter(
        (d) => byId.has(d) && byId.get(d) === false,
    );
    const activeConflicts = conflicts.filter((c) => byId.get(c) === true);

    if (
        missingDependencies.length === 0 &&
        disabledDependencies.length === 0 &&
        activeConflicts.length === 0
    ) {
        return { ok: true };
    }

    return {
        ok: false,
        ...(missingDependencies.length ? { missingDependencies } : {}),
        ...(disabledDependencies.length ? { disabledDependencies } : {}),
        ...(activeConflicts.length ? { activeConflicts } : {}),
    };
}

export function dependencyErrorMessage(failure: DependencyCheckFailure): string {
    const parts: string[] = [];
    if (failure.missingDependencies?.length) {
        parts.push(`requires not-installed modules: ${failure.missingDependencies.join(", ")}`);
    }
    if (failure.disabledDependencies?.length) {
        parts.push(`requires disabled modules: ${failure.disabledDependencies.join(", ")}`);
    }
    if (failure.activeConflicts?.length) {
        parts.push(`conflicts with active modules: ${failure.activeConflicts.join(", ")}`);
    }
    return parts.join("; ") || "module dependency check failed";
}
