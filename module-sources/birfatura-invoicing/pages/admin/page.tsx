"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function BirfaturaSettingsPage() {
    const t = useTranslations("birfaturaInvoicing");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                {
                    key: "birfatura_token",
                    label: t("adm_token"),
                    type: "password",
                    description: t("adm_tokenDesc"),
                },
            ]}
        />
    );
}
