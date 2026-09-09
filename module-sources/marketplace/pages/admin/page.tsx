"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function MarketplaceSettingsPage() {
    const t = useTranslations("marketplace");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                {
                    key: "marketplace_commission_percent",
                    label: t("adm_commission"),
                    placeholder: "10",
                    description: t("adm_commissionDesc"),
                },
            ]}
        />
    );
}
