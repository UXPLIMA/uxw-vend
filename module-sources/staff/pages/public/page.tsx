"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface StaffMember {
    id: string;
    name: string;
    role: string;
    avatar: string | null;
    user: { username: string; avatar: string | null } | null;
}

export default function StaffPage() {
    const t = useTranslations('staff');
    const { data: session } = useSession();
    const [members, setMembers] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [position, setPosition] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch("/api/v1/staff")
            .then((r) => r.json())
            .then((d) => { setMembers(d.members || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const submit = async () => {
        if (!position.trim() || !content.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/v1/staff/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ position: position.trim(), content: content.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || t("applicationError"));
            } else {
                toast.success(t("applicationSent"));
                setPosition("");
                setContent("");
            }
        } catch {
            toast.error(t("applicationError"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle')}</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
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
                                        <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                                            {avatarUrl ? (
                                                <Image src={avatarUrl} alt={member.name} width={80} height={80} className="w-full h-full object-cover" />
                                            ) : (
                                                initial
                                            )}
                                        </div>
                                        <h3 className="font-bold text-foreground">{member.name}</h3>
                                        <p className="text-sm text-blue-600 font-medium">{member.role}</p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                <Card className="max-w-2xl mx-auto mt-12">
                    <CardHeader>
                        <CardTitle>{t("apply")}</CardTitle>
                        <p className="text-sm text-muted-foreground">{t("applyDescription")}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!session?.user ? (
                            <p className="text-center text-muted-foreground py-6">{t("loginToApply")}</p>
                        ) : (
                            <>
                                <div>
                                    <Label htmlFor="apply-position">{t("position")}</Label>
                                    <Input
                                        id="apply-position"
                                        value={position}
                                        onChange={e => setPosition(e.target.value)}
                                        placeholder={t("positionPlaceholder")}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="apply-content">{t("applicationContent")}</Label>
                                    <Textarea
                                        id="apply-content"
                                        rows={6}
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        placeholder={t("applicationContentPlaceholder")}
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={submit} disabled={submitting || !position.trim() || !content.trim()}>
                                        {submitting ? (
                                            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {t("submitting")}</>
                                        ) : (
                                            <><Send className="w-4 h-4 mr-1" /> {t("submit")}</>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </main>

            <Footer />
        </div>
    );
}
