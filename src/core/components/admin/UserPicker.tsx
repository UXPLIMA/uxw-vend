"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";

/**
 * "Which user?" - typed, debounced, picked.
 *
 * Two admin screens had written the same three hundred milliseconds of
 * debounce, the same `/api/v1/users?search=`, the same absolutely positioned
 * result list and the same "clear the selection when the query changes". They
 * had also drifted: one waited 250ms and the other 300, and only one cleared
 * its pending timer on unmount, so leaving the screen mid-search set state on
 * a component that was gone.
 */

export interface PickedUser {
    id: string;
    username: string;
}

export function UserPicker({
    value,
    onChange,
    label,
    placeholder,
    id = "user-picker",
    required,
}: {
    value: PickedUser | null;
    onChange: (user: PickedUser | null) => void;
    label: string;
    placeholder?: string;
    id?: string;
    required?: boolean;
}) {
    const t = useTranslations("admin");
    const [query, setQuery] = useState(value?.username ?? "");
    const [hits, setHits] = useState<PickedUser[]>([]);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const search = (q: string) => {
        setQuery(q);
        onChange(null);
        if (timer.current) clearTimeout(timer.current);
        if (!q.trim()) {
            setHits([]);
            return;
        }
        timer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/v1/users?search=${encodeURIComponent(q)}&limit=10`);
                if (!res.ok) return;
                const data = await res.json();
                setHits(
                    (data.users || []).map((u: { id: string; username: string }) => ({
                        id: u.id,
                        username: u.username,
                    })),
                );
            } catch {
                /* a failed lookup leaves the list as it was */
            }
        }, 250);
    };

    return (
        <div className="relative">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                required={required && !value}
            />
            {value && (
                <p className="text-xs text-muted-foreground mt-1">
                    {t("warnings_selected")}: <span className="font-medium">{value.username}</span>
                </p>
            )}
            {hits.length > 0 && !value && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-md max-h-56 overflow-y-auto">
                    {hits.map((user) => (
                        <button
                            type="button"
                            key={user.id}
                            onClick={() => {
                                onChange(user);
                                setQuery(user.username);
                                setHits([]);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                        >
                            {user.username}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
