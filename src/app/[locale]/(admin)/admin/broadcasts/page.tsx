"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { RichTextEditor } from "@/core/components/ui/rich-text-editor";
import { Send, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { useTranslations, useLocale } from "next-intl";

interface Broadcast {
    id: string;
    subject: string;
    body: string;
    status: string;
    totalCount: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
    completedAt: string | null;
}

export default function BroadcastsPage() {
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("admin");
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [loading, setLoading] = useState(true);
    const [composing, setComposing] = useState(false);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const { confirm } = useConfirm();

    const fetchBroadcasts = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/v1/broadcasts");
            const data = await res.json();
            setBroadcasts(data.broadcasts || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBroadcasts(); }, []);

    const send = async (sendNow: boolean) => {
        if (!subject.trim() || !body.trim()) {
            toast.error(t("broadcasts_subjectRequired"));
            return;
        }
        if (sendNow) {
            const ok = await confirm({
                title: t("broadcasts_sendTitle"),
                message: t("broadcasts_sendConfirm"),
                variant: "danger",
                confirmText: t("broadcasts_sendNow"),
            });
            if (!ok) return;
        }

        setSending(true);
        try {
            const res = await fetch("/api/v1/broadcasts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject,
                    body,
                    filter: { all: true },
                    sendNow,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                toast.success(sendNow ? `Queued for ${data.queuedRecipients} recipients` : "Draft saved");
                setSubject(""); setBody(""); setComposing(false);
                fetchBroadcasts();
            } else {
                toast.error("Failed");
            }
        } finally {
            setSending(false);
        }
    };

    const deleteBroadcast = async (b: Broadcast) => {
        const ok = await confirm({
            title: t("broadcasts_deleteTitle"),
            message: `Delete "${b.subject}"?`,
            variant: "danger",
        });
        if (!ok) return;
        await fetch(`/api/v1/broadcasts/${b.id}`, { method: "DELETE" });
        fetchBroadcasts();
    };

    const queueDraft = async (b: Broadcast) => {
        const ok = await confirm({
            title: t("broadcasts_sendTitle"),
            message: `Queue "${b.subject}" for delivery?`,
            variant: "danger",
            confirmText: "Send",
        });
        if (!ok) return;
        await fetch(`/api/v1/broadcasts/${b.id}`, { method: "POST" });
        fetchBroadcasts();
    };

    const STATUS_BADGE: Record<string, string> = {
        draft: "bg-muted text-muted-foreground",
        queued: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        sending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
        sent: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
        failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("sidebar_broadcasts")}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t.has("settings_broadcastsDesc") ? t("settings_broadcastsDesc") : "Compose and send bulk email to users."}</p>
                </div>
                <Button onClick={() => setComposing(!composing)}>
                    {composing ? t("customizer_cancel") : (t.has("common_new") ? t("common_new") : "New")}
                </Button>
            </div>

            {composing && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{t("broadcasts_newBroadcast")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>{t("broadcasts_subject")}</Label>
                            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("broadcasts_subjectPlaceholder")} />
                        </div>
                        <div>
                            <Label>{t("broadcasts_body")}</Label>
                            <RichTextEditor value={body} onChange={setBody} placeholder="Hello {username}, ..." />
                            <p className="text-xs text-muted-foreground mt-1">{t("broadcasts_usernamePlaceholder")}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => send(false)} disabled={sending}>{t("broadcasts_saveDraft")}</Button>
                            <Button onClick={() => send(true)} disabled={sending}>
                                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                {t("broadcasts_sendNow")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : broadcasts.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">{t("broadcasts_noBroadcasts")}</CardContent></Card>
            ) : (
                <div className="space-y-2">
                    {broadcasts.map((b) => (
                        <Card key={b.id}>
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-medium text-foreground truncate">{b.subject}</h3>
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${STATUS_BADGE[b.status] || ""}`}>
                                            {b.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(b.createdAt).toLocaleString("tr-TR")}
                                        {b.totalCount > 0 && (
                                            <span className="ml-2">
                                                {b.sentCount}/{b.totalCount} sent
                                                {b.failedCount > 0 && <span className="text-destructive"> · {b.failedCount} failed</span>}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    {b.status === "draft" && (
                                        <Button variant="outline" size="sm" onClick={() => queueDraft(b)}>
                                            <Send className="w-3 h-3 mr-1" /> Send
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteBroadcast(b)}>
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </>
    );
}
