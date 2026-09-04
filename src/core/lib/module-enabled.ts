/**
 * The one place that answers "is this module on?" from a states map.
 *
 * `getModuleStates()` returns a row per module that has a `ModuleConfig`, and
 * an empty map when the database is unreachable. Every consumer therefore has
 * to decide what an absent entry means, and until this helper existed they
 * disagreed: the proxy and `isModuleEnabled` read it as enabled (documented,
 * fail open), while nineteen UI call sites hand-rolled `states[id] === true`
 * and read it as disabled. The two are indistinguishable while every module
 * has its row, and diverge exactly when it matters - during a database blip
 * the proxy kept serving /blog while the navbar, footer, homepage, mobile nav
 * and every slot dropped their module content.
 *
 * Absent means enabled here, matching what `module-cache.ts` documents. A
 * registry entry only exists for a module whose files are installed, so the
 * question is never "is it installed" - it is only whether an admin has
 * turned it off, and that answer is a stored `false`.
 */
export function isEnabledIn(states: Record<string, boolean>, moduleId: string): boolean {
    return states[moduleId] !== false;
}
