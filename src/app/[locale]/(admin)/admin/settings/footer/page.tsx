"use client";

import { useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AdminPageHeader } from "@/core/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { LoadFailed } from "@/core/components/ui/load-failed";
import { Textarea } from "@/core/components/ui/textarea";
import { ModuleFooterLinks } from "@/core/generated/module-registry";
import { useAllModules } from "@/core/providers/module-provider";
import { useSettingsLoad } from "@/core/hooks/useSettingsLoad";
import { invalidateSettingsCache } from "@/core/hooks/useSiteSettings";
import { legacyColumns, parseFooterColumns, type FooterColumn } from "@/core/lib/footer-columns";
import { isEnabledIn } from "@/core/lib/module-enabled";
import { writeError } from "@/core/lib/write-result";
import { FooterColumnCard, type DraftColumn } from "./FooterColumnCard";

/**
 * The footer, built rather than typed as JSON.
 *
 * This screen used to be two textareas holding raw arrays of objects, which
 * meant a missing comma emptied a column and nothing said so. It also meant
 * exactly two columns, because the shape was core's: "quick" and "legal".
 *
 * A column is now the operator's - its heading, its links, an icon each, and
 * the module section it adopts. An install arriving here for the first time
 * sees the two columns it already had, read from the old settings, so saving
 * is a change and opening the screen is not.
 */

function toDraft(column: FooterColumn): DraftColumn {
    return {
        title: column.title ?? "",
        titleKey: column.titleKey ?? "",
        section: column.section ?? "",
        links: column.links.map((link) => ({ label: link.label, href: link.href, icon: link.icon ?? "" })),
    };
}

/** What is saved: empty strings become absent rather than empty values. */
function toSaved(column: DraftColumn) {
    return {
        title: column.title.trim() || undefined,
        titleKey: column.title.trim() ? undefined : column.titleKey || undefined,
        section: column.section.trim() || undefined,
        links: column.links
            .filter((link) => link.label.trim() !== "" && link.href.trim() !== "")
            .map((link) => ({
                label: link.label.trim(),
                href: link.href.trim(),
                icon: link.icon.trim() || undefined,
            })),
    };
}

export default function FooterSettingsPage() {
    const t = useTranslations("admin");
    const footerT = useTranslations("footer");
    const moduleStatus = useAllModules();

    const [columns, setColumns] = useState<DraftColumn[]>([]);
    const [about, setAbout] = useState("");
    const [copyright, setCopyright] = useState("");
    const [saving, setSaving] = useState(false);

    const { loading, failed, retry } = useSettingsLoad((settings) => {
        setAbout(typeof settings.footer_about_text === "string" ? settings.footer_about_text : "");
        setCopyright(typeof settings.footer_copyright === "string" ? settings.footer_copyright : "");
        const saved = parseFooterColumns(settings.footer_columns);
        // No override yet: show the two columns the footer is rendering now,
        // so the operator edits real state rather than an empty screen that
        // saving would turn into an empty footer.
        setColumns(
            (saved ?? legacyColumns(settings.footer_quick_links, settings.footer_legal_links)).map(toDraft),
        );
    });

    /** What the installed modules actually declare, offered as suggestions. */
    const sections = [...new Set(
        ModuleFooterLinks
            .filter((fl) => isEnabledIn(moduleStatus, fl.module) && fl.section)
            .map((fl) => fl.section as string),
    )].sort();

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    footer_columns: columns.map(toSaved),
                    footer_about_text: about,
                    footer_copyright: copyright,
                }),
            });
            const wrong = await writeError(res, t("footer_saveFailed"), t);
            if (wrong) {
                toast.error(wrong);
                return;
            }
            invalidateSettingsCache();
            toast.success(t("footer_saved"));
        } catch {
            toast.error(t("footer_saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
        );
    }

    if (failed) {
        return (
            <>
                <AdminPageHeader title={t("footer_title")} description={t("footer_subtitle")} />
                <Card><CardContent><LoadFailed onRetry={retry} /></CardContent></Card>
            </>
        );
    }

    return (
        <>
            <AdminPageHeader
                title={t("footer_title")}
                description={t("footer_subtitle")}
                actions={
                    <Button onClick={save} disabled={saving}>
                        {saving
                            ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t("common_saving")}</>
                            : <><Check className="w-4 h-4" aria-hidden="true" /> {t("footer_save")}</>}
                    </Button>
                }
            />

            <Card className="mb-6">
                <CardHeader><CardTitle>{t("footer_about")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="footer-about">{t("footer_aboutText")}</Label>
                        <Textarea
                            id="footer-about"
                            rows={3}
                            value={about}
                            placeholder={t("footer_aboutTextPlaceholder")}
                            onChange={(event) => setAbout(event.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="footer-copyright">{t("footer_copyright")}</Label>
                        <Input
                            id="footer-copyright"
                            value={copyright}
                            placeholder={t("footer_copyrightPlaceholder")}
                            onChange={(event) => setCopyright(event.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>{t("footer_columns")}</CardTitle>
                    <p className="text-sm text-muted-foreground">{t("footer_columnsHint")}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                    {columns.length === 0 ? (
                        <p className="text-muted-foreground text-sm">{t("footer_noColumns")}</p>
                    ) : (
                        columns.map((column, index) => (
                            <FooterColumnCard
                                key={index}
                                column={column}
                                index={index}
                                total={columns.length}
                                sections={sections}
                                shippedTitle={column.titleKey && footerT.has(column.titleKey)
                                    ? footerT(column.titleKey)
                                    : t("footer_columnTitlePlaceholder")}
                                onChange={(next) => setColumns(columns.map((c, i) => (i === index ? next : c)))}
                                onRemove={() => setColumns(columns.filter((_, i) => i !== index))}
                                onMove={(direction) => {
                                    const to = index + direction;
                                    if (to < 0 || to >= columns.length) return;
                                    const next = [...columns];
                                    [next[index], next[to]] = [next[to], next[index]];
                                    setColumns(next);
                                }}
                            />
                        ))
                    )}
                    <Button
                        variant="outline"
                        onClick={() => setColumns([...columns, { title: "", titleKey: "", section: "", links: [] }])}
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        {t("footer_addColumn")}
                    </Button>
                </CardContent>
            </Card>
        </>
    );
}
