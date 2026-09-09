"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
import { Textarea } from "@/core/components/ui/textarea";
import { localeNames, locales } from "@/core/lib/i18n/config";

/**
 * One string, in every locale the site serves, on one line.
 *
 * Side by side rather than a locale at a time, because the failure this
 * screen exists to prevent is a half translated site: an operator who fixes
 * the English wording and never sees that the Turkish still says the old
 * thing. With both boxes in front of them, leaving one alone is a decision
 * rather than an oversight.
 *
 * What the software ships is printed under a box that no longer matches it,
 * so an operator can see what they are departing from without leaving the
 * screen, and so "restore" has a visible meaning.
 */

export interface EntryLocale {
    value: string | null;
    isCustom: boolean;
    shipped: string | null;
}

export interface Entry {
    module: string;
    namespace: string;
    key: string;
    locales: Record<string, EntryLocale>;
}

interface TranslationEntryProps {
    entry: Entry;
    onSave: (values: Record<string, string>) => Promise<boolean>;
    onRestore: () => Promise<boolean>;
}

function draftOf(entry: Entry): Record<string, string> {
    return Object.fromEntries(locales.map((locale) => [locale, entry.locales[locale]?.value ?? ""]));
}

export function TranslationEntry({ entry, onSave, onRestore }: TranslationEntryProps) {
    const t = useTranslations("admin");
    const [draft, setDraft] = useState(() => draftOf(entry));
    const [busy, setBusy] = useState<"save" | "restore" | null>(null);

    // A page of keys is replaced wholesale when the filter or the page moves,
    // so the boxes follow the row they belong to rather than keeping what was
    // typed into the row that used to be in this position.
    useEffect(() => setDraft(draftOf(entry)), [entry]);

    const saved = draftOf(entry);
    const dirty = locales.some((locale) => draft[locale] !== saved[locale]);
    const edited = locales.some((locale) => entry.locales[locale]?.isCustom);

    const send = async (which: "save" | "restore") => {
        setBusy(which);
        const done = which === "save" ? await onSave(draft) : await onRestore();
        setBusy(null);
        return done;
    };

    return (
        <Card>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <p className="font-mono text-sm break-all">
                            {entry.namespace}.{entry.key}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.module}</p>
                    </div>
                    {edited ? <Badge tone="info">{t("translations_edited")}</Badge> : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    {locales.map((locale) => {
                        const state = entry.locales[locale];
                        const shipped = state?.shipped ?? null;
                        const boxId = `${entry.module}-${entry.namespace}-${entry.key}-${locale}`;
                        return (
                            <div key={locale} className="space-y-1">
                                <label htmlFor={boxId} className="text-xs font-medium text-muted-foreground">
                                    {localeNames[locale]}
                                </label>
                                <Textarea
                                    id={boxId}
                                    rows={2}
                                    value={draft[locale] ?? ""}
                                    placeholder={shipped ?? t("translations_missing")}
                                    onChange={(event) => setDraft({ ...draft, [locale]: event.target.value })}
                                />
                                {shipped !== null && shipped !== (state?.value ?? "") ? (
                                    <p className="text-xs text-muted-foreground break-words">
                                        {t("translations_shipsAs", { value: shipped })}
                                    </p>
                                ) : null}
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-2 justify-end">
                    {edited ? (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => send("restore")}
                        >
                            {busy === "restore" ? (
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                            )}
                            {t("translations_restore")}
                        </Button>
                    ) : null}
                    <Button size="sm" disabled={!dirty || busy !== null} onClick={() => send("save")}>
                        {busy === "save" ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Save className="w-4 h-4" aria-hidden="true" />
                        )}
                        {t("translations_save")}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
