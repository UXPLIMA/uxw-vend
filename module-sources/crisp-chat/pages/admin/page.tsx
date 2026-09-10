"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";
import { WEBSITE_KEY } from "../../lib/embed";

export default function CrispChatSettingsPage() {
    const t = useTranslations("crispChat");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                {
                    key: WEBSITE_KEY,
                    label: t("adm_websiteId"),
                    placeholder: "00000000-0000-0000-0000-000000000000",
                    description: t("adm_websiteIdDesc"),
                },
            ]}
        />
    );
}
