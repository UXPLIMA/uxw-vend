"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2 } from "lucide-react";

export function ProfileSecurityTab() {
    const [twoFAStep, setTwoFAStep] = useState<"idle" | "setup" | "verify" | "backup">("idle");
    const [qrCode, setQrCode] = useState("");
    const [twoFASecret, setTwoFASecret] = useState("");
    const [twoFAToken, setTwoFAToken] = useState("");
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [twoFAError, setTwoFAError] = useState("");
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [disableToken, setDisableToken] = useState("");
    const [loading, setLoading] = useState(true);

    // Password form
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordSaved, setPasswordSaved] = useState(false);
    const [passwordError, setPasswordError] = useState("");

    useEffect(() => {
        // Check current 2FA status from profile
        fetch("/api/v1/auth/profile")
            .then(r => r.json())
            .then(data => {
                if (data.user) {
                    setTwoFAEnabled(data.user.twoFactorEnabled || false);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingPassword(true);
        setPasswordError("");
        setPasswordSaved(false);

        if (newPassword !== confirmPassword) {
            setPasswordError("Passwords don't match");
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
                setPasswordError(data.error || "Failed to change password");
                return;
            }
            setPasswordSaved(true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setPasswordSaved(false), 3000);
        } catch {
            setPasswordError("Something went wrong");
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

    return (
        <div className="space-y-6">
            {/* 2FA Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Two-Factor Authentication
                        <span className={`text-xs px-2 py-1 rounded ${twoFAEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {twoFAEnabled ? "Enabled" : "Disabled"}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {twoFAError && (
                        <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg mb-4">{twoFAError}</div>
                    )}

                    {!twoFAEnabled && twoFAStep === "idle" && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Add an extra layer of security to your account with a TOTP authenticator app.
                            </p>
                            <Button onClick={async () => {
                                setTwoFAError("");
                                const res = await fetch("/api/v1/auth/two-factor/setup", { method: "POST" });
                                const data = await res.json();
                                if (res.ok) {
                                    setQrCode(data.qrCode);
                                    setTwoFASecret(data.secret);
                                    setTwoFAStep("setup");
                                } else {
                                    setTwoFAError(data.error);
                                }
                            }}>
                                Enable 2FA
                            </Button>
                        </div>
                    )}

                    {twoFAStep === "setup" && (
                        <div className="space-y-4 max-w-sm">
                            <p className="text-sm text-muted-foreground">
                                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                            </p>
                            {qrCode && <img src={qrCode} alt="2FA QR Code" className="mx-auto" />}
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">Or enter this code manually:</p>
                                <code className="text-xs bg-muted px-2 py-1 rounded font-mono select-all">{twoFASecret}</code>
                            </div>
                            <div>
                                <Label>Enter the 6-digit code from your app</Label>
                                <Input
                                    value={twoFAToken}
                                    onChange={(e) => setTwoFAToken(e.target.value)}
                                    placeholder="000000"
                                    className="text-center font-mono text-lg tracking-widest"
                                    maxLength={6}
                                />
                            </div>
                            <Button onClick={async () => {
                                setTwoFAError("");
                                const res = await fetch("/api/v1/auth/two-factor/verify", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ token: twoFAToken }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                    setBackupCodes(data.backupCodes);
                                    setTwoFAEnabled(true);
                                    setTwoFAStep("backup");
                                } else {
                                    setTwoFAError(data.error);
                                }
                            }}>
                                Verify & Enable
                            </Button>
                        </div>
                    )}

                    {twoFAStep === "backup" && (
                        <div className="space-y-4">
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm font-medium text-yellow-800 mb-2">Save your backup codes!</p>
                                <p className="text-xs text-yellow-700 mb-3">
                                    Store these codes in a safe place. Each code can only be used once if you lose access to your authenticator.
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {backupCodes.map((code, i) => (
                                        <code key={i} className="text-sm bg-white px-3 py-1 rounded border font-mono text-center">
                                            {code}
                                        </code>
                                    ))}
                                </div>
                            </div>
                            <Button onClick={() => { setTwoFAStep("idle"); setTwoFAToken(""); }}>
                                I've saved my codes
                            </Button>
                        </div>
                    )}

                    {twoFAEnabled && twoFAStep === "idle" && (
                        <div className="space-y-4 max-w-sm">
                            <p className="text-sm text-muted-foreground">
                                Enter your 2FA code to disable two-factor authentication.
                            </p>
                            <Input
                                value={disableToken}
                                onChange={(e) => setDisableToken(e.target.value)}
                                placeholder="Enter 6-digit code"
                                className="text-center font-mono"
                                maxLength={6}
                            />
                            <Button variant="destructive" onClick={async () => {
                                setTwoFAError("");
                                const res = await fetch("/api/v1/auth/two-factor/disable", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ token: disableToken }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                    setTwoFAEnabled(false);
                                    setDisableToken("");
                                } else {
                                    setTwoFAError(data.error);
                                }
                            }}>
                                Disable 2FA
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Password Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={changePassword} className="space-y-4 max-w-md">
                        {passwordError && (
                            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">{passwordError}</div>
                        )}
                        {passwordSaved && (
                            <div className="p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-lg">Password updated!</div>
                        )}
                        <div>
                            <Label>Current Password</Label>
                            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                        </div>
                        <div>
                            <Label>New Password</Label>
                            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                        </div>
                        <div>
                            <Label>Confirm New Password</Label>
                            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                        </div>
                        <Button type="submit" disabled={savingPassword}>
                            {savingPassword ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Updating...</> : "Change Password"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default ProfileSecurityTab;
