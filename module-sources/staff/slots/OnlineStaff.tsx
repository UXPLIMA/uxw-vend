"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

interface StaffMember {
    id: string;
    name: string;
    user?: { username: string; avatar: string | null } | null;
}

/**
 * Slot contribution rendered below the hero banner.
 * Shows a small strip of currently-online staff with avatars.
 * Fetches from the staff module's own public endpoint with ?online=1,
 * which cross-references StaffMember rows with active UserSessions.
 */
export default function OnlineStaff() {
    const [members, setMembers] = useState<StaffMember[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let active = true;
        fetch("/api/v1/staff?online=1")
            .then((r) => (r.ok ? r.json() : { members: [] }))
            .then((d: { members?: StaffMember[] }) => {
                if (!active) return;
                setMembers(d.members || []);
                setLoaded(true);
            })
            .catch(() => { if (active) setLoaded(true); });
        return () => { active = false; };
    }, []);

    if (!loaded || members.length === 0) return null;

    return (
        <div className="container mx-auto px-4 -mt-6 mb-4">
            <div className="bg-card border border-border rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm">
                <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {members.length} staff online
                </span>
                <div className="flex -space-x-2 ml-auto">
                    {members.slice(0, 5).map((m) => {
                        const label = m.user?.username || m.name;
                        const avatar = m.user?.avatar;
                        return (
                            <div
                                key={m.id}
                                className="w-7 h-7 rounded-full border-2 border-background overflow-hidden bg-muted flex items-center justify-center text-xs font-semibold"
                                title={label}
                            >
                                {avatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={avatar} alt={label} className="w-full h-full object-cover" />
                                ) : (
                                    label.slice(0, 1).toUpperCase()
                                )}
                            </div>
                        );
                    })}
                    {members.length > 5 && (
                        <div className="w-7 h-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                            +{members.length - 5}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
