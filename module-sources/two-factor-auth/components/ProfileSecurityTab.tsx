"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { useConfirm } from "@/core/components/ui/confirm-dialog";
import { Loader2, ShieldCheck, ShieldOff, KeyRound, RefreshCw } from "lucide-react";

type Step = "idle" | "setup" | "verify" | "backup" | "regenerated";

export function ProfileSecurityTab() {
    const t = useTranslations("twoFactorAuth");
    const { confirm } = useConfirm();

    const [twoFAStep, setTwoFAStep] = useState<Step>("idle");
    const [qrCode, setQrCode] = useState("");
    const [twoFASecret, setTwoFASecret] = useState("");
    const [twoFAToken, setTwoFAToken] = useState("");
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [twoFAError, setTwoFAError] = useState("");
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [remainingBackupCodes, setRemainingBackupCodes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Disable / regenerate credentials
    const [credentialToken, setCredentialToken] = useState("");
    const [credentialPassword, setCredentialPassword] = useState("");

    // Password form
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordSaved, setPasswordSaved] = useState(false);
    const [passwordError, setPasswordError] = useState("");

    const loadStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/v1/auth/two-factor/status");
            if (res.ok) {
                const data = await res.json();
                setTwoFAEnabled(Boolean(data.enabled));
                setRemainingBackupCodes(Number(data.remainingBackupCodes) || 0);
            }
        } catch {
            // silent — module may not be fully wired, keep defaults
        }
    }, []);

    useEffect(() => {
        loadStatus().finally(() => setLoading(false));
    }, [loadStatus]);

    const resetCredentials = () => {
        setCredentialToken("");
        setCredentialPassword("");
    };

    const startSetup = async () => {
        setTwoFAError("");
        setActionLoading(true);
        try {
            const res = await fetch("/api/v1/auth/two-factor/setup", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setQrCode(data.qrCode);
                setTwoFASecret(data.secret);
                setTwoFAStep("setup");
            } else {
                setTwoFAError(data.error || t("setupError"));
            }
        } catch {
            setTwoFAError(t("setupError"));
        } finally {
            setActionLoading(false);
        }
    };

    const verifyAndEnable = async () => {
        setTwoFAError("");
        setActionLoading(true);
        try {
            const res = await fetch("/api/v1/auth/two-factor/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: twoFAToken }),
            });
            const data = await res.json();
            if (res.ok) {
                setBackupCodes(data.backupCodes || []);
                setTwoFAEnabled(true);
                setRemainingBackupCodes((data.backupCodes || []).length);
                setTwoFAToken("");
                setTwoFAStep("backup");
                toast.success(t("setupSuccess"));
            } else {
                setTwoFAError(data.error || t("verificationFailed"));
            }
        } catch {
            setTwoFAError(t("verificationFailed"));
        } finally {
            setActionLoading(false);
        }
    };

    const regenerateCodes = async () => {
        const ok = await confirm({
            title: t("regenerateCodes"),
            message: t("regenerateWarning"),
            confirmText: t("regenerateCodes"),
            cancelText: t("cancel"),
            variant: "danger",
        });
        if (!ok) return;

        setTwoFAError("");
        setActionLoading(true);
        try {
            const res = await fetch("/api/v1/auth/two-factor/regenerate-codes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password: credentialPassword || undefined,
                    token: credentialToken || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setBackupCodes(data.backupCodes || []);
                setRemainingBackupCodes((data.backupCodes || []).length);
                setTwoFAStep("regenerated");
                resetCredentials();
                toast.success(t("regenerateSuccess"));
            } else {
                setTwoFAError(data.error || t("setupError"));
            }
        } catch {
            setTwoFAError(t("setupError"));
        } finally {
            setActionLoading(false);
        }
    };

    const disable2FA = async () => {
        const ok = await confirm({
            title: t("disable"),
            message: t("disableWarning"),
            confirmText: t("disable"),
            cancelText: t("cancel"),
            variant: "danger",
        });
        if (!ok) return;

        setTwoFAError("");
        setActionLoading(true);
        try {
            const res = await fetch("/api/v1/auth/two-factor/disable", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password: credentialPassword || undefined,
                    token: credentialToken || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setTwoFAEnabled(false);
                setRemainingBackupCodes(0);
                setBackupCodes([]);
                setTwoFAStep("idle");
                resetCredentials();
                toast.success(t("disableSuccess"));
            } else {
                setTwoFAError(data.error || t("verificationFailed"));
            }
        } catch {
            setTwoFAError(t("verificationFailed"));
        } finally {
            setActionLoading(false);
        }
    };

    const copyCodes = async () => {
        try {
            await navigator.clipboard.writeText(backupCodes.join("\n"));
            toast.success(t("codesCopied"));
        } catch {
            toast.error(t("setupError"));
        }
    };

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingPassword(true);
        setPasswordError("");
        setPasswordSaved(false);

        if (newPassword !== confirmPassword) {
            setPasswordError(t.has("passwordMismatch") ? t("passwordMismatch") : "Passwords don't match");
            setSavingPassword(false);
            return;
        }

        try {
            const res = await fetch("/api/v1/auth/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setPasswordError(data.error || t("setupError"));
                return;
            }
            setPasswordSaved(true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setPasswordSaved(false), 3000);
        } catch {
            setPasswordError(t("setupError"));
        } finally {
            setSavingPassword(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto" />
                </CardContent>
            </Card>
        );
    }

    const lowBackupCodes = twoFAEnabled && remainingBackupCodes > 0 && remainingBackupCodes <= 3;

    return (
        <div className="space-y-6">
            {/* 2FA Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            {twoFAEnabled ? (
                                <ShieldCheck className="w-5 h-5 text-green-600" />
                            ) : (
                                <ShieldOff className="w-5 h-5 text-muted-foreground" />
                            )}
                            {t("title")}
                        </span>
                        <span
                            className={`text-xs px-2 py-1 rounded ${
                                twoFAEnabled
                                    ? "bg-green-100 text-green-700"
                                    : "bg-muted text-muted-foreground"
                            }`}
                        >
                            {twoFAEnabled ? t("enabled") : t("disabled")}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {twoFAError && (
                        <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg mb-4">
                            {twoFAError}
                        </div>
                    )}

                    {/* Not enabled, idle state */}
                    {!twoFAEnabled && twoFAStep === "idle" && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">{t("description")}</p>
                            <Button onClick={startSetup} disabled={actionLoading}>
                                {actionLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                {t("enable")}
                            </Button>
                        </div>
                    )}

                    {/* Setup flow */}
                    {twoFAStep === "setup" && (
                        <div className="space-y-4 max-w-sm">
                            <p className="text-sm text-muted-foreground">{t("setupDescription")}</p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {qrCode && <img src={qrCode} alt={t("qrCode")} className="mx-auto" />}
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">{t("manualEntry")}:</p>
                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono select-all">
                                    {twoFASecret}
                                </code>
                            </div>
                            <div>
                                <Label>{t("verificationCodePlaceholder")}</Label>
                                <Input
                                    value={twoFAToken}
                                    onChange={(e) => setTwoFAToken(e.target.value)}
                                    placeholder="000000"
                                    className="text-center font-mono text-lg tracking-widest"
                                    maxLength={6}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={verifyAndEnable} disabled={actionLoading}>
                                    {actionLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : null}
                                    {t("verifyAndEnable")}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setTwoFAStep("idle");
                                        setTwoFAToken("");
                                    }}
                                >
                                    {t("cancel")}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Backup codes shown after setup or regenerate */}
                    {(twoFAStep === "backup" || twoFAStep === "regenerated") && (
                        <div className="space-y-4">
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm font-medium text-yellow-800 mb-2">
                                    {t("backupCodes")}
                                </p>
                                <p className="text-xs text-yellow-700 mb-3">
                                    {t("backupCodesDescription")}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {backupCodes.map((code, i) => (
                                        <code
                                            key={i}
                                            className="text-sm bg-card px-3 py-1 rounded border font-mono text-center"
                                        >
                                            {code}
                                        </code>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={copyCodes}>{t("copyCodes")}</Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setTwoFAStep("idle");
                                        setBackupCodes([]);
                                    }}
                                >
                                    {t("done")}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Enabled idle state — management */}
                    {twoFAEnabled && twoFAStep === "idle" && (
                        <div className="space-y-5">
                            <div
                                className={`flex items-center gap-3 p-3 rounded-lg border ${
                                    lowBackupCodes
                                        ? "bg-amber-50 border-amber-200 text-amber-800"
                                        : "bg-muted/50 border-border text-foreground"
                                }`}
                            >
                                <KeyRound className="w-5 h-5 flex-shrink-0" />
                                <div className="text-sm">
                                    <p className="font-medium">
                                        {t("remainingBackupCodes", { count: remainingBackupCodes })}
                                    </p>
                                    {lowBackupCodes && (
                                        <p className="text-xs mt-0.5">{t("lowBackupCodesWarning")}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 max-w-md">
                                <p className="text-sm text-muted-foreground">
                                    {t("managementInstructions")}
                                </p>
                                <div>
                                    <Label>{t("verificationCode")}</Label>
                                    <Input
                                        value={credentialToken}
                                        onChange={(e) => setCredentialToken(e.target.value)}
                                        placeholder={t("verificationCodePlaceholder")}
                                        className="text-center font-mono"
                                        maxLength={6}
                                    />
                                </div>
                                <div className="text-center text-xs text-muted-foreground">
                                    {t("or")}
                                </div>
                                <div>
                                    <Label>{t("password")}</Label>
                                    <Input
                                        type="password"
                                        value={credentialPassword}
                                        onChange={(e) => setCredentialPassword(e.target.value)}
                                        placeholder={t("enterPassword")}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2 pt-2">
                                    <Button
                                        onClick={regenerateCodes}
                                        disabled={actionLoading || (!credentialToken && !credentialPassword)}
                                    >
                                        {actionLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        ) : (
                                            <RefreshCw className="w-4 h-4 mr-2" />
                                        )}
                                        {t("regenerateCodes")}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={disable2FA}
                                        disabled={actionLoading || (!credentialToken && !credentialPassword)}
                                    >
                                        {t("disable")}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Password Section */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("password")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={changePassword} className="space-y-4 max-w-md">
                        {passwordError && (
                            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                                {passwordError}
                            </div>
                        )}
                        {passwordSaved && (
                            <div className="p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-lg">
                                {t.has("passwordChanged") ? t("passwordChanged") : "Password changed successfully"}
                            </div>
                        )}
                        <div>
                            <Label>{t.has("currentPassword") ? t("currentPassword") : "Current password"}</Label>
                            <Input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label>{t.has("newPassword") ? t("newPassword") : "New password"}</Label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <div>
                            <Label>{t.has("confirmNewPassword") ? t("confirmNewPassword") : "Confirm new password"}</Label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <Button type="submit" disabled={savingPassword}>
                            {savingPassword ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                t.has("changePassword") ? t("changePassword") : "Change password"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default ProfileSecurityTab;
