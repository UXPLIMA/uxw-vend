import { Card, CardContent } from "@/core/components/ui/card";
import { Users } from "lucide-react";
import { prisma } from "@/core/lib/db";
import Link from "next/link";

/**
 * Users widget — total count + 7-day delta.
 */
export default async function UsersCountWidget() {
    let total = 0;
    let last7d = 0;
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [t, d] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        ]);
        total = t;
        last7d = d;
    } catch { /* widget degrades gracefully */ }

    return (
        <Link href="/admin/users" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Users</span>
                        <Users className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="text-2xl font-bold">{total.toLocaleString()}</div>
                    {last7d > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">+{last7d} in 7 days</div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
