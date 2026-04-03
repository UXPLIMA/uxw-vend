"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Home, CheckCircle } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { useTranslations } from "next-intl";

export default function ResetPasswordPage() {
    const t = useTranslations('auth');
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";
    const email = searchParams.get("email") || "";

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError(t('passwordsDontMatch'));
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/v1/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || t('genericError'));
                return;
            }

            setSuccess(true);
        } catch {
            setError(t('genericError'));
        } finally {
            setLoading(false);
        }
    };

    if (!token || !email) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
                <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Reset Link</h1>
                    <p className="text-gray-500 mb-4">This password reset link is invalid or has expired.</p>
                    <Link href="/auth/forgot-password">
                        <Button>Request New Link</Button>
                    </Link>
                </div>
            </div>
        );
    }

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
                        <h1 className="text-xl font-bold text-gray-900 text-center">Reset Password</h1>
                        <p className="text-gray-500 text-sm text-center mt-1">Enter your new password</p>
                    </div>

                    <div className="p-6">
                        {success ? (
                            <div className="text-center py-4">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                <h2 className="font-semibold text-gray-900 mb-1">Password Reset!</h2>
                                <p className="text-gray-500 text-sm mb-4">
                                    Your password has been updated successfully.
                                </p>
                                <Link href="/auth/login">
                                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                        {t('signIn')}
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                                        {error}
                                    </div>
                                )}

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
                                        minLength={6}
                                        className="border-gray-200 bg-gray-50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                                        {t('confirmPassword')}
                                    </label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="border-gray-200 bg-gray-50"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                    disabled={loading}
                                >
                                    {loading ? "Resetting..." : "Reset Password"}
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
