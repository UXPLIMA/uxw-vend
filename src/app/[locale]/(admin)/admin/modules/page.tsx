"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import {
    Package, Upload, Loader2, Trash2, Download, CheckCircle, ShoppingCart,
    MessageSquare, FileText, Ticket, HelpCircle, Shield, History, Users,
    Vote, Dices, Trophy, Bell, Server, FileEdit, ImageIcon, Crown,
    Megaphone, Search as SearchIcon, ArrowUp, X, Tag as TagIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/core/components/ui/confirm-dialog";

interface Module {
    id: string;
    name: string;
    description: string;
    version: string;
    icon?: string;
    enabled: boolean;
    dependencies?: string[];
    conflicts?: string[];
    routes?: { public?: string[]; admin?: string[] };
    updateAvailable?: boolean;
    latestVersion?: string | null;
}

interface MarketplaceModule {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    icon: string;
    category: string;
    verified: boolean;
    updatedAt: string;
    screenshots: string[];
    tags: string[];
    zip: string;
    dependencies: string[];
    stats: { publicRoutes: number; adminRoutes: number; apiRoutes: number; widgets: number };
}

type SortKey = "newest" | "alphabetical";

const iconMap: Record<string, React.ReactNode> = {
    ShoppingCart: <ShoppingCart size={22} />,
    MessageSquare: <MessageSquare size={22} />,
    FileText: <FileText size={22} />,
    Ticket: <Ticket size={22} />,
    HelpCircle: <HelpCircle size={22} />,
    Shield: <Shield size={22} />,
    History: <History size={22} />,
    Users: <Users size={22} />,
    Vote: <Vote size={22} />,
    Dices: <Dices size={22} />,
    Trophy: <Trophy size={22} />,
    Bell: <Bell size={22} />,
    Server: <Server size={22} />,
    FileEdit: <FileEdit size={22} />,
    Image: <ImageIcon size={22} />,
    Crown: <Crown size={22} />,
    Megaphone: <Megaphone size={22} />,
    Download: <Download size={22} />,
    Package: <Package size={22} />,
    Search: <SearchIcon size={22} />,
};

const categoryColors: Record<string, string> = {
    commerce: "bg-blue-100 text-blue-700",
    community: "bg-green-100 text-green-700",
    management: "bg-purple-100 text-purple-700",
    gaming: "bg-orange-100 text-orange-700",
    content: "bg-muted text-foreground",
};

/** Simple semver comparison. Returns positive when a > b. */
function compareVersions(a: string, b: string): number {
    const ap = a.split(".").map((n) => parseInt(n, 10) || 0);
    const bp = b.split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        const av = ap[i] || 0;
        const bv = bp[i] || 0;
        if (av !== bv) return av - bv;
    }
    return 0;
}

