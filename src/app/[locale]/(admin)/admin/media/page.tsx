"use client";

import { useEffect, useState } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Loader2, FileText, Trash2, Upload, X, Search, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface MediaItem {
    id: string;
    filename: string;
    url: string;
    mimeType: string;
    size: number;
    alt: string | null;
    createdAt: string;
    uploadedBy?: { username: string } | null;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [type, setType] = useState<"" | "image" | "document">("");
    const [selected, setSelected] = useState<MediaItem | null>(null);
    const [uploading, setUploading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const { confirm } = useConfirm();
    const t = useTranslations("admin");

    const fetchItems = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                perPage: "24",
            });
            if (search) params.set("search", search);
            if (type) params.set("type", type);
            const res = await fetch(`/api/v1/media?${params}`);
            const data = await res.json();
            setItems(data.items || []);
            setTotalPages(data.totalPages || 1);
        } catch {
            toast.error(t("media_loadFailed"));
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchItems(); }, [page, type]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchItems();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/v1/upload", { method: "POST", body: fd });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || t("media_uploadFailed"));
                return;
            }
            toast.success(t("media_uploaded"));
            setPage(1);
            fetchItems();
        } catch {
            toast.error(t("media_uploadFailed"));
        } finally {
            setUploading(false);
        }
    };

    const deleteItem = async (item: MediaItem) => {
        const ok = await confirm({
            title: t("media_deleteTitle"),
            message: `Delete "${item.filename}"? This cannot be undone.`,
            variant: "danger",
        });
        if (!ok) return;
        const res = await fetch(`/api/v1/media/${item.id}`, { method: "DELETE" });
        if (res.ok) {
            toast.success(t("media_deleted"));
            if (selected?.id === item.id) setSelected(null);
            fetchItems();
        } else {
            toast.error(t("media_deleteFailed"));
        }
    };

    const updateItem = async (id: string, data: Partial<MediaItem>) => {
        const res = await fetch(`/api/v1/media/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const updated = await res.json();
            setItems(items.map((i) => (i.id === id ? { ...i, ...updated } : i)));
            if (selected?.id === id) setSelected({ ...selected, ...updated });
            toast.success(t("media_updated"));
        }
    };

    const copyUrl = (item: MediaItem) => {
        navigator.clipboard.writeText(item.url);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const isImage = (mime: string) => mime.startsWith("image/");

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-semibold">
                        {t("media_title")}
                    </h1>
                    <p className="text-muted-foreground">{t("media_subtitle")}</p>
                </div>
                <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                    <span className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4">
                        {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin text-primary-foreground" /> <span className="text-primary-foreground">{t("media_uploading")}</span></> : <><Upload className="w-4 h-4 mr-2 text-primary-foreground" /> <span className="text-primary-foreground">{t("media_upload")}</span></>}
                    </span>
                </label>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4">
                <form onSubmit={handleSearch} className="flex gap-2 flex-1">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t("media_searchPlaceholder")}
                            className="pl-8 bg-background"
                        />
                    </div>
                    <Button type="submit" variant="outline">{t("media_search")}</Button>
                </form>
                <select
                    value={type}
                    onChange={(e) => { setType(e.target.value as "" | "image" | "document"); setPage(1); }}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                    <option value="">{t("media_allTypes")}</option>
                    <option value="image">{t("media_images")}</option>
                    <option value="document">{t("media_documents")}</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                    {t("media_noItems")}
                </CardContent></Card>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelected(item)}
                            className="group relative aspect-square rounded-lg border border-border bg-muted overflow-hidden hover:border-primary transition-colors"
                        >
                            {isImage(item.mimeType) ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={item.url} alt={item.alt || ""} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                    <FileText className="w-8 h-8 text-muted-foreground mb-1" />
                                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">{item.filename}</span>
                                </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                {item.filename}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>{t("common_prev")}</Button>
                    <span className="text-sm text-muted-foreground">{t("media_page")} {page} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>{t("common_next")}</Button>
                </div>
            )}

            {/* Detail panel */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
                    <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-bold truncate">{selected.filename}</h3>
                            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            {isImage(selected.mimeType) ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={selected.url} alt={selected.alt || ""} className="w-full max-h-96 object-contain rounded" />
                            ) : (
                                <div className="flex items-center justify-center py-12 bg-muted rounded">
                                    <FileText className="w-16 h-16 text-muted-foreground" />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-muted-foreground text-xs">{t("media_size")}</div>
                                    <div>{formatBytes(selected.size)}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">{t("media_type")}</div>
                                    <div className="font-mono text-xs">{selected.mimeType}</div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-muted-foreground text-xs">{t("media_url")}</div>
                                    <div className="flex gap-2">
                                        <Input value={selected.url} readOnly className="text-xs font-mono" />
                                        <Button variant="outline" size="sm" onClick={() => copyUrl(selected)}>
                                            {copiedId === selected.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        </Button>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-muted-foreground text-xs mb-1">{t("media_altText")}</div>
                                    <Input
                                        value={selected.alt || ""}
                                        onChange={(e) => setSelected({ ...selected, alt: e.target.value })}
                                        onBlur={(e) => updateItem(selected.id, { alt: e.target.value })}
                                        placeholder={t("media_altPlaceholder")}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button variant="destructive" size="sm" onClick={() => deleteItem(selected)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> {t("common_delete")}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden link for ESLint — admin sidebar will link here */}
            <Link href="/admin/media" className="hidden">media</Link>
        </>
    );
}
