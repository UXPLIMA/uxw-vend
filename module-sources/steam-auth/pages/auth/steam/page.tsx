"use client";

/**
 * The last step of Steam sign-in.
 *
 * Steam's callback is a GET redirect, which cannot mint a session, so it left
 * a single-use ticket in the query string. This page trades it for a real
 * Auth.js sign-in and then gets out of the way. It renders a spinner because
 * it exists for a fraction of a second.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/core/sdk/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

export default function SteamSignInPage() {
    const t = useTranslations("steamAuth");
    const params = useSearchParams();
    const router = useRouter();
    const [failed, setFailed] = useState(false);
    // React runs effects twice in development. The ticket works exactly once,
    // so a second run would redeem nothing and report a failed sign-in.
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        const ticket = params.get("ticket");
        if (!ticket) {
            setFailed(true);
            return;
        }

        signIn("steam", { ticket, redirect: false })
            .then((result) => {
                if (result?.ok) router.replace("/");
                else setFailed(true);
            })
            .catch(() => setFailed(true));
    }, [params, router]);

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
            {failed ? (
                <>
                    <h1 className="text-destructive">{t("signInFailed")}</h1>
                    <button
                        type="button"
                        onClick={() => router.replace("/auth/login")}
                        className="text-sm text-primary hover:underline"
                    >
                        {t("backToLogin")}
                    </button>
                </>
            ) : (
                <>
                    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <h1 className="text-muted-foreground">{t("signingIn")}</h1>
                </>
            )}
        </div>
    );
}
