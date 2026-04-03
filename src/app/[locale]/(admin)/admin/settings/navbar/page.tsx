"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { ArrowLeft, Loader2, Check, Plus, X, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface NavLink {
    label: string;
    href: string;
    icon?: string;
}

export default function NavbarSettingsPage() {
    const [links, setLinks] = useState<NavLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/v1/settings")
            .then((r) => r.json())
            .then((data) => {
                const s = data.settings || {};
                const navLinks = s.navbar_links;
                if (Array.isArray(navLinks)) {
                    setLinks(navLinks);
                } else {
                    // Default links
                    setLinks([
                        { label: "Home", href: "/", icon: "Home" },
                        { label: "Store", href: "/store", icon: "ShoppingCart" },
                        { label: "Forum", href: "/forum", icon: "MessageSquare" },
                        { label: "Support", href: "/support", icon: "HelpCircle" },
                    ]);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const addLink = () => {
        setLinks([...links, { label: "", href: "/", icon: "" }]);
    };

    const updateLink = (i: number, field: keyof NavLink, value: string) => {
        setLinks(links.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
    };

    const removeLink = (i: number) => {
        setLinks(links.filter((_, idx) => idx !== i));
    };

    const moveLink = (i: number, dir: -1 | 1) => {
        const newLinks = [...links];
        const j = i + dir;
        if (j < 0 || j >= newLinks.length) return;
        [newLinks[i], newLinks[j]] = [newLinks[j], newLinks[i]];
        setLinks(newLinks);
    };

    const save = async () => {
        setSaving(true);
        const res = await fetch("/api/v1/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ navbar_links: links }),
        });
        if (res.ok) toast.success("Navbar saved");
        else toast.error("Failed to save");
        setSaving(false);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/settings"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
                <div>
                    <h1 className="text-3xl font-bold">Navbar Editor</h1>
                    <p className="text-muted-foreground">Customize navigation menu links and order</p>
                </div>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Navigation Links</CardTitle>
                        <Button variant="outline" size="sm" onClick={addLink}><Plus className="w-4 h-4 mr-1" /> Add Link</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {links.map((link, i) => (
                            <div key={i} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                                <div className="flex flex-col gap-0.5">
                                    <button onClick={() => moveLink(i, -1)} className="text-muted-foreground hover:text-foreground text-xs">▲</button>
                                    <button onClick={() => moveLink(i, 1)} className="text-muted-foreground hover:text-foreground text-xs">▼</button>
                                </div>
                                <Input value={link.label} onChange={(e) => updateLink(i, "label", e.target.value)} placeholder="Label" className="flex-1" />
                                <Input value={link.href} onChange={(e) => updateLink(i, "href", e.target.value)} placeholder="/path" className="flex-1" />
                                <Input value={link.icon || ""} onChange={(e) => updateLink(i, "icon", e.target.value)} placeholder="Icon name" className="w-32" />
                                <Button variant="ghost" size="sm" onClick={() => removeLink(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Button onClick={save} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save Navbar</>}
            </Button>

            <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                <strong>Icons:</strong> Home, ShoppingCart, MessageSquare, HelpCircle, FileText, Crown, Download, Gift, Star. Leave empty for no icon.
            </div>
        </>
    );
}
