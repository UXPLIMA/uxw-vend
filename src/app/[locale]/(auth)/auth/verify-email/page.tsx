"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { Home, ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/core/components/ui/button";

type Status = "verifying" | "success" | "failed";

export default function VerifyEmailPage() {
    const t = useTranslations("auth");
    const params = useSearchParams();
    const [status, setStatus] = useState<Status>("verifying");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        const token = params.get("token");
        const email = params.get("email");
        if (!token || !email) {
            setStatus("failed");
            setErrorMessage(t("missingToken"));
            return;
        }

        const url = `/api/v1/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
        fetch(url)
            .then(async (res) => {
                if (res.ok) {
                    setStatus("success");
                } else {
                    setStatus("failed");
                    try {
                        const data = await res.json();
                        if (data?.error) setErrorMessage(data.error);
                    } catch { /* ignore */ }
                }
            })
            .catch(() => setStatus("failed"));
    }, [params, t]);

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

                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h1 className="text-xl font-bold text-foreground text-center">{t("verifyTitle")}</h1>
                    </div>

                    <div className="p-6 text-center">
                        {status === "verifying" && (
                            <>
                                <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-3 animate-spin" />
                                <p className="text-muted-foreground">{t("verifyChecking")}</p>
                            </>
                        )}
                        {status === "success" && (
                            <>
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                <h2 className="font-semibold text-foreground mb-2">{t("verifySuccess")}</h2>
                                <p className="text-muted-foreground text-sm mb-4">{t("verifySuccessBody")}</p>
                                <Link href="/profile">
                                    <Button>{t("backToLogin")}</Button>
                                </Link>
                            </>
                        )}
                        {status === "failed" && (
                            <>
                                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                                <h2 className="font-semibold text-foreground mb-2">{t("verifyFailed")}</h2>
                                <p className="text-muted-foreground text-sm mb-4">
                                    {errorMessage || t("verifyFailedBody")}
                                </p>
                                <Link href="/auth/login">
                                    <Button variant="outline">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> {t("backToLogin")}
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
