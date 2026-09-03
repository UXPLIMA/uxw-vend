"use client";

import { useTranslations } from "next-intl";
import { SettingsForm } from "@/core/sdk/admin";

export default function MinecraftLinkSettingsPage() {
    const t = useTranslations("minecraftLink");
    return (
        <SettingsForm
            title={t("adm_title")}
            subtitle={t("adm_subtitle")}
            fields={[
                {
                    key: "minecraft_link_whisper_command",
                    label: t("adm_field1Label"),
                    placeholder: "tell {player} {message}",
                    description: t("adm_field1Desc"),
                },
            ]}
        />
    );
}
