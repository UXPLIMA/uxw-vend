"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import {
    Package, Upload, Loader2, Trash2, Download, CheckCircle, ShoppingCart,
    MessageSquare, FileText, Ticket, HelpCircle, Shield, History, Users,
    Vote, Dices, Trophy, Star, Bell, Server, FileEdit, ImageIcon, Crown,
    Megaphone, Search as SearchIcon, ArrowUp
} from "lucide-react";
import { toast } from "sonner";
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
    zip: string;
    dependencies: string[];
    stats: { publicRoutes: number; adminRoutes: number; apiRoutes: number; widgets: number };
}

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
    Star: <Star size={22} />,
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
    content: "bg-gray-100 text-gray-700",
};

export default function AdminModulesPage() {
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

    // Global lock — only one operation at a time
    const isBusy = installing !== null || uploading || deleting !== null || updatingModule !== null;
    const [marketplaceFilter, setMarketplaceFilter] = useState<string>("all");
    const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
    const [bulkInstalling, setBulkInstalling] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; name: string } | null>(null);
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

    const installedIds = new Set(modules.map(m => m.id));

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
                toast.success(`${moduleId} ${enabled ? "enabled" : "disabled"}`);
            } else {
                toast.error(data.error || "Failed");
            }
        } catch { toast.error("Network error"); }
        finally { setUpdating(null); }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (isBusy) { toast.error("Please wait — another operation is in progress"); return; }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/v1/modules/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (res.ok) { toast.success(`"${data.module?.name}" installed`); fetchModules(); }
            else toast.error(data.error || "Upload failed");
        } catch { toast.error("Upload failed"); }
        finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    };

    const handleDelete = async (moduleId: string, moduleName: string) => {
        if (isBusy) { toast.error("Please wait — another operation is in progress"); return; }
        const ok = await confirm({ title: "Delete Module", message: `Delete "${moduleName}"? This removes all module files.`, variant: "danger", confirmText: "Delete" });
        if (!ok) return;
        setDeleting(moduleId);
        try {
            const res = await fetch(`/api/v1/modules/${moduleId}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok) { toast.success(`"${moduleName}" deleted`); fetchModules(); }
            else toast.error(data.error || "Delete failed");
        } catch { toast.error("Delete failed"); }
        finally { setDeleting(null); }
    };

    const handleUpdate = async (mod: Module) => {
        if (isBusy) { toast.error("Please wait — another operation is in progress"); return; }
        const mpMod = marketplace.find(m => m.id === mod.id);
        if (!mpMod) { toast.error("Module not found in marketplace"); return; }
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
                toast.error(data.error || "Update failed");
            }
        } catch { toast.error("Update failed"); }
        finally { setUpdatingModule(null); }
    };

    const handleMarketplaceInstall = async (mod: MarketplaceModule) => {
        if (isBusy) {
            toast.error("Please wait — another operation is in progress");
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
            } else {
                toast.error(data.error || "Install failed");
            }
        } catch { toast.error("Install failed"); }
        finally {
            setTimeout(() => { setInstalling(null); setInstallProgress(null); }, 500);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedModules);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedModules(next);
    };

    const handleBulkInstall = async () => {
        const toInstall = marketplace.filter(m => selectedModules.has(m.id) && !installedIds.has(m.id));
        if (toInstall.length === 0) return;

        const ok = await confirm({
            title: "Bulk Install",
            message: `Install ${toInstall.length} modules? This may take a few minutes as the system will rebuild after all modules are installed.`,
            confirmText: `Install ${toInstall.length} modules`,
        });
        if (!ok) return;

        setBulkInstalling(true);
        setBulkProgress({ current: 0, total: toInstall.length, name: "Preparing..." });

        try {
            // Single API call — server handles all installs + single build
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
                toast.error(data.error || "Bulk install failed");
            }
        } catch {
            toast.error("Bulk install failed");
        }

        setSelectedModules(new Set());
        setBulkInstalling(false);
        setBulkProgress(null);
        fetchModules();
    };

    const filteredMarketplace = marketplace.filter(m => {
        if (marketplaceFilter !== "all" && m.category !== marketplaceFilter) return false;
        return !installedIds.has(m.id);
    });

    const categories = [...new Set(marketplace.map(m => m.category))];

    return (
        <>
            {/* Install/Operation Progress Overlay */}
            {(installProgress || bulkProgress) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/50" />
                    <div className="relative bg-card border rounded-xl shadow-2xl p-8 w-full max-w-sm mx-4 text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                        {bulkProgress ? (
                            <>
                                <h3 className="font-semibold text-lg mb-1">Installing modules ({bulkProgress.current}/{bulkProgress.total})</h3>
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
                <h1 className="text-3xl font-bold">Modules</h1>
                <p className="text-muted-foreground">Install, enable, and manage platform modules</p>
            </div>

            {/* Upload Module */}
            <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="font-semibold">Custom Module</h3>
                            <p className="text-sm text-muted-foreground">Upload a .zip file with module.json</p>
                        </div>
                        <div>
                            <input type="file" accept=".zip" ref={fileInputRef} className="hidden" onChange={handleUpload} />
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Installing...</> : <><Upload className="w-4 h-4 mr-2" /> Upload ZIP</>}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Installed Modules */}
            <div className="mb-10">
                <h2 className="text-xl font-bold mb-4">Installed Modules ({modules.length})</h2>

                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : modules.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground mb-1">No modules installed</p>
                            <p className="text-sm text-muted-foreground">Browse the marketplace below to get started</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {modules.map((mod) => (
                            <Card key={mod.id} className={`transition-all ${!mod.enabled ? "opacity-60" : ""}`}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-primary">{iconMap[mod.icon || ""] || <Package size={22} />}</span>
                                            <div>
                                                <h3 className="font-semibold text-sm">{mod.name}</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    v{mod.version}
                                                    {mod.updateAvailable && mod.latestVersion && (
                                                        <span className="ml-1 text-amber-600 font-medium">
                                                            → v{mod.latestVersion}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${mod.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                            {mod.enabled ? "ON" : "OFF"}
                                        </span>
                                    </div>

                                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{mod.description}</p>

                                    {((mod.dependencies && mod.dependencies.length > 0) || (mod.conflicts && mod.conflicts.length > 0)) && (
                                        <div className="mb-3 space-y-1">
                                            {mod.dependencies && mod.dependencies.length > 0 && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-amber-600 font-medium">Requires:</span>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {mod.dependencies.map(dep => {
                                                            const depMod = modules.find(m => m.id === dep);
                                                            const isInstalled = depMod?.enabled;
                                                            return (
                                                                <span key={dep} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isInstalled ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                                                                    {depMod?.name || dep} {isInstalled ? "✓" : "missing"}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            {mod.conflicts && mod.conflicts.length > 0 && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-red-500 font-medium">Incompatible:</span>
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
                                            {updating === mod.id ? <Loader2 className="w-3 h-3 animate-spin" /> : mod.enabled ? "Disable" : "Enable"}
                                        </Button>
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
                        ))}
                    </div>
                )}
            </div>

            {/* Marketplace */}
            <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-blue-500" />
                            Verified Modules
                        </h2>
                        <p className="text-sm text-muted-foreground">Official modules from the uxwVend marketplace</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        {selectedModules.size > 0 && (
                            <Button size="sm" onClick={handleBulkInstall} disabled={isBusy || bulkInstalling}>
                                {bulkInstalling ? <><Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Installing...</> : <><Download className="w-3 h-3 mr-1.5" /> Install {selectedModules.size} selected</>}
                            </Button>
                        )}
                        {filteredMarketplace.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => {
                                if (selectedModules.size === filteredMarketplace.length) setSelectedModules(new Set());
                                else setSelectedModules(new Set(filteredMarketplace.map(m => m.id)));
                            }}>
                                {selectedModules.size === filteredMarketplace.length ? "Deselect All" : "Select All"}
                            </Button>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant={marketplaceFilter === "all" ? "default" : "outline"} onClick={() => setMarketplaceFilter("all")}>All</Button>
                            {categories.map(cat => (
                                <Button key={cat} size="sm" variant={marketplaceFilter === cat ? "default" : "outline"} onClick={() => setMarketplaceFilter(cat)} className="capitalize">
                                    {cat}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                {loadingMarketplace ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : filteredMarketplace.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            {marketplace.length === 0 ? "Could not load marketplace" : "All modules in this category are already installed"}
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
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <span className="text-blue-500">{iconMap[mod.icon] || <Package size={22} />}</span>
                                            <div>
                                                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                                                    {mod.name}
                                                    {mod.verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500" />}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">v{mod.version} by {mod.author}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${categoryColors[mod.category] || "bg-gray-100 text-gray-700"}`}>
                                            {mod.category}
                                        </span>
                                    </div>

                                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{mod.description}</p>

                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                                        {mod.stats.publicRoutes > 0 && <span>{mod.stats.publicRoutes} pages</span>}
                                        {mod.stats.adminRoutes > 0 && <span>{mod.stats.adminRoutes} admin</span>}
                                        {mod.stats.apiRoutes > 0 && <span>{mod.stats.apiRoutes} APIs</span>}
                                        {mod.stats.widgets > 0 && <span>{mod.stats.widgets} widgets</span>}
                                    </div>

                                    {mod.dependencies.length > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs mb-3">
                                            <span className="text-amber-600 font-medium">Requires:</span>
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
                                            <><Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Installing...</>
                                        ) : (
                                            <><Download className="w-3 h-3 mr-1.5" /> Install</>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
