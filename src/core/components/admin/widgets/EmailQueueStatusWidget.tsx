import { Card, CardContent } from "@/core/components/ui/card";
import { Inbox } from "lucide-react";
import { prisma } from "@/core/lib/db";
import Link from "next/link";

/**
 * Email queue status widget — pending/failed counts.
 */
export default async function EmailQueueStatusWidget() {
    let pending = 0;
    let failed = 0;
    try {
        const [p, f] = await Promise.all([
            prisma.emailJob.count({ where: { status: "pending" } }),
            prisma.emailJob.count({ where: { status: "failed" } }),
        ]);
        pending = p;
        failed = f;
    } catch { /* degrade */ }

    return (
        <Link href="/admin/email-queue" className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email queue</span>
                        <Inbox className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="flex items-baseline gap-3">
                        <div>
                            <div className="text-2xl font-bold">{pending}</div>
                            <div className="text-[10px] uppercase text-muted-foreground">pending</div>
                        </div>
                        <div>
                            <div className={`text-2xl font-bold ${failed > 0 ? "text-red-500" : ""}`}>{failed}</div>
                            <div className="text-[10px] uppercase text-muted-foreground">failed</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
