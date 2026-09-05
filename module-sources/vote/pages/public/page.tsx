"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, LoadFailed } from "@/core/sdk/ui";
import { Footer, Navbar } from "@/core/sdk/layout";
import { ThemeComponentSlot } from "@/core/sdk/theme";
import { Loader2, ExternalLink, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

interface VoteSite {
    id: string;
    name: string;
    url: string;
    icon: string | null;
    _count: { votes: number };
}

/**
 * The page used to have two buttons per site: "Vote Now", which opened the
 * listing, and "Claim Reward", which paid credits into the voter's balance.
 * There is no reward any more - the module points players at the listings the
 * server is ranked on and counts who went. So there is one button: it opens
 * the listing and records the vote in the same click, because asking someone
 * to come back and press a second button to be counted is how a vote count
 * ends up wrong.
 */

export default function VotePage() {
    const { data: session } = useSession();
    const t = useTranslations("vote");
    const [sites, setSites] = useState<VoteSite[]>([]);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/vote/sites")
            .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
            .then((d) => { if (cancelled) return; setSites(d.sites || []); setFailed(false); setLoading(false); })
            .catch(() => { if (cancelled) return; setFailed(true); setLoading(false); });
        return () => { cancelled = true; };
    }, [reloadKey]);

    const vote = async (site: VoteSite) => {
        // The listing opens either way: a signed-out visitor, a site already
        // voted on today, a failed write - none of them is a reason to keep
        // someone from voting.
        window.open(site.url, "_blank", "noopener,noreferrer");
        if (!session?.user) return;
        setVoting(site.id);
        try {
            const res = await fetch("/api/v1/vote/record", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ voteSiteId: site.id }),
            });
            if (res.ok) toast.success(t("voteRecorded"));
            else toast.error((await res.json()).error || t("alreadyVoted"));
        } catch {
            toast.error(t("alreadyVoted"));
        } finally {
            setVoting(null);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">{t("title")}</h1>
                    <p className="text-muted-foreground">{t("description")}</p>
                    {!session?.user && (
                        <p className="mt-2 text-sm text-muted-foreground">{t("loginToVote")}</p>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : failed ? (
                    <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
                ) : sites.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">{t("noSites")}</CardContent></Card>
                ) : (
                    <div className="space-y-3">
                        {sites.map((site) => (
                            <Card key={site.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <ThumbsUp className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="font-medium truncate">{site.name}</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {site._count.votes} {t("totalVotes").toLowerCase()}
                                        </p>
                                    </div>
                                    <Button size="sm" onClick={() => vote(site)} disabled={voting === site.id}>
                                        {voting === site.id
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <ExternalLink className="w-3 h-3 mr-1" />}
                                        {t("voteNow")}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
