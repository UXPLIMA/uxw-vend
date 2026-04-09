import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/core/lib/db";
import Link from "next/link";

/**
 * Recent errors widget — 5 most recent failed cron runs.
 */
export default async function RecentErrorsWidget() {
    let runs: Array<{ jobKey: string; lastError: string | null; lastRunAt: Date }> = [];
    try {
        runs = await prisma.cronRun.findMany({
            where: { lastStatus: "error" },
            orderBy: { lastRunAt: "desc" },
            take: 5,
            select: { jobKey: true, lastError: true, lastRunAt: true },
        });
    } catch { /* degrade */ }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Recent errors
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {runs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No recent errors.</p>
                ) : (
                    <ul className="space-y-1.5">
                        {runs.map((r) => (
                            <li key={r.jobKey} className="text-xs">
                                <div className="font-mono truncate">{r.jobKey}</div>
                                {r.lastError && <div className="text-muted-foreground truncate">{r.lastError}</div>}
                            </li>
                        ))}
                    </ul>
                )}
                <Link href="/admin/cron" className="text-xs text-primary hover:underline mt-2 inline-block">
                    View all →
                </Link>
            </CardContent>
        </Card>
    );
}
