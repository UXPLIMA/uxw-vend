"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";
import { DEFAULT_CONNECTION_KEY } from "../../lib/connection";

export default function ExternalDataSettingsPage() {
    const t = useTranslations("externalData");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                {
                    key: DEFAULT_CONNECTION_KEY,
                    label: t("adm_connection"),
                    type: "password",
                    placeholder: "postgres://readonly:...@host:5432/database",
                    description: t("adm_connectionDesc"),
                },
            ]}
        />
    );
}
