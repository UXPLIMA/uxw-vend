"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { Button } from "@/core/components/ui/button";
import { Home } from "lucide-react";
import { useTranslations } from "next-intl";

export default function NotFound() {
    const t = useTranslations("notFound");
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
            <div className="text-center max-w-md">
                <div className="text-[120px] font-black text-muted leading-none select-none mb-4">
                    404
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">{t("title")}</h1>
                <p className="text-muted-foreground mb-8">{t("description")}</p>
                <div className="flex gap-3 justify-center">
                    <Link href="/">
                        <Button>
                            <Home className="w-4 h-4 mr-2" /> {t("goHome")}
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
