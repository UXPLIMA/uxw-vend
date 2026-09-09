"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function CreditsSettingsPage() {
    const t = useTranslations("credits");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                {
                    key: "credits_cashback_percent",
                    label: t("adm_cashback"),
                    placeholder: "5",
                    description: t("adm_cashbackDesc"),
                },
            ]}
        />
    );
}