export default function AdminModulesPage() {
    const t = useTranslations("admin");
    const searchParams = useSearchParams();
    const initialFilterParam = searchParams?.get("filter") ?? null;

    const [modules, setModules] = useState<Module[]>([]);
    const [marketplace, setMarketplace] = useState<MarketplaceModule[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMarketplace, setLoadingMarketplace] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [installing, setInstalling] = useState<string | null>(null);
    const [installProgress, setInstallProgress] = useState<{ name: string; step: string } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [updatingModule, setUpdatingModule] = useState<string | null>(null);

    const isBusy = installing !== null || uploading || deleting !== null || updatingModule !== null;
    const [marketplaceFilter, setMarketplaceFilter] = useState<string>("all");
    const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
    const [bulkInstalling, setBulkInstalling] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; name: string } | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>("newest");
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [updatesOnly, setUpdatesOnly] = useState<boolean>(initialFilterParam === "updates");
    const [detailModule, setDetailModule] = useState<MarketplaceModule | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { confirm } = useConfirm();

    const fetchModules = () => {
        fetch("/api/v1/modules")
            .then(res => res.json())
            .then(data => { setModules(data.modules || []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    const fetchMarketplace = () => {
        fetch("/api/v1/modules/marketplace")
            .then(res => res.json())
            .then(data => { setMarketplace(data.modules || []); setLoadingMarketplace(false); })
            .catch(() => setLoadingMarketplace(false));
    };

    useEffect(() => { fetchModules(); fetchMarketplace(); }, []);

    const installedIds = useMemo(() => new Set(modules.map((m) => m.id)), [modules]);
    const marketplaceById = useMemo(() => {
        const map = new Map<string, MarketplaceModule>();
        for (const m of marketplace) map.set(m.id, m);
        return map;
    }, [marketplace]);

    // Compute updateAvailable client-side by comparing installed versions to
    // the marketplace. This overrides anything the /api/v1/modules returned.
    const modulesWithUpdates = useMemo(() => {
        return modules.map((mod) => {
            const mp = marketplaceById.get(mod.id);
            if (!mp) return mod;
            const hasUpdate = compareVersions(mp.version, mod.version) > 0;
            return { ...mod, updateAvailable: hasUpdate, latestVersion: mp.version };
        });
    }, [modules, marketplaceById]);

    const updatesAvailableCount = useMemo(
        () => modulesWithUpdates.filter((m) => m.updateAvailable).length,
        [modulesWithUpdates],
    );

    const toggleModule = async (moduleId: string, enabled: boolean) => {
        setUpdating(moduleId);
        try {
            const res = await fetch("/api/v1/modules", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moduleId, enabled }),
            });
            const data = await res.json();
            if (res.ok) {
                setModules(modules.map(m => m.id === moduleId ? { ...m, enabled } : m));
                toast.success(`${moduleId} ${enabled ? t("modules_enable") : t("modules_disable")}`);
            } else {
                toast.error(data.error || "Failed");
            }
        } catch { toast.error(t("modules_networkError")); }
        finally { setUpdating(null); }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (isBusy) { toast.error(t("modules_pleaseWait")); return; }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/v1/modules/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (res.ok) { toast.success(`"${data.module?.name}" installed`); fetchModules(); }
            else toast.error(data.error || t("modules_uploadFailed"));
        } catch { toast.error(t("modules_uploadFailed")); }
        finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    };

    const handleDelete = async (moduleId: string, moduleName: string) => {
        if (isBusy) { toast.error(t("modules_pleaseWait")); return; }
        const ok = await confirm({ title: "Delete Module", message: `Delete "${moduleName}"? This removes all module files.`, variant: "danger", confirmText: "Delete" });
        if (!ok) return;
        setDeleting(moduleId);
        try {
            const res = await fetch(`/api/v1/modules/${moduleId}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok) { toast.success(`"${moduleName}" deleted`); fetchModules(); }
            else toast.error(data.error || t("modules_deleteFailed"));
        } catch { toast.error(t("modules_deleteFailed")); }
        finally { setDeleting(null); }
    };

    const handleUpdate = async (mod: Module) => {
        if (isBusy) { toast.error(t("modules_pleaseWait")); return; }
        const mpMod = marketplace.find(m => m.id === mod.id);
        if (!mpMod) { toast.error(t("modules_notFound")); return; }
        setUpdatingModule(mod.id);
        try {
            const res = await fetch("/api/v1/modules/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moduleId: mod.id, zipFile: mpMod.zip }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`"${mod.name}" updated to v${data.module?.version ?? mpMod.version}`);
                fetchModules();
            } else {
                toast.error(data.error || t("modules_updateFailed"));
            }
        } catch { toast.error(t("modules_updateFailed")); }
        finally { setUpdatingModule(null); }
    };

    const handleMarketplaceInstall = async (mod: MarketplaceModule) => {
        if (isBusy) {
            toast.error(t("modules_pleaseWait"));
            return;
        }
        const ok = await confirm({ title: "Install Module", message: `Install "${mod.name}" (v${mod.version})?`, confirmText: "Install" });
        if (!ok) return;
        setInstalling(mod.id);
        setInstallProgress({ name: mod.name, step: "Downloading..." });
        try {
            setInstallProgress({ name: mod.name, step: "Installing..." });
            const res = await fetch("/api/v1/modules/marketplace/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moduleId: mod.id, zipFile: mod.zip }),
            });
            const data = await res.json();
            if (res.ok) {
                setInstallProgress({ name: mod.name, step: "Done!" });
                toast.success(`"${mod.name}" installed and enabled`);
                fetchModules();
                fetchMarketplace();
            } else {
                toast.error(data.error || t("modules_installFailed"));
            }
        } catch { toast.error(t("modules_installFailed")); }
        finally {
            setTimeout(() => { setInstalling(null); setInstallProgress(null); }, 500);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedModules);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedModules(next);
    };

    const toggleTag = (tag: string) => {
        const next = new Set(selectedTags);
        if (next.has(tag)) next.delete(tag); else next.add(tag);
        setSelectedTags(next);
    };

    const handleBulkInstall = async () => {
        const toInstall = marketplace.filter(m => selectedModules.has(m.id) && !installedIds.has(m.id));
        if (toInstall.length === 0) return;

        const ok = await confirm({
            title: t("modules_bulkInstall"),
            message: `Install ${toInstall.length} modules? This may take a few minutes as the system will rebuild after all modules are installed.`,
            confirmText: `Install ${toInstall.length} modules`,
        });
        if (!ok) return;

        setBulkInstalling(true);
        setBulkProgress({ current: 0, total: toInstall.length, name: "Preparing..." });

        try {
            const res = await fetch("/api/v1/modules/marketplace/bulk-install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    modules: toInstall.map(m => ({ id: m.id, zip: m.zip, name: m.name })),
                }),
            });
            const data = await res.json();

            if (res.ok) {
                toast.success(`${data.installed}/${data.total} modules installed`);
                if (data.failed > 0) {
                    const failedNames = data.results.filter((r: { status: string }) => r.status === "failed").map((r: { name: string; error?: string }) => r.name).join(", ");
                    toast.error(`Failed: ${failedNames}`);
                }
            } else {
                toast.error(data.error || t("modules_bulkFailed"));
            }
        } catch {
            toast.error(t("modules_bulkFailed"));
        }

        setSelectedModules(new Set());
        setBulkInstalling(false);
        setBulkProgress(null);
        fetchModules();
        fetchMarketplace();
    };

    const filteredMarketplace = useMemo(() => {
        let list = marketplace.filter((m) => !installedIds.has(m.id));
        if (marketplaceFilter !== "all") list = list.filter((m) => m.category === marketplaceFilter);
        if (selectedTags.size > 0) {
            list = list.filter((m) => (m.tags || []).some((tag) => selectedTags.has(tag)));
        }

        const sorted = [...list];
        switch (sortKey) {
            case "newest":
                sorted.sort((a, b) => {
                    const ad = a.updatedAt ? Date.parse(a.updatedAt) : 0;
                    const bd = b.updatedAt ? Date.parse(b.updatedAt) : 0;
                    return bd - ad;
                });
                break;
            case "alphabetical":
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }
        return sorted;
    }, [marketplace, installedIds, marketplaceFilter, selectedTags, sortKey]);

    const categories = useMemo(
        () => Array.from(new Set(marketplace.map((m) => m.category))).sort(),
        [marketplace],
    );

    const allTags = useMemo(() => {
        const set = new Set<string>();
        for (const m of marketplace) for (const tag of m.tags || []) set.add(tag);
        return Array.from(set).sort();
    }, [marketplace]);

    const installedToShow = updatesOnly
        ? modulesWithUpdates.filter((m) => m.updateAvailable)
        : modulesWithUpdates;

    return (
        <>
            {(installProgress || bulkProgress) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" />
                    <div className="relative bg-card border rounded-xl shadow-2xl p-8 w-full max-w-sm mx-4 text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                        {bulkProgress ? (
                            <>
                                <h3 className="font-semibold text-lg mb-1">{t("modules_installingModules", { current: bulkProgress.current, total: bulkProgress.total })}</h3>
                                <p className="text-sm text-muted-foreground">{bulkProgress.name}</p>
                                <div className="mt-4 w-full bg-muted rounded-full h-2 overflow-hidden">
                                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
                                </div>
                            </>
                        ) : installProgress ? (
                            <>
                                <h3 className="font-semibold text-lg mb-1">{installProgress.name}</h3>
                                <p className="text-sm text-muted-foreground">{installProgress.step}</p>
                                <div className="mt-4 w-full bg-muted rounded-full h-2 overflow-hidden">
                                    <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: installProgress.step === "Done!" ? "100%" : "60%" }} />
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}

            <div className="mb-8">
                <h1 className="text-3xl font-bold">{t("modules_title")}</h1>
                <p className="text-muted-foreground">{t("modules_subtitle")}</p>
            </div>

            {updatesOnly && updatesAvailableCount > 0 && (
                <Card className="mb-6 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <ArrowUp className="w-4 h-4 text-amber-600" />
                            <span className="font-medium">
                                Showing {updatesAvailableCount} module{updatesAvailableCount === 1 ? "" : "s"} with updates available
                            </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setUpdatesOnly(false)}>
                            <X className="w-3 h-3 mr-1" /> Clear filter
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="font-semibold">{t("modules_customModule")}</h3>
                            <p className="text-sm text-muted-foreground">{t("modules_uploadDesc")}</p>
                        </div>
                        <div>
                            <input type="file" accept=".zip" ref={fileInputRef} className="hidden" onChange={handleUpload} />
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("modules_installing")}</> : <><Upload className="w-4 h-4 mr-2" /> {t("modules_uploadZip")}</>}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Installed Modules */}
            <div className="mb-10">
                <h2 className="text-xl font-bold mb-4">
                    {t("modules_installedModules")} ({installedToShow.length})
                </h2>

                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : installedToShow.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground mb-1">
                                {updatesOnly ? "No updates available" : t("modules_noModules")}
                            </p>
                            <p className="text-sm text-muted-foreground">{t("modules_browseMarketplace")}</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {installedToShow.map((mod) => {
                            const mp = marketplaceById.get(mod.id);
                            return (
                                <Card key={mod.id} className={`transition-all ${!mod.enabled ? "opacity-60" : ""}`}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-primary">{iconMap[mod.icon || ""] || <Package size={22} />}</span>
                                                <div>
                                                    <h3 className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                                                        {mod.name}
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
                                                            v{mod.version}
                                                        </span>
                                                        {mod.updateAvailable && mod.latestVersion && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                                                                <ArrowUp className="w-2.5 h-2.5" />
                                                                Update: v{mod.latestVersion}
                                                            </span>
                                                        )}
                                                    </h3>
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${mod.enabled ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                                                {mod.enabled ? t("modules_on") : t("modules_off")}
                                            </span>
                                        </div>

                                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{mod.description}</p>

                                        {((mod.dependencies && mod.dependencies.length > 0) || (mod.conflicts && mod.conflicts.length > 0)) && (
                                            <div className="mb-3 space-y-1">
                                                {mod.dependencies && mod.dependencies.length > 0 && (
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <span className="text-amber-600 font-medium">{t("modules_requires")}</span>
                                                        <div className="flex gap-1 flex-wrap">
                                                            {mod.dependencies.map(dep => {
                                                                const depMod = modules.find(m => m.id === dep);
                                                                const isInstalled = depMod?.enabled;
                                                                return (
                                                                    <span key={dep} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isInstalled ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                                                                        {depMod?.name || dep} {isInstalled ? "" : t("modules_missing")}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {mod.conflicts && mod.conflicts.length > 0 && (
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <span className="text-red-500 font-medium">{t("modules_incompatible")}</span>
                                                        <div className="flex gap-1 flex-wrap">
                                                            {mod.conflicts.map(cId => {
                                                                const cMod = modules.find(m => m.id === cId);
                                                                return (
                                                                    <span key={cId} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200">
                                                                        {cMod?.name || cId}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <Button
                                                variant={mod.enabled ? "outline" : "default"}
                                                size="sm"
                                                className="flex-1 text-xs"
                                                disabled={updating === mod.id}
                                                onClick={() => toggleModule(mod.id, !mod.enabled)}
                                            >
                                                {updating === mod.id ? <Loader2 className="w-3 h-3 animate-spin" /> : mod.enabled ? t("modules_disable") : t("modules_enable")}
                                            </Button>
                                            {mp && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    title={t("modules_viewDetails")}
                                                    onClick={() => setDetailModule(mp)}
                                                >
                                                    <SearchIcon className="w-3 h-3" />
                                                </Button>
                                            )}
                                            {mod.updateAvailable && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={updatingModule === mod.id}
                                                    onClick={() => handleUpdate(mod)}
                                                    className="text-amber-600 hover:text-amber-700 border-amber-300"
                                                    title={`Update to v${mod.latestVersion}`}
                                                >
                                                    {updatingModule === mod.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUp className="w-3 h-3" />}
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={deleting === mod.id}
                                                onClick={() => handleDelete(mod.id, mod.name)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                {deleting === mod.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Marketplace */}
            <div>
                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-blue-500" />
                                {t("modules_verifiedModules")}
                            </h2>
                            <p className="text-sm text-muted-foreground">{t("modules_officialModules")}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {selectedModules.size > 0 && (
                                <Button size="sm" onClick={handleBulkInstall} disabled={isBusy || bulkInstalling}>
                                    {bulkInstalling ? <><Loader2 className="w-3 h-3 animate-spin mr-1.5" /> {t("modules_installing")}</> : <><Download className="w-3 h-3 mr-1.5" /> {t("modules_installSelected", { count: selectedModules.size })}</>}
                                </Button>
                            )}
                            {filteredMarketplace.length > 0 && (
                                <Button size="sm" variant="outline" onClick={() => {
                                    if (selectedModules.size === filteredMarketplace.length) setSelectedModules(new Set());
                                    else setSelectedModules(new Set(filteredMarketplace.map(m => m.id)));
                                }}>
                                    {selectedModules.size === filteredMarketplace.length ? t("modules_deselectAll") : t("modules_selectAll")}
                                </Button>
                            )}
                            <label className="text-xs text-muted-foreground">Sort:</label>
                            <select
                                value={sortKey}
                                onChange={(e) => setSortKey(e.target.value as SortKey)}
                                className="text-xs border rounded-md px-2 py-1.5 bg-background"
                            >
                                <option value="newest">{t("modules_newest")}</option>
                                <option value="alphabetical">{t("modules_alphabetical")}</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant={marketplaceFilter === "all" ? "default" : "outline"} onClick={() => setMarketplaceFilter("all")}>{t("modules_all")}</Button>
                        {categories.map((cat) => (
                            <Button
                                key={cat}
                                size="sm"
                                variant={marketplaceFilter === cat ? "default" : "outline"}
                                onClick={() => setMarketplaceFilter(cat)}
                                className="capitalize"
                            >
                                {cat}
                            </Button>
                        ))}
                    </div>

                    {allTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <TagIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground mr-1">Tags:</span>
                            {allTags.map((tag) => {
                                const active = selectedTags.has(tag);
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                                            active
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                            {selectedTags.size > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedTags(new Set())}
                                    className="text-[10px] text-muted-foreground underline ml-1"
                                >
                                    {t("modules_clearTags")}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {loadingMarketplace ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : filteredMarketplace.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            {marketplace.length === 0 ? t("modules_couldNotLoad") : t("modules_allInstalled")}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredMarketplace.map((mod) => (
                            <Card key={mod.id} className={`hover:shadow-md transition-shadow flex flex-col ${selectedModules.has(mod.id) ? "ring-2 ring-primary" : ""}`}>
                                <CardContent className="p-4 flex flex-col flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <input
                                                type="checkbox"
                                                checked={selectedModules.has(mod.id)}
                                                onChange={() => toggleSelect(mod.id)}
                                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                            />
                                            <span className="text-blue-500">{iconMap[mod.icon] || <Package size={22} />}</span>
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setDetailModule(mod)}
                                                    className="font-semibold text-sm flex items-center gap-1.5 hover:underline text-left"
                                                >
                                                    {mod.name}
                                                    {mod.verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500" />}
                                                </button>
                                                <p className="text-xs text-muted-foreground">
                                                    <span className="font-mono">v{mod.version}</span>
                                                    {" "}by {mod.author}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${categoryColors[mod.category] || "bg-muted text-foreground"}`}>
                                            {mod.category}
                                        </span>
                                    </div>

                                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{mod.description}</p>

                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                                        {mod.stats.publicRoutes > 0 && <span>{t("modules_pages", { count: mod.stats.publicRoutes })}</span>}
                                        {mod.stats.adminRoutes > 0 && <span>{t("modules_admin", { count: mod.stats.adminRoutes })}</span>}
                                        {mod.stats.apiRoutes > 0 && <span>{t("modules_apis", { count: mod.stats.apiRoutes })}</span>}
                                        {mod.stats.widgets > 0 && <span>{t("modules_widgets", { count: mod.stats.widgets })}</span>}
                                    </div>

                                    {mod.dependencies.length > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs mb-3">
                                            <span className="text-amber-600 font-medium">{t("modules_requires")}</span>
                                            <div className="flex gap-1 flex-wrap">
                                                {mod.dependencies.map((dep: string) => {
                                                    const depName = marketplace.find(m => m.id === dep)?.name || modules.find(m => m.id === dep)?.name || dep;
                                                    return (
                                                        <span key={dep} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${installedIds.has(dep) ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                                                            {depName}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        size="sm"
                                        className="w-full mt-auto"
                                        disabled={isBusy}
                                        onClick={() => handleMarketplaceInstall(mod)}
                                    >
                                        {installing === mod.id ? (
                                            <><Loader2 className="w-3 h-3 animate-spin mr-1.5" /> {t("modules_installing")}</>
                                        ) : (
                                            <><Download className="w-3 h-3 mr-1.5" /> {t("modules_install")}</>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {detailModule && (
                <ModuleDetailModal
                    module={detailModule}
                    onClose={() => setDetailModule(null)}
                />
            )}
        </>
    );
}

interface DetailProps {
    module: MarketplaceModule;
    onClose: () => void;
}

function ModuleDetailModal({ module: mod, onClose }: DetailProps) {
    const t = useTranslations("admin");

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60" onClick={onClose} />
            <div className="relative bg-card border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-start justify-between p-5 border-b">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold flex items-center gap-2 flex-wrap">
                            {mod.name}
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
                                v{mod.version}
                            </span>
                            {mod.verified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            by {mod.author} · updated {new Date(mod.updatedAt).toLocaleDateString()}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common_close")}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                    <div>
                        <p className="text-sm">{mod.description}</p>
                    </div>

                    {mod.tags && mod.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {mod.tags.map((tag) => (
                                <span key={tag} className="px-2 py-0.5 text-[10px] rounded-full bg-muted/60 text-muted-foreground">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {mod.dependencies.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">{t("modules_dependencies")}</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {mod.dependencies.map((dep) => (
                                    <span key={dep} className="px-2 py-0.5 text-xs rounded bg-muted text-foreground">{dep}</span>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
