"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, Input, Label, NativeSelect } from "@/core/sdk/ui";
import { useRoles } from "./use-roles";
import type { GrantValue } from "./grant-payload";

/**
 * What buying a product gives, on one card, on both product forms.
 *
 * Two questions that read alike and are not: `AvailabilityFields` asks who may
 * buy a product, this asks what buying it hands over. Keeping them on separate
 * cards is the only thing that stops an operator setting one when they meant
 * the other, because the two role pickers would otherwise sit inches apart
 * with almost the same label.
 *
 * The value and what it sends live in `grant-payload.ts`: that half is pure
 * and is where the empty-means-no-rule mapping is pinned.
 */

interface Props {
    value: GrantValue;
    onChange: (next: GrantValue) => void;
}

export function GrantFields({ value, onChange }: Props) {
    const t = useTranslations("store");
    const roles = useRoles();
    const set = (patch: Partial<GrantValue>) => onChange({ ...value, ...patch });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("adm_whatItGrants")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("adm_whatItGrantsHint")}</p>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label htmlFor="durationDays">{t("adm_durationDays")}</Label>
                    <Input
                        id="durationDays"
                        type="number"
                        min={1}
                        max={3650}
                        value={value.durationDays}
                        onChange={(e) => set({ durationDays: e.target.value })}
                        placeholder={t("adm_durationForever")}
                    />
                    <p className="mt-1 text-sm text-muted-foreground">{t("adm_durationHint")}</p>
                </div>

                <div>
                    <Label htmlFor="grantsRoleId">{t("adm_grantsRole")}</Label>
                    <NativeSelect
                        id="grantsRoleId"
                        value={value.grantsRoleId}
                        onChange={(e) => set({ grantsRoleId: e.target.value })}
                    >
                        <option value="">{t("adm_grantsNoRole")}</option>
                        {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                                {role.displayName || role.name}
                            </option>
                        ))}
                    </NativeSelect>
                    <p className="mt-1 text-sm text-muted-foreground">{t("adm_grantsRoleHint")}</p>
                </div>
            </CardContent>
        </Card>
    );
}
