"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Loader2, UserPlus, Users, Coins, Clock, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface ReferralData {
    referralCode: string;
    stats: {
        totalReferrals: number;
        completedReferrals: number;
        pendingReferrals: number;
        creditsEarned: number;
    };
    referrals: {
        id: string;
        username: string;
        image: string | null;
        status: string;
        rewardAmount: number;
        createdAt: string;
    }[];
}

export default function ReferralPage() {
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const t = useTranslations("referral");
    const { data: session } = useSession();
    const [data, setData] = useState<ReferralData | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [referralCodeInput, setReferralCodeInput] = useState("");
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        if (!session?.user) {
            setLoading(false);
            return;
        }
        fetch("/api/v1/referral")
            .then(r => r.json())
            .then(d => setData(d))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [session]);

    const copyLink = async () => {
        if (!data) return;
        const link = `${typeof window !== "undefined" ? window.location.origin : ""}?ref=${data.referralCode}`;
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                await navigator.clipboard.writeText(link);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = link;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
            }
            setCopied(true);
            toast.success(t("linkCopied"));
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error(t("copyFailed"));
        }
    };

    const applyCode = async () => {
        if (!referralCodeInput.trim()) return;
        setApplying(true);
        try {
            const res = await fetch("/api/v1/referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ referralCode: referralCodeInput.trim() }),
            });
            const result = await res.json();
            if (res.ok) {
                toast.success(result.message || t("codeApplied"));
                setReferralCodeInput("");
            } else {
                toast.error(result.error || t("codeError"));
            }
        } catch {
            toast.error(t("somethingWrong"));
        } finally {
            setApplying(false);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case "rewarded": return "bg-green-100 text-green-700";
            case "completed": return "bg-blue-100 text-blue-700";
            default: return "bg-yellow-100 text-yellow-700";
        }
    };

    const statusLabel = (status: string) => {
        if (status === "rewarded") return t("rewarded");
        if (status === "completed") return t("completed");
        return t("pending");
    };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-4xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-foreground mb-2">{t("title")}</h1>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : !session?.user ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">{t("notLoggedIn")}</p>
                        </CardContent>
                    </Card>
                ) : !data ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            {t("failedToLoad")}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {/* Referral Link */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserPlus className="w-5 h-5" />
                                    {t("yourLink")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-3">
                                    {t("shareMessage")}
                                </p>
                                <div className="flex gap-2">
                                    <Input
                                        readOnly
                                        value={`${typeof window !== "undefined" ? window.location.origin : ""}?ref=${data.referralCode}`}
                                        className="font-mono text-sm"
                                    />
                                    <Button onClick={copyLink} variant="outline">
                                        {copied ? (
                                            <><Check className="w-4 h-4 mr-1" /> {t("copied")}</>
                                        ) : (
                                            <><Copy className="w-4 h-4 mr-1" /> {t("copyLink")}</>
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {t("yourCode")}: <span className="font-mono font-bold">{data.referralCode}</span>
                                </p>
                            </CardContent>
                        </Card>

                        {/* Apply Referral Code */}
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("haveCode")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder={t("codePlaceholder")}
                                        value={referralCodeInput}
                                        onChange={e => setReferralCodeInput(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && applyCode()}
                                    />
                                    <Button onClick={applyCode} disabled={applying || !referralCodeInput.trim()}>
                                        {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : t("applyCode")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card>
                                <CardContent className="p-4 text-center">
                                    <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                                    <p className="text-2xl font-bold">{data?.stats?.totalReferrals ?? 0}</p>
                                    <p className="text-xs text-muted-foreground">{t("totalReferrals")}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4 text-center">
                                    <Check className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                    <p className="text-2xl font-bold">{data?.stats?.completedReferrals ?? 0}</p>
                                    <p className="text-xs text-muted-foreground">{t("completedReferrals")}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4 text-center">
                                    <Clock className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                                    <p className="text-2xl font-bold">{data?.stats?.pendingReferrals ?? 0}</p>
                                    <p className="text-xs text-muted-foreground">{t("pendingReferrals")}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4 text-center">
                                    <Coins className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-2xl font-bold">{(data?.stats?.creditsEarned ?? 0).toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground">{t("creditsEarned")}</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Referral History */}
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("referralHistory")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {data.referrals.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">
                                        {t("noReferrals")}
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border">
                                                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">{t("user")}</th>
                                                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">{t("status")}</th>
                                                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">{t("reward")}</th>
                                                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">{t("date")}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.referrals.map(ref => (
                                                    <tr key={ref.id} className="border-b border-border last:border-0">
                                                        <td className="py-3 px-2 font-medium">{ref.username || t("unknownUser")}</td>
                                                        <td className="py-3 px-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(ref.status)}`}>
                                                                {statusLabel(ref.status)}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-2">{ref.rewardAmount.toFixed(2)} {t("creditsUnit")}</td>
                                                        <td className="py-3 px-2 text-muted-foreground">
                                                            {new Date(ref.createdAt).toLocaleDateString(__dateTag)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
