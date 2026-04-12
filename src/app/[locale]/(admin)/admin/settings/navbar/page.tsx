"use client";

import { useState, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Check, Plus, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { invalidateSettingsCache } from "@/core/hooks/useSiteSettings";

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
    const [links, setLinks] = useState<NavLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedDropdown, setExpandedDropdown] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const navLinks = data.settings?.navbar_links;
                if (Array.isArray(navLinks)) setLinks(navLinks);
                else setLinks([
                    { label: "Home", href: "/", icon: "Home" },
                ]);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

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
            toast.success("Navbar saved");
        } else {
            toast.error("Failed to save");
        }
        setSaving(false);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Navbar Editor</h1>
                <p className="text-muted-foreground">Customize navigation links, order, and dropdown menus</p>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Navigation Links</CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={addLink}><Plus className="w-4 h-4 mr-1" /> Link</Button>
                            <Button variant="outline" size="sm" onClick={addDropdown}><Plus className="w-4 h-4 mr-1" /> Dropdown</Button>
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
                                        <Input value={link.label} onChange={(e) => updateLink(i, "label", e.target.value)} placeholder="Label" className="flex-1" />
                                        {!isDropdown && (
                                            <Input value={link.href} onChange={(e) => updateLink(i, "href", e.target.value)} placeholder="/path" className="flex-1" />
                                        )}
                                        <Input value={link.icon || ""} onChange={(e) => updateLink(i, "icon", e.target.value)} placeholder="Icon" className="w-28" />
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
                                            }} title="Convert to dropdown">
                                                <ChevronDown className="w-3 h-3" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => removeLink(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                                    </div>

                                    {/* Dropdown children */}
                                    {isDropdown && isExpanded && (
                                        <div className="border-t border-border p-3 bg-card space-y-2">
                                            <Label className="text-xs text-muted-foreground">Dropdown Items</Label>
                                            {link.children!.map((child, j) => (
                                                <div key={j} className="flex items-center gap-2 pl-6">
                                                    <span className="text-muted-foreground">└</span>
                                                    <Input value={child.label} onChange={(e) => updateChild(i, j, "label", e.target.value)} placeholder="Sub-item label" className="flex-1" />
                                                    <Input value={child.href} onChange={(e) => updateChild(i, j, "href", e.target.value)} placeholder="/path" className="flex-1" />
                                                    <Button variant="ghost" size="sm" onClick={() => removeChild(i, j)}><X className="w-3 h-3 text-destructive" /></Button>
                                                </div>
                                            ))}
                                            <Button variant="ghost" size="sm" className="ml-6" onClick={() => addChild(i)}>
                                                <Plus className="w-3 h-3 mr-1" /> Add Sub-item
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
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save Navbar</>}
            </Button>

            <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                <strong>Icons:</strong> Home, ShoppingCart, MessageSquare, HelpCircle, FileText, Crown, Download, Gift, Star. Leave empty for no icon.
                <br /><strong>Dropdown:</strong> Click the &quot;Dropdown&quot; button to add a menu with sub-items. Set href to &quot;#&quot; for dropdown-only items.
            </div>
        </>
    );
}
