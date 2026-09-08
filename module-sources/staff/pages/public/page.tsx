"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Card, CardContent, LoadFailed } from "@/core/sdk/ui";
import { PageFrame } from "@/core/sdk/layout";
import { Loader2 } from "lucide-react";

interface StaffMember {
    id: string;
    name: string;
    role: string;
    avatar: string | null;
    user: { username: string; avatar: string | null } | null;
}

export default function StaffPage() {
    const t = useTranslations('staff');
    const [members, setMembers] = useState<StaffMember[]>([]);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/staff")
            .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
            .then((d) => { if (cancelled) return; setMembers(d.members || []); setFailed(false); setLoading(false); })
            .catch(() => { if (cancelled) return; setFailed(true); setLoading(false); });
        return () => { cancelled = true; };
    }, [reloadKey]);

    return (
        <PageFrame
            title={t('title')}
            description={t('subtitle')}
        >
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : failed ? (
                <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
            ) : members.length === 0 ? (
                <Card className="max-w-4xl mx-auto"><CardContent className="py-12 text-center text-muted-foreground">{t('empty')}</CardContent></Card>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
                    {members.map((member) => {
                        const avatarUrl = member.avatar || member.user?.avatar;
                        const initial = member.name[0].toUpperCase();

                        return (
                            <Card key={member.id} className="text-center hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                    <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                                        {avatarUrl ? (
                                            <Image src={avatarUrl} alt={member.name} width={80} height={80} className="w-full h-full object-cover" />
                                        ) : (
                                            initial
                                        )}
                                    </div>
                                    <h2 className="font-bold text-foreground">{member.name}</h2>
                                    <p className="text-sm text-primary font-medium">{member.role}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

        </PageFrame>
    );
}
