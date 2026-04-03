"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Plus, X, Trash2, Gift, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/core/lib/utils";

interface GiftCode {
    id: string;
    code: string;
    value: number;
    isRedeemed: boolean;
    redeemedBy: { username: string } | null;
    redeemedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
}

export default function GiftCodesPage() {
    const [codes, setCodes] = useState<GiftCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [value, setValue] = useState("10");
    const [count, setCount] = useState("1");
    const [expiresAt, setExpiresAt] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchCodes = async () => {
        const res = await fetch("/api/v1/gift-codes");
        if (res.ok) { const data = await res.json(); setCodes(data.giftCodes || []); }
        setLoading(false);
    };

    useEffect(() => { fetchCodes(); }, []);

    const generate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const res = await fetch("/api/v1/gift-codes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                value: parseFloat(value),
                count: parseInt(count),
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
            }),
        });
        if (res.ok) {
            const data = await res.json();
            toast.success(`Generated ${data.count} gift codes`);
            setShowForm(false);
            fetchCodes();
        } else toast.error("Failed to generate");
        setSaving(false);
    };

    const deleteCode = async (id: string) => {
        await fetch(`/api/v1/gift-codes/${id}`, { method: "DELETE" });
        fetchCodes();
    };

    const copyCode = (code: string, id: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Gift Codes</h1>
                    <p className="text-muted-foreground">{codes.length} codes total, {codes.filter(c => !c.isRedeemed).length} available</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    {showForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> Generate</>}
                </Button>
            </div>

            {showForm && (
                <Card className="mb-6">
                    <CardHeader><CardTitle>Generate Gift Codes</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={generate} className="space-y-4">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Value ($)</Label>
                                    <Input type="number" step="0.01" min="0.01" value={value} onChange={(e) => setValue(e.target.value)} required />
                                </div>
                                <div>
                                    <Label>Quantity</Label>
                                    <Input type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} required />
                                </div>
                                <div>
                                    <Label>Expires At</Label>
                                    <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                                </div>
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
                                Generate {count} Code{parseInt(count) > 1 ? "s" : ""}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    {codes.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No gift codes yet</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Code</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Value</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Status</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Redeemed By</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {codes.map((code) => (
                                        <tr key={code.id} className="border-b last:border-0 hover:bg-muted/50">
                                            <td className="py-3 px-4">
                                                <code className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{code.code}</code>
                                            </td>
                                            <td className="py-3 px-4 font-medium">{formatCurrency(Number(code.value))}</td>
                                            <td className="py-3 px-4">
                                                <span className={`text-xs px-2 py-1 rounded ${code.isRedeemed ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>
                                                    {code.isRedeemed ? "Redeemed" : "Available"}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground">
                                                {code.redeemedBy?.username || "-"}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => copyCode(code.code, code.id)}>
                                                        {copiedId === code.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteCode(code.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
