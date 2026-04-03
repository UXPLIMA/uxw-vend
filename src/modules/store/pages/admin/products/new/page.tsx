"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
}

export default function NewProductPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    const [form, setForm] = useState({
        name: "",
        description: "",
        price: "",
        comparePrice: "",
        image: "",
        stock: "",
        categoryId: "",
        type: "DIGITAL" as string,
        isActive: true,
        isFeatured: false,
    });

    useEffect(() => {
        fetch("/api/v1/store/categories")
            .then((res) => res.json())
            .then((data) => setCategories(data.categories || []))
            .catch(() => {});
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const payload = {
                name: form.name,
                description: form.description || undefined,
                price: parseFloat(form.price),
                comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : null,
                image: form.image || null,
                stock: form.stock ? parseInt(form.stock) : null,
                categoryId: form.categoryId || null,
                type: form.type,
                isActive: form.isActive,
                isFeatured: form.isFeatured,
            };

            const res = await fetch("/api/v1/store/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create product");
                return;
            }

            router.push("/admin/store/products");
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/store/products">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">New Product</h1>
                    <p className="text-muted-foreground">Create a new product listing</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Product Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Name *</Label>
                                    <Input
                                        id="name"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Product name"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="Product description"
                                        rows={4}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="image">Image URL</Label>
                                    <Input
                                        id="image"
                                        value={form.image}
                                        onChange={(e) => setForm({ ...form, image: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Pricing</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="price">Price *</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.price}
                                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="comparePrice">Compare Price</Label>
                                        <Input
                                            id="comparePrice"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.comparePrice}
                                            onChange={(e) => setForm({ ...form, comparePrice: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Organization</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="category">Category</Label>
                                    <select
                                        id="category"
                                        value={form.categoryId}
                                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">No category</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="type">Type</Label>
                                    <select
                                        id="type"
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="DIGITAL">Digital</option>
                                        <option value="PHYSICAL">Physical</option>
                                        <option value="GAME_ITEM">Game Item</option>
                                        <option value="SUBSCRIPTION">Subscription</option>
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="stock">Stock</Label>
                                    <Input
                                        id="stock"
                                        type="number"
                                        min="0"
                                        value={form.stock}
                                        onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                        placeholder="Leave empty for unlimited"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Status</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Active</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isFeatured}
                                        onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-sm">Featured</span>
                                </label>
                            </CardContent>
                        </Card>

                        {error && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={saving}>
                            {saving ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</>
                            ) : (
                                "Create Product"
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </>
    );
}
