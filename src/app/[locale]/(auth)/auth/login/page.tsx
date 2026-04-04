"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Home } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { useTranslations } from "next-intl";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleOauthButtons } from "@/core/generated/module-registry";

export default function LoginPage() {
    const router = useRouter();
    const t = useTranslations('auth');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [needs2FA, setNeeds2FA] = useState(false);
    const [twoFactorCode, setTwoFactorCode] = useState("");

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
        <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-12 relative">
            <Link
                href="/"
                className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all"
            >
                <Home className="w-5 h-5" />
            </Link>

            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-3">
                        <span className="font-bold text-2xl text-gray-900">uxwVend</span>
                    </Link>
                </div>

                <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h1 className="text-xl font-bold text-gray-900 text-center">{t('loginTitle')}</h1>
                        <p className="text-gray-500 text-sm text-center mt-1">{t('loginSubtitle')}</p>
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                                    {t('email')}
                                </label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                                    {t('password')}
                                </label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 focus:bg-white"
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
                                        className="border-blue-200 bg-white text-center font-mono text-lg tracking-widest"
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
                                    <div className="w-full border-t border-gray-100" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-gray-400">{t('orContinueWith')}</span>
                                </div>
                            </div>

                            {/* OAuth buttons — from installed modules */}
                            {(() => {
                                const modules = useAllModules();
                                const buttons = ModuleOauthButtons.filter(b => modules[b.module] === true);
                                if (buttons.length === 0) return null;
                                return (
                                    <div className={`grid ${buttons.length === 1 ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
                                        {buttons.map(btn => (
                                            <Button key={btn.id} type="button" variant="outline"
                                                onClick={() => signIn(btn.provider, { callbackUrl: "/" })}
                                                className="border-gray-200 text-gray-700 hover:bg-gray-50">
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
                                );
                            })()}
                        </form>

                        <p className="text-center text-sm text-gray-500 mt-6">
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
