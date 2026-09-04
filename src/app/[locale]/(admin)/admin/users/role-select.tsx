"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface Role {
    id: string;
    name: string;
    displayName: string;
    color: string | null;
}

interface UserRoleSelectProps {
    userId: string;
    currentRoleId: string;
    roles: Role[];
}

export function UserRoleSelect({ userId, currentRoleId, roles }: UserRoleSelectProps) {
    const t = useTranslations("admin");
    const [roleId, setRoleId] = useState(currentRoleId);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleChange = async (newRoleId: string) => {
        if (newRoleId === roleId) return;
        setSaving(true);
        setSaved(false);

        try {
            const res = await fetch(`/api/v1/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleId: newRoleId }),
            });

            if (res.ok) {
                setRoleId(newRoleId);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (err) {
            console.error("Failed to update role:", err);
        } finally {
            setSaving(false);
        }
    };

    // The role's own colour, which the admin picks on the roles screen and
    // which the profile page and the user detail page already honour. This
    // control used to paint red for a role named "admin", purple for one named
    // "moderator" and grey for everything else, so a site's custom roles all
    // looked alike and its chosen colours went nowhere.
    const currentRole = roles.find((r) => r.id === roleId);
    const accent = currentRole?.color || null;
    const swatch = accent
        ? { borderColor: accent, backgroundColor: `${accent}14` }
        : undefined;

    return (
        <div className="flex items-center gap-2">
            <select
                value={roleId}
                onChange={(e) => handleChange(e.target.value)}
                disabled={saving}
                aria-label={t("users_role")}
                className={`text-xs px-2 py-1 rounded border cursor-pointer ${accent ? "" : "border-border bg-card"}`}
                style={swatch}
            >
                {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                        {role.displayName}
                    </option>
                ))}
            </select>
            {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            {saved && <Check className="w-3 h-3 text-green-500" />}
        </div>
    );
}
