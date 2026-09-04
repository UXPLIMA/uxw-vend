/**
 * The permission names core owns.
 *
 * Core ships empty of features but not of administration: these four names
 * describe the admin panel itself, so they exist whether or not a single
 * module is installed. Every other permission name in the product is
 * contributed by a module's `permissions` manifest field and reaches the
 * roles screen through the module list.
 *
 * This file is a plain constant with no imports so both halves can read it:
 * `modules.ts` on the server and the roles screen in the browser. It used to
 * be written out twice, once in each, and a name added to one copy would
 * silently not appear in the other.
 *
 * A name listed here is offered as a checkbox on the roles screen and stored
 * as a `Permission` row when an operator ticks it. Whether anything then
 * *enforces* it is a separate question, pinned by
 * `tests/unit/permissions-are-declared.test.ts`.
 */
export const CORE_PERMISSIONS = [
    "admin.access",
    "admin.settings",
    "admin.users",
    "admin.roles",
] as const;

/** The module attributed to a permission name: the part before the first dot. */
export function permissionModule(name: string): string {
    return name.split(".")[0];
}
