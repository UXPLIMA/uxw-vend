import { accessByRole, type AccessRule } from "@/core/sdk";
import { prisma } from "@/core/sdk/server";

/**
 * Which departments this member may open a ticket in, and what each one asks.
 *
 * Departments have no tree, so the containment rule never fires here; the
 * decision is shared with the forum anyway, because the part worth sharing is
 * what a silence means, and a second copy of that is a second thing to fix.
 */
export interface OpenableDepartment {
    id: string;
    name: string;
    description: string | null;
}

/** What this role may do, per department. */
export async function departmentsOpenTo(roleId: string | null) {
    const [departments, rules] = await Promise.all([
        prisma.ticketDepartment.findMany({
            where: { isActive: true },
            orderBy: { order: "asc" },
            take: 200,
        }),
        prisma.ticketDepartmentPermission.findMany({ take: 1000 }),
    ]);

    const shared: AccessRule[] = rules.map((rule) => ({
        containerId: rule.departmentId,
        roleId: rule.roleId,
        canView: rule.canView,
        canPost: rule.canPost,
        canReply: rule.canReply,
    }));

    return departments
        .map((department) => ({
            department,
            access: accessByRole({ id: department.id, parentId: null }, [], shared, roleId),
        }))
        .filter((entry) => entry.access.view);
}

/** Whether this role may open a ticket in one department. */
export async function mayOpenIn(departmentId: string, roleId: string | null): Promise<boolean> {
    const rules = await prisma.ticketDepartmentPermission.findMany({
        where: { departmentId },
        take: 200,
    });
    const shared: AccessRule[] = rules.map((rule) => ({
        containerId: rule.departmentId,
        roleId: rule.roleId,
        canView: rule.canView,
        canPost: rule.canPost,
        canReply: rule.canReply,
    }));
    return accessByRole({ id: departmentId, parentId: null }, [], shared, roleId).post;
}

/** The extra questions one department asks, in the order it asks them. */
export async function fieldsOf(departmentId: string) {
    const fields = await prisma.ticketDepartmentField.findMany({
        where: { departmentId },
        orderBy: { order: "asc" },
        take: 50,
    });
    return fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options,
    }));
}
