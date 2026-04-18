"use client";

import React, { useEffect, useState } from "react";
import type { ComponentConfig } from "@measured/puck";
import { Crown, Medal, Trophy } from "lucide-react";

/**
 * Puck page-builder block: LeaderboardTop
 * Renders the top N users for the selected leaderboard type. Data is
 * fetched from the public leaderboard API.
 */

interface LeaderboardTopProps {
    limit: number;
    type: "buyers" | "voters" | "forum";
    heading: string;
}

interface LeaderEntry {
    username: string;
    avatar: string | null;
    value: number;
    count?: number;
}

const rankColors = ["text-yellow-500", "text-muted-foreground", "text-amber-600"];

function iconFor(type: LeaderboardTopProps["type"]) {
    if (type === "buyers") return Crown;
    if (type === "voters") return Medal;
    return Trophy;
}

function LeaderboardTopRender({ limit, type, heading }: LeaderboardTopProps): React.ReactElement {
    const [entries, setEntries] = useState<LeaderEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/v1/leaderboard?type=${type}&limit=${limit || 5}`)
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return;
                const list: LeaderEntry[] = Array.isArray(d) ? d : d.leaderboard || d.data || [];
                setEntries(list.slice(0, limit || 5));
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [limit, type]);

    const Icon = iconFor(type);

    return (
        <section className="container mx-auto px-4 py-8 max-w-2xl">
            {heading ? (
                <div className="flex items-center gap-2 mb-4">
                    <Icon className="w-5 h-5 text-foreground" />
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">{heading}</h2>
                </div>
            ) : null}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                {loading ? (
                    <div className="divide-y divide-border">
                        {Array.from({ length: limit || 5 }).map((_, i) => (
                            <div key={i} className="h-14 bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : entries.length === 0 ? (
                    <div className="p-6 text-sm text-muted-foreground text-center">
                        No leaderboard data yet.
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {entries.map((entry, i) => (
                            <li key={`${entry.username}-${i}`} className="flex items-center gap-4 p-3">
                                <div
                                    className={`w-8 text-center font-bold text-lg ${
                                        rankColors[i] || "text-muted-foreground"
                                    }`}
                                >
                                    #{i + 1}
                                </div>
                                <div className="w-9 h-9 rounded-full bg-muted flex-shrink-0 overflow-hidden">
                                    {entry.avatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={entry.avatar}
                                            alt={entry.username}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : null}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">
                                        {entry.username}
                                    </p>
                                </div>
                                <div className="text-right font-semibold text-foreground">
                                    {entry.value}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}

const LeaderboardTop: ComponentConfig<LeaderboardTopProps> = {
    fields: {
        limit: { type: "number", label: "Number of users", min: 1, max: 25 },
        type: {
            type: "select",
            label: "Leaderboard type",
            options: [
                { label: "Top buyers", value: "buyers" },
                { label: "Top voters", value: "voters" },
                { label: "Most active", value: "forum" },
            ],
        },
        heading: { type: "text", label: "Section heading" },
    },
    defaultProps: {
        limit: 5,
        type: "buyers",
        heading: "Top Players",
    },
    render: LeaderboardTopRender,
};

export default LeaderboardTop;
