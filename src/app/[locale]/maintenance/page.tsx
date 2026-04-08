import Link from "next/link";
import { Wrench, LogIn } from "lucide-react";
import { getMaintenanceConfig } from "@/core/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
    const config = await getMaintenanceConfig();
    const message = config.message?.trim() || "We'll be back soon.";

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mb-6">
                    <Wrench className="w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-3">
                    Under Maintenance
                </h1>
                <p className="text-muted-foreground text-base leading-relaxed mb-8 whitespace-pre-line">
                    {message}
                </p>
                <div className="pt-2">
                    <Link
                        href="/auth/login"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                    >
                        <LogIn className="w-4 h-4" />
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
