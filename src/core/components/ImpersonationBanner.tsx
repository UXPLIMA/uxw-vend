"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { UserCog, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Fixed top-of-viewport banner shown whenever the current session is an
 * admin impersonating another user. Clicking "Return to your account"
 * calls the stop endpoint and then triggers a session update so Auth.js
 * rewrites the JWT back to the admin's own identity.
 */
export function ImpersonationBanner() {
    const { data: session, update } = useSession();
    const [stopping, setStopping] = useState(false);

    if (!session?.user?.originalUserId) return null;

    const impersonatedName = session.user.name || session.user.email || "user";

    const handleStop = async () => {
        setStopping(true);
        try {
            const res = await fetch("/api/v1/admin/impersonate/stop", {
                method: "POST",
            });
            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as { error?: string };
                toast.error(body.error || "Failed to stop impersonating");
                return;
            }
            await update({ stopImpersonating: true });
            toast.success("Returned to your account");
            // Reload so server-rendered permissions re-run with the restored session
            window.location.href = "/admin/users";
        } catch {
            toast.error("Failed to stop impersonating");
        } finally {
            setStopping(false);
        }
    };

    return (
        <div
            role="alert"
            className="fixed top-0 inset-x-0 z-[10000] bg-yellow-400 text-yellow-950 border-b border-yellow-600 shadow-lg"
        >
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                    <UserCog className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">
                        You are impersonating <strong>{impersonatedName}</strong>
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleStop}
                    disabled={stopping}
                    className="inline-flex items-center gap-1 bg-yellow-950 text-yellow-50 hover:bg-yellow-900 disabled:opacity-60 px-3 py-1 rounded font-medium flex-shrink-0"
                >
                    {stopping ? (
                        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                    ) : (
                        <LogOut className="w-3 h-3" aria-hidden="true" />
                    )}
                    Return to your account
                </button>
            </div>
        </div>
    );
}
