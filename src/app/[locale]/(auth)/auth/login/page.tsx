"use client";

import { useEffect, useState } from "react";
import { Link, useRouter } from "@/core/lib/i18n/navigation";
import { signIn } from "next-auth/react";
import { Home, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { useTranslations } from "next-intl";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleOauthButtons } from "@/core/generated/module-registry";

const DEMO_EMAIL = "admin@example.com";
const DEMO_PASSWORD = "password123";

export default function LoginPage() {
    const router = useRouter();
    const t = useTranslations('auth');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [needs2FA, setNeeds2FA] = useState(false);
    const [isDemo, setIsDemo] = useState(false);
    const allModules = useAllModules();
    const oauthButtons = ModuleOauthButtons.filter(b => allModules[b.module] === true);
    const [twoFactorCode, setTwoFactorCode] = useState("");

    useEffect(() => {
        fetch("/api/v1/public-settings")
            .then((r) => r.json())
            .then((d) => { if (d?.isDemo) setIsDemo(true); })
            .catch(() => undefined);
    }, []);

    const fillDemo = () => {
        setEmail(DEMO_EMAIL);
        setPassword(DEMO_PASSWORD);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                twoFactorCode: needs2FA ? twoFactorCode : "",
                redirect: false,
            });

            if (result?.error) {
                if (result.error.includes("2FA_REQUIRED")) {
                    setNeeds2FA(true);
                    setError("");
                } else if (result.error.includes("INVALID_2FA")) {
                    setError("Invalid 2FA code");
                } else if (result.error.includes("BANNED")) {
                    setError("Your account has been suspended");
                } else {
                    setError(t('invalidCredentials'));
                }
            } else {
                // If a non-TOTP (backup) code was used, warn about remaining codes.
                const submittedCode = needs2FA ? twoFactorCode.trim() : "";
                const looksLikeBackupCode = submittedCode.length > 0 && !/^\d{6}$/.test(submittedCode);
                if (looksLikeBackupCode) {
                    try {
                        const statusRes = await fetch("/api/v1/auth/two-factor/status");
                        if (statusRes.ok) {
                            const status = await statusRes.json();
                            const remaining = Number(status?.remainingBackupCodes) || 0;
                            if (remaining <= 3) {
                                toast.warning(`${remaining} backup codes remaining — regenerate at /profile if low`);
                            } else {
                                toast.info(`${remaining} backup codes remaining — regenerate at /profile if low`);
                            }
                        }
                    } catch {
                        // silent — not critical
                    }
                }
                router.push("/");
                router.refresh();
            }
        } catch {
            setError(t('genericError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12 relative">
            <Link
                href="/"
                className="absolute top-6 left-6 w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:border-blue-300 transition-all"
            >
                <Home className="w-5 h-5" />
            </Link>

            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-3">
                        <span className="font-bold text-2xl text-foreground">uxwVend</span>
                    </Link>
                </div>

                {isDemo && (
                    <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground">Demo account</p>
                                <p className="text-muted-foreground mt-1">
                                    Email: <code className="text-foreground font-mono">{DEMO_EMAIL}</code>
                                    <br />
                                    Password: <code className="text-foreground font-mono">{DEMO_PASSWORD}</code>
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Some destructive actions are disabled in demo mode.
                                </p>
                                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={fillDemo}>
                                    Fill demo credentials
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h1 className="text-xl font-bold text-foreground text-center">{t('loginTitle')}</h1>
                        <p className="text-muted-foreground text-sm text-center mt-1">{t('loginSubtitle')}</p>
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium text-foreground">
                                    {t('email')}
                                </label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary focus:bg-card"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium text-foreground">
                                    {t('password')}
                                </label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary focus:bg-card"
                                />
                            </div>

                            {needs2FA && (
                                <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <label htmlFor="twoFactorCode" className="text-sm font-medium text-blue-700">
                                        Two-Factor Authentication Code
                                    </label>
                                    <Input
                                        id="twoFactorCode"
                                        type="text"
                                        placeholder="Enter 6-digit code or backup code"
                                        value={twoFactorCode}
                                        onChange={(e) => setTwoFactorCode(e.target.value)}
                                        autoFocus
                                        className="border-blue-200 bg-card text-center font-mono text-lg tracking-widest"
                                        maxLength={10}
                                    />
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Link href="/auth/forgot-password" className="text-xs text-blue-600 hover:underline">
                                    {t('forgotPassword')}
                                </Link>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-sm"
                                disabled={loading}
                            >
                                {loading ? t('signingIn') : t('signIn')}
                            </Button>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">{t('orContinueWith')}</span>
                                </div>
                            </div>

                            {/* OAuth buttons — from installed modules */}
                            {oauthButtons.length > 0 && (
                                    <div className={`grid ${oauthButtons.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
                                        {oauthButtons.map(btn => (
                                            <Button key={btn.id} type="button" variant="outline"
                                                onClick={() => signIn(btn.provider, { callbackUrl: "/" })}
                                                className="border-border text-foreground hover:bg-muted">
                                                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill={btn.color}>
                                                    {btn.svgIcon.includes("|")
                                                        ? btn.svgIcon.split("|").map((d: string, i: number) => <path key={i} d={d} />)
                                                        : <path d={btn.svgIcon} />
                                                    }
                                                </svg>
                                                {btn.label}
                                            </Button>
                                        ))}
                                    </div>
                            )}
                        </form>

                        <p className="text-center text-sm text-muted-foreground mt-6">
                            {t('noAccount')}{" "}
                            <Link href="/auth/register" className="text-blue-600 hover:underline font-medium">
                                {t('signUp')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
