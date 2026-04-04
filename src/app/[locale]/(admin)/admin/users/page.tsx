import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { formatDate } from "@/core/lib/utils";
import { UserRoleSelect } from "./role-select";

export const dynamic = "force-dynamic";

async function getUsers(page: number = 1, limit: number = 50) {
    const [users, total] = await Promise.all([
        prisma.user.findMany({
            include: {
                role: true,
                _count: true,
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma.user.count(),
    ]);

    return { users, total };
}

async function getRoles() {
    return prisma.role.findMany({ orderBy: { priority: "desc" } });
}

export default async function AdminUsersPage() {
    const session = await auth();
    if (!session?.user) redirect("/auth/login");

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) redirect("/");

    const [{ users, total }, roles] = await Promise.all([getUsers(), getRoles()]);

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Users</h1>
                <p className="text-muted-foreground">{total} users total</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Users</CardTitle>
                </CardHeader>
                <CardContent>
                    {users.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No users found</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                        {user.avatar ? (
                                                            /* eslint-disable-next-line @next/next/no-img-element */
                                                            <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            user.username[0].toUpperCase()
                                                        )}
                                                    </div>
                                                    <Link href={`/admin/users/${user.id}`} className="font-medium hover:text-primary transition-colors">
                                                        {user.username}
                                                        {user.isBanned && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Banned</span>}
                                                    </Link>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                                            <td className="py-3 px-4">
                                                <UserRoleSelect
                                                    userId={user.id}
                                                    currentRoleId={user.roleId || ""}
                                                    roles={roles.map((r) => ({ id: r.id, name: r.name, displayName: r.displayName }))}
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {formatDate(user.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
