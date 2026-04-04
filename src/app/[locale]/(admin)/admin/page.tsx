import { redirect } from "next/navigation";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/core/components/ui/card";
import { DashboardClient } from "./components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
    const session = await auth();
    if (!session?.user) redirect("/auth/login");
    if (!(await isAdmin(session.user.id))) redirect("/");

    const totalUsers = await prisma.user.count();

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back, {session.user.name}</p>
            </div>

            {/* Users card — core, always visible */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                <Link href="/admin/users">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Users</span>
                                <Users className="w-4 h-4 text-orange-600" />
                            </div>
                            <div className="text-2xl font-bold">{totalUsers}</div>
                        </CardContent>
                    </Card>
                </Link>

                {/* Module cards rendered client-side from module stats APIs */}
                <DashboardClient />
            </div>
        </>
    );
}
