"use client";

import { useEffect, useState } from "react";

/**
 * The site's roles, for the two questions a product form asks about them.
 *
 * Two cards on the same form need this list - who may buy a product, and what
 * role buying it grants - and each of them mounting its own fetch asked the
 * same endpoint twice on every page load. The answer is the same for both and
 * it does not change while a form is open, so the request is shared: the first
 * caller starts it, the second waits on the same promise.
 *
 * Failing quietly is deliberate. A form that cannot list roles still saves a
 * product; it just offers "everyone" and "no role", which is what a site with
 * no roles would show anyway.
 */

export interface Role {
    id: string;
    name: string;
    displayName?: string | null;
}

let pending: Promise<Role[]> | null = null;

function loadRoles(): Promise<Role[]> {
    pending ??= fetch("/api/v1/roles")
        .then((res) => {
            if (!res.ok) throw new Error("load failed");
            return res.json();
        })
        .then((data) => (data.roles ?? []) as Role[])
        .catch(() => {
            // Cleared so a later form retries rather than caching the failure
            // for as long as the tab is open.
            pending = null;
            return [];
        });
    return pending;
}

export function useRoles(): Role[] {
    const [roles, setRoles] = useState<Role[]>([]);

    useEffect(() => {
        let cancelled = false;
        loadRoles().then((list) => {
            if (!cancelled) setRoles(list);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return roles;
}
