"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
import { IconPicker } from "@/core/components/ui/icon-picker";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";

/**
 * One footer column, as an operator edits it.
 *
 * The section box is the part worth explaining on the screen rather than
 * here: it is how a column adopts the links an installed module contributes.
 * A module names its own section, so the field takes free text and offers
 * what the installed modules actually declare - core has no list of its own
 * to offer, and inventing one would be core knowing module names.
 */

export interface DraftLink {
    label: string;
    href: string;
    icon: string;
}

export interface DraftColumn {
    title: string;
    /** A key into the `footer` catalogue, for a column core seeded. */
    titleKey: string;
    section: string;
    links: DraftLink[];
}

interface FooterColumnCardProps {
    column: DraftColumn;
    index: number;
    total: number;
    sections: string[];
    /** The shipped heading, when this column has never been renamed. */
    shippedTitle: string;
    onChange: (column: DraftColumn) => void;
    onRemove: () => void;
    onMove: (direction: -1 | 1) => void;
}

export function FooterColumnCard({
    column,
    index,
    total,
    sections,
    shippedTitle,
    onChange,
    onRemove,
    onMove,
}: FooterColumnCardProps) {
    const t = useTranslations("admin");

    const patch = (fields: Partial<DraftColumn>) => onChange({ ...column, ...fields });

    const patchLink = (at: number, fields: Partial<DraftLink>) =>
        patch({ links: column.links.map((link, i) => (i === at ? { ...link, ...fields } : link)) });

    const heading = column.title.trim() === "" ? shippedTitle : column.title;
    const listId = `footer-sections-${index}`;

    return (
        <Card>
            <CardContent className="p-4 space-y-4">
                <div className="flex items-end gap-2 flex-wrap">
                    <div className="flex flex-col gap-0.5">
                        <button
                            type="button"
                            aria-label={t("common_moveUp", { label: heading })}
                            disabled={index === 0}
                            onClick={() => onMove(-1)}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-40 text-xs"
                        >
                            <span aria-hidden="true">▲</span>
                        </button>
                        <button
                            type="button"
                            aria-label={t("common_moveDown", { label: heading })}
                            disabled={index === total - 1}
                            onClick={() => onMove(1)}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-40 text-xs"
                        >
                            <span aria-hidden="true">▼</span>
                        </button>
                    </div>
                    <div className="flex-1 min-w-[12rem]">
                        <Label htmlFor={`footer-title-${index}`}>{t("footer_columnTitle")}</Label>
                        <Input
                            id={`footer-title-${index}`}
                            value={column.title}
                            placeholder={shippedTitle}
                            // Typing a heading is the operator saying it in
                            // their own words, so the column stops following
                            // the catalogue. Clearing it hands it back.
                            onChange={(event) => patch({ title: event.target.value })}
                        />
                    </div>
                    <div className="flex-1 min-w-[12rem]">
                        <Label htmlFor={`footer-section-${index}`}>{t("footer_columnSection")}</Label>
                        <Input
                            id={`footer-section-${index}`}
                            list={listId}
                            value={column.section}
                            placeholder={t("footer_columnSectionPlaceholder")}
                            onChange={(event) => patch({ section: event.target.value })}
                        />
                        <datalist id={listId}>
                            {sections.map((section) => (
                                <option key={section} value={section} />
                            ))}
                        </datalist>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onRemove}>
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        {t("footer_removeColumn")}
                    </Button>
                </div>

                <div className="space-y-2">
                    {column.links.map((link, at) => (
                        <div key={at} className="flex items-center gap-2 flex-wrap">
                            <IconPicker
                                value={link.icon}
                                placeholder={t("footer_linkIcon")}
                                onChange={(icon) => patchLink(at, { icon })}
                            />
                            <Input
                                value={link.label}
                                aria-label={t("footer_linkLabel")}
                                placeholder={t("footer_linkLabel")}
                                onChange={(event) => patchLink(at, { label: event.target.value })}
                                className="flex-1 min-w-[10rem]"
                            />
                            <Input
                                value={link.href}
                                aria-label={t("footer_linkHref")}
                                placeholder={t("footer_linkHrefPlaceholder")}
                                onChange={(event) => patchLink(at, { href: event.target.value })}
                                className="flex-1 min-w-[10rem]"
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                aria-label={t("footer_removeLink", { label: link.label || link.href })}
                                onClick={() => patch({ links: column.links.filter((_, i) => i !== at) })}
                            >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </Button>
                        </div>
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => patch({ links: [...column.links, { label: "", href: "/", icon: "" }] })}
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        {t("footer_addLink")}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
