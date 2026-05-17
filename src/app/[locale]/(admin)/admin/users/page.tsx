import { Link } from "@/core/lib/i18n/navigation";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { formatDate } from "@/core/lib/utils";
import { Button } from "@/core/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UserRoleSelect } from "./role-select";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

async function getUsers(page: number, limit: number) {
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

interface PageProps {
    searchParams: Promise<{ page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
    const session = await auth();
    if (!session?.user) redirect("/auth/login");

    const adminCheck = await isAdmin(session.user.id);
    if (!adminCheck) redirect("/");

    const sp = await searchParams;
    const requestedPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

    const [{ users, total }, roles] = await Promise.all([getUsers(requestedPage, PAGE_SIZE), getRoles()]);
    const t = await getTranslations("admin");
    const locale = await getLocale();
    const dateTag = locale === "tr" ? "tr-TR" : locale;

    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requestedPage, pageCount);
    const prevPage = page > 1 ? page - 1 : null;
    const nextPage = page < pageCount ? page + 1 : null;

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("users_title")}</h1>
                <p className="text-muted-foreground">{t("users_total", { count: total })}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t("users_allUsers")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {users.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t("users_noUsers")}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("users_user")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("users_email")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("users_role")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("users_joined")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                        {user.avatar ? (
                                                            <Image src={user.avatar} alt={user.username} width={32} height={32} className="w-full h-full rounded-full object-cover" unoptimized />
                                                        ) : (
                                                            user.username[0].toUpperCase()
                                                        )}
                                                    </div>
                                                    <Link href={`/admin/users/${user.id}`} className="font-medium hover:text-primary transition-colors">
                                                        {user.username}
                                                        {user.isBanned && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{t("users_banned")}</span>}
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
                                                {formatDate(user.createdAt, undefined, dateTag)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {pageCount > 1 && (
                        <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                {t.has("users_pageOf")
                                    ? t("users_pageOf", { page, total: pageCount })
                                    : `Page ${page} of ${pageCount}`}
                            </p>
                            <div className="flex gap-2">
                                {prevPage ? (
                                    <Link href={`/admin/users?page=${prevPage}`}>
                                        <Button variant="outline" size="sm">
                                            <ChevronLeft className="w-4 h-4 mr-1" />
                                            {t.has("users_prev") ? t("users_prev") : "Previous"}
                                        </Button>
                                    </Link>
                                ) : (
                                    <Button variant="outline" size="sm" disabled>
                                        <ChevronLeft className="w-4 h-4 mr-1" />
                                        {t.has("users_prev") ? t("users_prev") : "Previous"}
                                    </Button>
                                )}
                                {nextPage ? (
                                    <Link href={`/admin/users?page=${nextPage}`}>
                                        <Button variant="outline" size="sm">
                                            {t.has("users_next") ? t("users_next") : "Next"}
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </Link>
                                ) : (
                                    <Button variant="outline" size="sm" disabled>
                                        {t.has("users_next") ? t("users_next") : "Next"}
                                        <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
