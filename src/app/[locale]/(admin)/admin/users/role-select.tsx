"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

interface Role {
    id: string;
    name: string;
    displayName: string;
}

interface UserRoleSelectProps {
    userId: string;
    currentRoleId: string;
    roles: Role[];
}

export function UserRoleSelect({ userId, currentRoleId, roles }: UserRoleSelectProps) {
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

    const currentRole = roles.find((r) => r.id === roleId);
    const roleColor = currentRole?.name === "admin"
        ? "border-red-200 bg-red-50"
        : currentRole?.name === "moderator"
            ? "border-purple-200 bg-purple-50"
            : "border-gray-200 bg-white";

    return (
        <div className="flex items-center gap-2">
            <select
                value={roleId}
                onChange={(e) => handleChange(e.target.value)}
                disabled={saving}
                className={`text-xs px-2 py-1 rounded border ${roleColor} cursor-pointer`}
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
