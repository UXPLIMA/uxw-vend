"use client";

import { useState, useEffect, useId, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Loader2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/core/sdk/ui";

interface LinkedAccount {
    id: string;
    provider: string;
    username: string | null;
}

/** Game account provider owned by this module. */
const GAME_PROVIDER = "minecraft";

/**
 * Profile tab for connected accounts.
 *
 * This lives in the module rather than in core because both halves of it are
 * module-owned: the `/api/v1/linked-accounts` endpoint ships here, and the game
 * account it links is this module's concept. Core renders the tab only while
 * this module is enabled, so the tab can no longer appear with nothing behind
 * it.
 */
export function ProfileAccountsTab() {
    const t = useTranslations("playerProfiles");
    const gameUsernameId = useId();

    const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [gameUsername, setGameUsername] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/v1/linked-accounts");
            if (!res.ok) throw new Error(String(res.status));
            const data = (await res.json()) as { accounts?: LinkedAccount[] };
            setAccounts(data.accounts ?? []);
        } catch {
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const unlink = async (account: LinkedAccount) => {
        setBusy(true);
        try {
            const res = await fetch("/api/v1/linked-accounts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: account.provider }),
            });
            if (!res.ok) throw new Error(String(res.status));
            setAccounts((prev) => prev.filter((a) => a.id !== account.id));
        } catch {
            toast.error(t("unlinkError"));
        } finally {
            setBusy(false);
        }
    };

    const linkGameAccount = async () => {
        const name = gameUsername.trim();
        if (!name) return;
        setBusy(true);
        try {
            const res = await fetch("/api/v1/linked-accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: GAME_PROVIDER, providerId: name, username: name }),
            });
            if (!res.ok) throw new Error(String(res.status));
            const data = (await res.json()) as { account: LinkedAccount };
            setAccounts((prev) => [...prev, data.account]);
            setGameUsername("");
        } catch {
            toast.error(t("linkError"));
        } finally {
            setBusy(false);
        }
    };

    const hasGameAccount = accounts.some((a) => a.provider === GAME_PROVIDER);

    return (
        <Card>
            <CardHeader><CardTitle>{t("linkedAccounts")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {accounts.length > 0 ? (
                            <div className="space-y-2 mb-4">
                                {accounts.map((acc) => (
                                    <div key={acc.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <span className="capitalize font-medium">{acc.provider}</span>
                                            {acc.username && <span className="text-sm text-muted-foreground">{acc.username}</span>}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive"
                                            disabled={busy}
                                            onClick={() => unlink(acc)}
                                        >
                                            {t("unlink")}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">{t("noLinkedAccounts")}</p>
                        )}

                        {!hasGameAccount && (
                            <div className="p-4 border border-dashed border-border rounded-lg">
                                <p className="text-sm font-medium mb-2">{t("linkGameAccount")}</p>
                                <div className="flex gap-2">
                                    <Input
                                        id={gameUsernameId}
                                        value={gameUsername}
                                        onChange={(e) => setGameUsername(e.target.value)}
                                        placeholder={t("gameUsername")}
                                        aria-label={t("gameUsername")}
                                    />
                                    <Button size="sm" disabled={busy || !gameUsername.trim()} onClick={linkGameAccount}>
                                        {t("link")}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground">{t("oauthAutoLink")}</p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
