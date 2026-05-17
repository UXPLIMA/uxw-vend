"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { Button } from "@/core/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AuthErrorPage() {
    const t = useTranslations("auth");
    const searchParams = useSearchParams();
    const errorType = searchParams.get("error") || "Default";

    const message = (() => {
        switch (errorType) {
            case "Configuration": return t("errorConfiguration");
            case "AccessDenied": return t("errorAccessDenied");
            case "Verification": return t("errorVerification");
            case "OAuthAccountNotLinked":
                return t.has("errorOAuthAccountNotLinked")
                    ? t("errorOAuthAccountNotLinked")
                    : "This email is already associated with another account. Sign in with the original provider.";
            default: return t("errorDefault");
        }
    })();

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted px-4">
            <div className="max-w-md w-full text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">{t("errorTitle")}</h1>
                <p className="text-muted-foreground mb-8">{message}</p>
                <div className="flex gap-3 justify-center">
                    <Link href="/auth/login">
                        <Button>{t("errorTryAgain")}</Button>
                    </Link>
                    <Link href="/">
                        <Button variant="outline">{t("errorGoHome")}</Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
