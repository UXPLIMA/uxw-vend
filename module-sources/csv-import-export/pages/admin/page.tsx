"use client";

import { useTranslations } from "next-intl";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/core/sdk/ui";
import { Download } from "lucide-react";
import { AdminPageHeader } from "@/core/sdk/admin";

export default function ExportImportPage() {
    const t = useTranslations("csvImportExport");

    const exportData = (type: string) => {
        window.open(`/api/v1/admin/export?type=${type}`, "_blank");
    };

    return (
        <>
            <AdminPageHeader
                title={t("adm_exportImport")}
                description={t("adm_exportImportSubtitle")}
            />

            {/* Three exports across the card rather than stacked in a
                28rem column: the screen offers one kind of thing three
                times, and a row says that better than a list does. */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Download className="w-4 h-4" /> {t("adm_export")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                    <Button variant="outline" className="w-full justify-start" onClick={() => exportData("products")}>
                        <Download className="w-4 h-4" /> {t("adm_exportProducts")}
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => exportData("orders")}>
                        <Download className="w-4 h-4" /> {t("adm_exportOrders")}
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => exportData("users")}>
                        <Download className="w-4 h-4" /> {t("adm_exportUsers")}
                    </Button>
                </CardContent>
            </Card>
        </>
    );
}
