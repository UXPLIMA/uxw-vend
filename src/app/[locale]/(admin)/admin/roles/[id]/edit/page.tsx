"use client";

import { use, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { LoadFailed } from "@/core/components/ui/load-failed";
import { RoleForm, type RoleRecord } from "../../role-form";

/**
 * There is no `GET /api/v1/roles/:id` - the list endpoint returns every role
 * with its permissions and user count, which is what this screen needs, and a
 * site has tens of roles rather than thousands. Adding an endpoint to avoid
 * one request that is already cheap would be the wrong trade.
 */
export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [role, setRole] = useState<RoleRecord | null>(null);
    const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

    const load = () => {
        setState("loading");
        fetch("/api/v1/roles")
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
            .then((data: { roles?: RoleRecord[] }) => {
                const found = (data.roles || []).find((r) => r.id === id) ?? null;
                setRole(found);
                setState(found ? "ready" : "failed");
            })
            .catch(() => setState("failed"));
    };

    useEffect(load, [id]);

    if (state === "loading") {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (state === "failed" || !role) {
        return <LoadFailed onRetry={load} />;
    }

    return <RoleForm role={role} />;
}
