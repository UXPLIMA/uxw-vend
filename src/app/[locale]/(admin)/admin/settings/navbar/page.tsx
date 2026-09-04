"use client";

import { useState, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Check, Plus, X, Trash2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { invalidateSettingsCache } from "@/core/hooks/useSiteSettings";
import { useTranslations } from "next-intl";
import { ModuleNavLinks } from "@/core/generated/module-registry";
import { useAllModules } from "@/core/providers/module-provider";
import { IconPicker } from "@/core/components/ui/icon-picker";
import { isEnabledIn } from "@/core/lib/module-enabled";

interface NavChild {
    label: string;
    href: string;
}

interface NavLink {
    label: string;
    href: string;
    icon?: string;
    children?: NavChild[];
}

export default function NavbarSettingsPage() {
    const t = useTranslations("admin");
    const moduleStatus = useAllModules();
    const [links, setLinks] = useState<NavLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedDropdown, setExpandedDropdown] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const navLinks = data.settings?.navbar_links;
                if (Array.isArray(navLinks)) {
                    setLinks(navLinks);
                } else {
                    // No override yet - seed the editor with what the navbar is
                    // currently rendering from the module registry, so the
                    // admin sees real state and can edit from there.
                    const registry = ModuleNavLinks
                        .filter(nl => isEnabledIn(moduleStatus, nl.module))
                        .map(nl => ({ label: nl.label, href: nl.href, icon: nl.icon || "" }));
                    setLinks([{ label: "Home", href: "/", icon: "Home" }, ...registry]);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [moduleStatus]);

    const addLink = () => setLinks([...links, { label: "", href: "/", icon: "" }]);
    const addDropdown = () => setLinks([...links, { label: "More", href: "#", icon: "Star", children: [{ label: "", href: "/" }] }]);

    const updateLink = (i: number, field: string, value: string) => {
        setLinks(links.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
    };

    const removeLink = (i: number) => {
        setLinks(links.filter((_, idx) => idx !== i));
        if (expandedDropdown === i) setExpandedDropdown(null);
    };

    const moveLink = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= links.length) return;
        const newLinks = [...links];
        [newLinks[i], newLinks[j]] = [newLinks[j], newLinks[i]];
        setLinks(newLinks);
    };

    const addChild = (i: number) => {
        const newLinks = [...links];
        if (!newLinks[i].children) newLinks[i].children = [];
        newLinks[i].children!.push({ label: "", href: "/" });
        setLinks(newLinks);
    };

    const updateChild = (parentIdx: number, childIdx: number, field: string, value: string) => {
        const newLinks = [...links];
        (newLinks[parentIdx].children![childIdx] as unknown as Record<string, string>)[field] = value;
        setLinks(newLinks);
    };

    const removeChild = (parentIdx: number, childIdx: number) => {
        const newLinks = [...links];
        newLinks[parentIdx].children = newLinks[parentIdx].children!.filter((_, idx) => idx !== childIdx);
        if (newLinks[parentIdx].children!.length === 0) delete newLinks[parentIdx].children;
        setLinks(newLinks);
    };

    const save = async () => {
        setSaving(true);
        const res = await fetch("/api/v1/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ navbar_links: links }),
        });
        if (res.ok) {
            invalidateSettingsCache();
            toast.success(t("navbar_saved"));
        } else {
            toast.error(t("navbar_saveFailed"));
        }
        setSaving(false);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("navbar_title")}</h1>
                <p className="text-muted-foreground">{t("navbar_subtitle")}</p>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>{t("navbar_links")}</CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={addLink}><Plus className="w-4 h-4 mr-1" /> {t("navbar_addLink")}</Button>
                            <Button variant="outline" size="sm" onClick={addDropdown}><Plus className="w-4 h-4 mr-1" /> {t("navbar_addDropdown")}</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {links.map((link, i) => {
                            const isDropdown = link.children && link.children.length > 0;
                            const isExpanded = expandedDropdown === i;

                            return (
                                <div key={i} className="border border-border rounded-lg overflow-hidden">
                                    {/* Main row */}
                                    <div className="flex items-center gap-2 p-3 bg-muted">
                                        <div className="flex flex-col gap-0.5">
                                            <button onClick={() => moveLink(i, -1)} className="text-muted-foreground hover:text-foreground text-xs">▲</button>
                                            <button onClick={() => moveLink(i, 1)} className="text-muted-foreground hover:text-foreground text-xs">▼</button>
                                        </div>
                                        <Input value={link.label} onChange={(e) => updateLink(i, "label", e.target.value)} placeholder={t("navbar_labelPlaceholder")} className="flex-1 min-w-0" />
                                        {!isDropdown && (
                                            <Input value={link.href} onChange={(e) => updateLink(i, "href", e.target.value)} placeholder="/path" className="flex-1 min-w-0" />
                                        )}
                                        <IconPicker
                                            value={link.icon || ""}
                                            onChange={(v) => updateLink(i, "icon", v)}
                                            className="w-48 flex-shrink-0"
                                        />
                                        {isDropdown && (
                                            <Button variant="ghost" size="sm" onClick={() => setExpandedDropdown(isExpanded ? null : i)}>
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                <span className="text-xs ml-1">{link.children!.length}</span>
                                            </Button>
                                        )}
                                        {!isDropdown && (
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                const newLinks = [...links];
                                                newLinks[i].children = [{ label: "", href: "/" }];
                                                newLinks[i].href = "#";
                                                setLinks(newLinks);
                                                setExpandedDropdown(i);
                                            }} title={t("navbar_convertDropdown")}>
                                                <ChevronDown className="w-3 h-3" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => removeLink(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                                    </div>

                                    {/* Dropdown children */}
                                    {isDropdown && isExpanded && (
                                        <div className="border-t border-border p-3 bg-card space-y-2">
                                            <Label className="text-xs text-muted-foreground">{t("navbar_dropdownItems")}</Label>
                                            {link.children!.map((child, j) => (
                                                <div key={j} className="flex items-center gap-2 pl-6">
                                                    <span className="text-muted-foreground">└</span>
                                                    <Input value={child.label} onChange={(e) => updateChild(i, j, "label", e.target.value)} placeholder={t("navbar_subItemPlaceholder")} className="flex-1" />
                                                    <Input value={child.href} onChange={(e) => updateChild(i, j, "href", e.target.value)} placeholder="/path" className="flex-1" />
                                                    <Button variant="ghost" size="sm" onClick={() => removeChild(i, j)}><X className="w-3 h-3 text-destructive" /></Button>
                                                </div>
                                            ))}
                                            <Button variant="ghost" size="sm" className="ml-6" onClick={() => addChild(i)}>
                                                <Plus className="w-3 h-3 mr-1" /> {t("navbar_addSubItem")}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Button onClick={save} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("seo_saving")}</> : <><Check className="w-4 h-4 mr-2" /> {t("navbar_save")}</>}
            </Button>

            <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground space-y-1">
                <p>
                    <strong>{t("navbar_icons")}</strong>{" "}
                    Click the icon field to pick one from the full Lucide set, or search it by name.
                    The same icons are previewed at{" "}
                    <a href="https://lucide.dev/icons" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        lucide.dev/icons <ExternalLink className="w-3 h-3" />
                    </a>
                    {" "}- clear the field for no icon.
                </p>
                <p>
                    <strong>{t("navbar_dropdown")}</strong> Click the &quot;Dropdown&quot; button to add a menu with sub-items. Set href to &quot;#&quot; for dropdown-only items.
                </p>
            </div>
        </>
    );
}
