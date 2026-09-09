"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CheckboxField, LoadFailed } from "@/core/sdk/ui";
import { choosableProducts, type RequirementValue } from "./requirement-payload";

/**
 * What has to be bought before this can be, on both product forms.
 *
 * Its own card rather than a row inside the availability one: a schedule says
 * when a product is for sale, this says whether a particular person may buy it
 * at all, and the two answers are given to a shopper in different words.
 *
 * The picker never offers the product being edited. Requiring itself would
 * make it unbuyable by anybody, for ever, and nothing on the page would say
 * why; `requirement-payload.ts` holds that rule and the API drops it again.
 */

interface Props {
    value: RequirementValue;
    onChange: (next: RequirementValue) => void;
    /** The product being edited, or undefined while it does not exist yet. */
    selfId?: string;
    /**
     * The card's own words. A shelf asks the same question as a product - own
     * one of these first - and gets a different answer from a shopper, so it
     * says it in its own words rather than borrowing the product's.
     */
    title?: string;
    hint?: string;
    /** A shelf opens on any one of the list; there is nothing to choose. */
    hideAnySwitch?: boolean;
}

interface Choice {
    id: string;
    name: string;
}

export function RequirementFields({ value, onChange, selfId, title, hint, hideAnySwitch }: Props) {
    const t = useTranslations("store");
    const [products, setProducts] = useState<Choice[]>([]);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const set = (patch: Partial<RequirementValue>) => onChange({ ...value, ...patch });

    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/store/admin/products?limit=200")
            .then((res) => {
                if (!res.ok) throw new Error("load failed");
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                setProducts((data.products ?? []).map((p: Choice) => ({ id: p.id, name: p.name })));
                setFailed(false);
            })
            .catch(() => {
                // Said out loud rather than left as an empty list. A read that
                // failed and a shop with nothing else in it look identical on
                // screen, and only one of them is worth retrying.
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const offered = choosableProducts(products, selfId);
    const toggle = (id: string) =>
        set({
            requiresProductIds: value.requiresProductIds.includes(id)
                ? value.requiresProductIds.filter((chosen) => chosen !== id)
                : [...value.requiresProductIds, id],
        });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title ?? t("adm_requires")}</CardTitle>
                <p className="text-sm text-muted-foreground">{hint ?? t("adm_requiresHint")}</p>
            </CardHeader>
            <CardContent className="space-y-4">
                {failed ? (
                    <LoadFailed onRetry={() => setReloadKey((key) => key + 1)} />
                ) : offered.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("adm_requiresNothingToPick")}</p>
                ) : (
                    <>
                        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                            {offered.map((product) => (
                                <CheckboxField
                                    key={product.id}
                                    id={`requires-${product.id}`}
                                    label={product.name}
                                    checked={value.requiresProductIds.includes(product.id)}
                                    onChange={() => toggle(product.id)}

                                />
                            ))}
                        </div>

                        {!hideAnySwitch && (
                            <CheckboxField
                                id="requiresAny"
                                label={t("adm_requiresAny")}
                                description={t("adm_requiresAnyHint")}
                                checked={value.requiresAny}
                                onChange={(e) => set({ requiresAny: e.target.checked })}
                            />
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
