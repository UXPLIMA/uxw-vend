/**
 * Nav group declaration reconciliation.
 *
 * Lives apart from `admin-nav-groups.ts` so the build scripts can import it
 * without pulling in lucide-react and the generated theme registry.
 */

/** A nav group declared by a module manifest. */
export interface ModuleNavGroupDeclaration {
    id: string;
    label: string;
    icon?: string;
    order?: number;
    module: string;
}

export interface NavGroupConflict {
    id: string;
    field: "label" | "icon";
    /** Module whose declaration is used. */
    winner: string;
    /** Module whose declaration is ignored. */
    loser: string;
    winningValue: string;
    losingValue: string;
}

/**
 * Order declarations the way `buildNavGroups` resolves them: by declaring
 * module id, so the winning declaration never depends on install order or
 * filesystem enumeration.
 */
export function byDeclaringModule(
    a: ModuleNavGroupDeclaration,
    b: ModuleNavGroupDeclaration,
): number {
    return a.module.localeCompare(b.module) || a.id.localeCompare(b.id);
}

/**
 * Report nav group ids that two modules declare differently.
 *
 * Sharing a group is the normal case — a storefront and a credits module both
 * belong under Commerce — so agreeing declarations are silent. Only a
 * disagreement is reported, and as a warning rather than an error: one module
 * spelling a label differently must not brick an install.
 */
export function findNavGroupConflicts(
    declarations: ModuleNavGroupDeclaration[],
): NavGroupConflict[] {
    const winners = new Map<string, ModuleNavGroupDeclaration>();
    const conflicts: NavGroupConflict[] = [];

    for (const declaration of [...declarations].sort(byDeclaringModule)) {
        const winner = winners.get(declaration.id);
        if (!winner) {
            winners.set(declaration.id, declaration);
            continue;
        }
        if (winner.label !== declaration.label) {
            conflicts.push({
                id: declaration.id,
                field: "label",
                winner: winner.module,
                loser: declaration.module,
                winningValue: winner.label,
                losingValue: declaration.label,
            });
        }
        if ((winner.icon ?? "") !== (declaration.icon ?? "")) {
            conflicts.push({
                id: declaration.id,
                field: "icon",
                winner: winner.module,
                loser: declaration.module,
                winningValue: winner.icon ?? "",
                losingValue: declaration.icon ?? "",
            });
        }
    }

    return conflicts;
}
