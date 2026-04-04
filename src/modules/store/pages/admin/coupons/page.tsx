"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Plus, X, Trash2, Tag } from "lucide-react";
import { formatCurrency } from "@/core/lib/utils";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface Coupon {
    id: string;
    code: string;
    description: string | null;
    type: "PERCENTAGE" | "FIXED";
    value: number;
    minPurchase: number | null;
    maxDiscount: number | null;
    usageLimit: number | null;
    usageCount: number;
    startsAt: string | null;
    expiresAt: string | null;
    isActive: boolean;
}

export default function AdminCouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { confirm } = useConfirm();

    const [form, setForm] = useState({
        code: "",
        description: "",
        type: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
        value: "",
        minPurchase: "",
        maxDiscount: "",
        usageLimit: "",
        expiresAt: "",
        isActive: true,
    });

    const fetchCoupons = async () => {
        try {
            const res = await fetch("/api/v1/store/coupons");
            if (res.ok) {
                const data = await res.json();
                setCoupons(data.coupons || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCoupons();
    }, []);

    const startEdit = (coupon: Coupon) => {
        setEditingId(coupon.id);
        setForm({
            code: coupon.code,
            description: coupon.description || "",
            type: coupon.type,
            value: String(coupon.value),
            minPurchase: coupon.minPurchase ? String(coupon.minPurchase) : "",
            maxDiscount: coupon.maxDiscount ? String(coupon.maxDiscount) : "",
            usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : "",
            expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : "",
            isActive: coupon.isActive,
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setForm({ code: "", description: "", type: "PERCENTAGE", value: "", minPurchase: "", maxDiscount: "", usageLimit: "", expiresAt: "", isActive: true });
        setEditingId(null);
        setShowForm(false);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const url = editingId ? `/api/v1/store/coupons/${editingId}` : "/api/v1/store/coupons";
            const res = await fetch(url, {
                method: editingId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: form.code.toUpperCase(),
                    description: form.description || undefined,
                    type: form.type,
                    value: parseFloat(form.value),
                    minPurchase: form.minPurchase ? parseFloat(form.minPurchase) : null,
                    maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : null,
                    usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
                    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
                    isActive: form.isActive,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create coupon");
                return;
            }

            resetForm();
            fetchCoupons();
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (coupon: Coupon) => {
        try {
            await fetch(`/api/v1/store/coupons/${coupon.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !coupon.isActive }),
            });
            fetchCoupons();
        } catch (err) {
            console.error(err);
        }
    };

    const deleteCoupon = async (id: string) => {
        const ok = await confirm({ title: "Delete Coupon", message: "Delete this coupon?", variant: "danger", confirmText: "Delete" });
        if (!ok) return;
        try {
            await fetch(`/api/v1/store/coupons/${id}`, { method: "DELETE" });
            fetchCoupons();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Coupons</h1>
                    <p className="text-muted-foreground">Manage discount codes</p>
                </div>
                <Button onClick={() => showForm ? resetForm() : setShowForm(true)}>
                    {showForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> New Coupon</>}
                </Button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
            )}

            {showForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{editingId ? "Edit Coupon" : "New Coupon"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Code *</Label>
                                    <Input
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                        placeholder="SUMMER2024"
                                        required
                                        minLength={3}
                                    />
                                </div>
                                <div>
                                    <Label>Type</Label>
                                    <select
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value as "PERCENTAGE" | "FIXED" })}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="PERCENTAGE">Percentage (%)</option>
                                        <option value="FIXED">Fixed Amount ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <Label>Value *</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.value}
                                        onChange={(e) => setForm({ ...form, value: e.target.value })}
                                        placeholder={form.type === "PERCENTAGE" ? "10" : "5.00"}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Description</Label>
                                <Input
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Summer sale discount"
                                />
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Min Purchase</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.minPurchase}
                                        onChange={(e) => setForm({ ...form, minPurchase: e.target.value })}
                                        placeholder="No minimum"
                                    />
                                </div>
                                <div>
                                    <Label>Max Discount</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.maxDiscount}
                                        onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                                        placeholder="No limit"
                                    />
                                </div>
                                <div>
                                    <Label>Usage Limit</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={form.usageLimit}
                                        onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                                        placeholder="Unlimited"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Expires At</Label>
                                <Input
                                    type="datetime-local"
                                    value={form.expiresAt}
                                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                                />
                            </div>

                            <Button type="submit" disabled={saving}>
                                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : editingId ? "Save Changes" : "Create Coupon"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Coupons List */}
            <Card>
                <CardContent className="p-0">
                    {coupons.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No coupons yet</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Code</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Discount</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Usage</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Expires</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {coupons.map((coupon) => (
                                        <tr key={coupon.id} className="hover:bg-muted/50 border-b last:border-0">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <Tag className="w-4 h-4 text-muted-foreground" />
                                                    <code className="font-mono font-bold">{coupon.code}</code>
                                                </div>
                                                {coupon.description && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">{coupon.description}</p>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="font-medium">
                                                    {coupon.type === "PERCENTAGE"
                                                        ? `${coupon.value}%`
                                                        : formatCurrency(Number(coupon.value))}
                                                </span>
                                                {coupon.minPurchase && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Min: {formatCurrency(Number(coupon.minPurchase))}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                {coupon.usageCount} / {coupon.usageLimit || "∞"}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground">
                                                {coupon.expiresAt
                                                    ? new Date(coupon.expiresAt).toLocaleDateString()
                                                    : "Never"}
                                            </td>
                                            <td className="py-3 px-4">
                                                <button
                                                    onClick={() => toggleActive(coupon)}
                                                    className={`text-xs px-2 py-1 rounded cursor-pointer ${coupon.isActive
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-gray-100 text-gray-500"
                                                    }`}
                                                >
                                                    {coupon.isActive ? "Active" : "Inactive"}
                                                </button>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => startEdit(coupon)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive"
                                                    onClick={() => deleteCoupon(coupon.id)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
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
