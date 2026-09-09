"use client";

import { useTranslations } from "next-intl";
import { AdminPageHeader } from "@/core/sdk/admin";
import { Card, CardContent } from "@/core/sdk/ui";

export default function ComparisonTablesAdminPage() {
    const t = useTranslations("comparisonTable");
    return (
        <>
            <AdminPageHeader title={t("adm_title")} description={t("adm_subtitle")} />
            <Card>
                <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">{t("adm_hint")}</p>
                </CardContent>
            </Card>
        </>
    );
}
