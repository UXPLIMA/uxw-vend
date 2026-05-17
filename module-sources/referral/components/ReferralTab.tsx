"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Loader2, UserPlus, Users, Coins, Copy, Check } from "lucide-react";
import { toast } from "sonner";

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
        status: string;
        rewardAmount: number;
        createdAt: string;
    }[];
}

export function ReferralTab() {
    const [data, setData] = useState<ReferralData | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetch("/api/v1/referral")
            .then(r => r.json())
            .then(d => setData(d))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const copyLink = () => {
        if (!data) return;
        const link = `${window.location.origin}?ref=${data.referralCode}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!data) {
        return (
            <p className="text-center text-muted-foreground py-8">
                Failed to load referral data
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {/* Referral Link */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Your Referral Link
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input
                            readOnly
                            value={`${typeof window !== "undefined" ? window.location.origin : ""}?ref=${data.referralCode}`}
                            className="font-mono text-xs"
                        />
                        <Button onClick={copyLink} variant="outline" size="sm">
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
                <Card>
                    <CardContent className="p-3 text-center">
                        <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{data.stats.totalReferrals}</p>
                        <p className="text-xs text-muted-foreground">Referrals</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 text-center">
                        <Check className="w-5 h-5 text-green-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{data.stats.completedReferrals}</p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 text-center">
                        <Coins className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                        <p className="text-lg font-bold">{(Number(data.stats.creditsEarned) || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Credits</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Referrals */}
            {data.referrals.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Recent Referrals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {data.referrals.slice(0, 5).map(ref => (
                                <div key={ref.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                    <div>
                                        <p className="text-sm font-medium">{ref.username || "Unknown"}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(ref.createdAt).toLocaleDateString("tr-TR")}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            ref.status === "rewarded" ? "bg-green-100 text-green-700" :
                                            ref.status === "completed" ? "bg-blue-100 text-blue-700" :
                                            "bg-yellow-100 text-yellow-700"
                                        }`}>
                                            {ref.status}
                                        </span>
                                        <p className="text-xs text-muted-foreground mt-1">{(Number(ref.rewardAmount) || 0).toFixed(2)} credits</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
