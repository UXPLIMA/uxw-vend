"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Home } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { useTranslations } from "next-intl";

export default function LoginPage() {
    const router = useRouter();
    const t = useTranslations('auth');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError(t('invalidCredentials'));
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

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => signIn("discord", { callbackUrl: "/" })}
                                    className="border-gray-200 text-gray-700 hover:bg-gray-50"
                                >
                                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="#5865F2">
                                        <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
                                    </svg>
                                    Discord
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => signIn("google", { callbackUrl: "/" })}
                                    className="border-gray-200 text-gray-700 hover:bg-gray-50"
                                >
                                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Google
                                </Button>
                            </div>
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
