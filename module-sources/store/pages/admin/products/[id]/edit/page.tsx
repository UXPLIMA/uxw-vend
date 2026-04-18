"use client";


import { useTranslations } from "next-intl";
import { useState, useEffect, use } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { RichTextEditor } from "@/core/components/ui/rich-text-editor";
import { FileUpload } from "@/core/components/ui/file-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { ArrowLeft, Loader2, Trash2, X } from "lucide-react";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface Category {
    id: string;
    name: string;
    slug: string;
}

interface PageProps {
    params: Promise<{ id: string; locale: string }>;
}

export default function EditProductPage(props: PageProps) {
    const t = useTranslations("store");
    const params = use(props.params);
    const router = useRouter();
    const productId = params.id;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const { confirm } = useConfirm();

    const [form, setForm] = useState({
        name: "",
        description: "",
        price: "",
        comparePrice: "",
        image: "",
        images: [] as string[],
        stock: "",
        categoryId: "",
        type: "DIGITAL",
        isActive: true,
        isFeatured: false,
        subscriptionInterval: "month" as string,
        subscriptionIntervalCount: "1",
    });

    useEffect(() => {
        Promise.all([
            fetch(`/api/v1/store/products/${productId}`).then((r) => r.json()),
            fetch("/api/v1/store/categories").then((r) => r.json()),
        ]).then(([productData, catData]) => {
            const p = productData.product;
            if (p) {
                setForm({
                    name: p.name || "",
                    description: p.description || "",
                    price: String(p.price || ""),
                    comparePrice: p.comparePrice ? String(p.comparePrice) : "",
                    image: p.image || "",
                    images: p.images || [],
                    stock: p.stock !== null ? String(p.stock) : "",
                    categoryId: p.categoryId || "",
                    type: p.type || "DIGITAL",
                    isActive: p.isActive ?? true,
                    isFeatured: p.isFeatured ?? false,
                    subscriptionInterval: p.subscriptionInterval || "month",
                    subscriptionIntervalCount: p.subscriptionIntervalCount ? String(p.subscriptionIntervalCount) : "1",
                });
            }
            setCategories(catData.categories || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [productId]);

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
                image: form.image || (form.images.length > 0 ? form.images[0] : null),
                images: form.images.length > 0 ? form.images : undefined,
                stock: form.stock ? parseInt(form.stock) : null,
                categoryId: form.categoryId || null,
                type: form.type,
                isActive: form.isActive,
                isFeatured: form.isFeatured,
                subscriptionInterval: form.type === "SUBSCRIPTION" ? form.subscriptionInterval : null,
                subscriptionIntervalCount: form.type === "SUBSCRIPTION" ? parseInt(form.subscriptionIntervalCount) || 1 : null,
            };

            const res = await fetch(`/api/v1/store/products/${productId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to update product");
                return;
            }

            router.push("/admin/store/products");
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const ok = await confirm({ title: "Delete Product", message: "Are you sure you want to delete this product?", variant: "danger", confirmText: "Delete" });
        if (!ok) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/v1/store/products/${productId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                router.push("/admin/store/products");
            }
        } catch {
            setError("Failed to delete product");
        } finally {
            setDeleting(false);
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
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/admin/store/products">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">{t("adm_editProduct")}</h1>
                        <p className="text-muted-foreground">{form.name}</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting ? t("adm_deleting") : t("adm_delete")}
                </Button>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("adm_productDetails")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="name">{`${t("adm_name")} *`}</Label>
                                    <Input
                                        id="name"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="description">{t("adm_description")}</Label>
                                    <RichTextEditor
                                        value={form.description}
                                        onChange={(value: string) => setForm({ ...form, description: value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="image">{t("adm_mainImageUrl")}</Label>
                                    <FileUpload
                                        value={form.image || null}
                                        onChange={(v) => setForm({ ...form, image: v || "" })}
                                        accept="image/*"
                                    />
                                </div>
                                <div>
                                    <Label>{t("adm_additionalImages")}</Label>
                                    {form.images.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {form.images.map((url, i) => (
                                                <div key={i} className="relative group">
                                                    <Image src={url} alt="" width={64} height={64} className="w-16 h-16 rounded-lg object-cover border" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setForm({ ...form, images: form.images.filter((_, idx) => idx !== i) })}
                                                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <FileUpload
                                        value={null}
                                        onChange={(v) => {
                                            if (v) setForm({ ...form, images: [...form.images, v] });
                                        }}
                                        accept="image/*"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t("adm_pricing")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="price">{`${t("adm_price")} *`}</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.price}
                                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="comparePrice">{t("adm_comparePrice")}</Label>
                                        <Input
                                            id="comparePrice"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.comparePrice}
                                            onChange={(e) => setForm({ ...form, comparePrice: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("adm_organization")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="category">{t("adm_category")}</Label>
                                    <select
                                        id="category"
                                        value={form.categoryId}
                                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">{t("adm_noCategory")}</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="type">{t("adm_type")}</Label>
                                    <select
                                        id="type"
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="DIGITAL">{t("adm_digital")}</option>
                                        <option value="PHYSICAL">{t("adm_physical")}</option>
                                        <option value="GAME_ITEM">{t("adm_gameItem")}</option>
                                        <option value="SUBSCRIPTION">{t("adm_subscription")}</option>
                                    </select>
                                </div>
                                {form.type === "SUBSCRIPTION" && (
                                    <>
                                        <div>
                                            <Label htmlFor="subscriptionInterval">{t("adm_subscriptionInterval")}</Label>
                                            <select
                                                id="subscriptionInterval"
                                                value={form.subscriptionInterval}
                                                onChange={(e) => setForm({ ...form, subscriptionInterval: e.target.value })}
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            >
                                                <option value="month">{t("adm_monthly")}</option>
                                                <option value="year">{t("adm_yearly")}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <Label htmlFor="subscriptionIntervalCount">{t("adm_intervalCount")}</Label>
                                            <Input
                                                id="subscriptionIntervalCount"
                                                type="number"
                                                min="1"
                                                max="12"
                                                value={form.subscriptionIntervalCount}
                                                onChange={(e) => setForm({ ...form, subscriptionIntervalCount: e.target.value })}
                                                placeholder="1"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t("adm_intervalCountHelp")}
                                            </p>
                                        </div>
                                    </>
                                )}
                                <div>
                                    <Label htmlFor="stock">{t("adm_stock")}</Label>
                                    <Input
                                        id="stock"
                                        type="number"
                                        min="0"
                                        value={form.stock}
                                        onChange={(e) => setForm({ ...form, stock: e.target.value })}
                                        placeholder={t("adm_leaveEmptyUnlimited")}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{t("adm_status")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-sm">{t("adm_active")}</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isFeatured}
                                        onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="text-sm">{t("adm_featured")}</span>
                                </label>
                            </CardContent>
                        </Card>

                        {/* RCON Commands */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">{t("adm_deliveryCommands")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground mb-2">{t("adm_deliveryCommandsHelp")}</p>
                                <ProductCommandsEditor productId={productId} />
                            </CardContent>
                        </Card>

                        {/* Custom Variables */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">{t("adm_customVariables")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground mb-2">{t("adm_customVariablesHelp")}</p>
                                <ProductVariablesEditor productId={productId} />
                            </CardContent>
                        </Card>

                        {error && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={saving}>
                            {saving ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("adm_saving")}</>
                            ) : (
                                t("adm_saveChanges")
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </>
    );
}

// Sub-component: RCON commands editor with per-server targeting
function ProductCommandsEditor({ productId }: { productId: string }) {
    const t = useTranslations("store");
    const [commands, setCommands] = useState<{ id: string; command: string; serverId?: string | null }[]>([]);
    const [servers, setServers] = useState<{ id: string; name: string }[]>([]);
    const [newCmd, setNewCmd] = useState("");
    const [newServerId, setNewServerId] = useState("");

    useEffect(() => {
        fetch(`/api/v1/product-commands?productId=${productId}`)
            .then((r) => r.json())
            .then((d) => setCommands(d.commands || []))
            .catch(() => {});
        // Fetch available game servers
        fetch("/api/v1/servers")
            .then((r) => r.ok ? r.json() : { servers: [] })
            .then((d) => setServers(d.servers || []))
            .catch(() => {});
    }, [productId]);

    const addCmd = async () => {
        if (!newCmd.trim()) return;
        const res = await fetch("/api/v1/product-commands", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, command: newCmd, serverId: newServerId || null }),
        });
        if (res.ok) {
            const data = await res.json();
            setCommands([...commands, data.command]);
            setNewCmd("");
            setNewServerId("");
        }
    };

    const getServerName = (serverId?: string | null) => {
        if (!serverId) return "Default";
        return servers.find((s) => s.id === serverId)?.name || "Unknown";
    };

    return (
        <div className="space-y-2">
            {commands.map((cmd) => (
                <div key={cmd.id} className="flex items-center gap-2">
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                        {getServerName(cmd.serverId)}
                    </span>
                    <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono truncate">{cmd.command}</code>
                </div>
            ))}
            <div className="flex gap-2">
                {servers.length > 0 && (
                    <select
                        value={newServerId}
                        onChange={(e) => setNewServerId(e.target.value)}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs w-32"
                    >
                        <option value="">{t("adm_defaultServer")}</option>
                        {servers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                )}
                <Input value={newCmd} onChange={(e) => setNewCmd(e.target.value)} placeholder='give {player} diamond 64' className="font-mono text-xs flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={addCmd}>{t("adm_add")}</Button>
            </div>
        </div>
    );
}

// Sub-component: Custom variables editor
function ProductVariablesEditor({ productId }: { productId: string }) {
    const t = useTranslations("store");
    const [vars, setVars] = useState<{ id: string; name: string; label: string; type: string }[]>([]);
    const [newLabel, setNewLabel] = useState("");

    useEffect(() => {
        fetch(`/api/v1/product-variables?productId=${productId}`)
            .then((r) => r.json())
            .then((d) => setVars(d.variables || []))
            .catch(() => {});
    }, [productId]);

    const addVar = async () => {
        if (!newLabel.trim()) return;
        const name = newLabel.toLowerCase().replace(/\s+/g, "_");
        const res = await fetch("/api/v1/product-variables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, name, label: newLabel, type: "text", required: true }),
        });
        if (res.ok) {
            const data = await res.json();
            setVars([...vars, data.variable]);
            setNewLabel("");
        }
    };

    return (
        <div className="space-y-2">
            {vars.map((v) => (
                <div key={v.id} className="flex items-center gap-2 text-xs">
                    <span className="bg-muted px-2 py-1 rounded">{v.label}</span>
                    <span className="text-muted-foreground">({v.type})</span>
                </div>
            ))}
            <div className="flex gap-2">
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Minecraft Username" className="text-xs" />
                <Button type="button" variant="outline" size="sm" onClick={addVar}>Add</Button>
            </div>
        </div>
    );
}
