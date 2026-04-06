"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import {
    Loader2, Check, ArrowRight, ArrowLeft, Upload, Download, Palette,
    Package, CheckCircle, ShoppingCart, MessageSquare, FileText, Ticket,
    HelpCircle, Shield, History, Users, Vote, Dices, Trophy, Star, Bell,
    Server, FileEdit, ImageIcon, Crown, Megaphone, Search as SearchIcon
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

const steps = ["Welcome", "Site Info", "Modules", "Theme", "Done"];

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

interface InstalledModule {
    id: string;
    name: string;
    enabled: boolean;
}

interface ThemeInfo {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    componentCount: number;
}

const iconMap: Record<string, React.ReactNode> = {
    ShoppingCart: <ShoppingCart size={20} />,
    MessageSquare: <MessageSquare size={20} />,
    FileText: <FileText size={20} />,
    Ticket: <Ticket size={20} />,
    HelpCircle: <HelpCircle size={20} />,
    Shield: <Shield size={20} />,
    History: <History size={20} />,
    Users: <Users size={20} />,
    Vote: <Vote size={20} />,
    Dices: <Dices size={20} />,
    Trophy: <Trophy size={20} />,
    Star: <Star size={20} />,
    Bell: <Bell size={20} />,
    Server: <Server size={20} />,
    FileEdit: <FileEdit size={20} />,
    Image: <ImageIcon size={20} />,
    Crown: <Crown size={20} />,
    Megaphone: <Megaphone size={20} />,
    Download: <Download size={20} />,
    Package: <Package size={20} />,
    Search: <SearchIcon size={20} />,
};

// Essential module categories that most setups benefit from
const ESSENTIAL_CATEGORIES = ["commerce", "community", "management"];
const MAX_RECOMMENDED = 6;

export default function SetupWizardPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        siteName: "uxwVend",
        siteDescription: "",
        serverIp: "",
        contactEmail: "",
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Modules step state
    const [marketplaceModules, setMarketplaceModules] = useState<MarketplaceModule[]>([]);
    const [installedModules, setInstalledModules] = useState<InstalledModule[]>([]);
    const [loadingModules, setLoadingModules] = useState(true);
    const [installingModule, setInstallingModule] = useState<string | null>(null);

    // Theme step state
    const [themes, setThemes] = useState<ThemeInfo[]>([]);
    const [selectedTheme, setSelectedTheme] = useState<string>("flat");
    const [loadingThemes, setLoadingThemes] = useState(true);

    useEffect(() => {
        // Fetch marketplace modules
        fetch("/api/v1/modules/marketplace")
            .then(res => res.json())
            .then(data => setMarketplaceModules(data.modules || []))
            .catch(() => {})
            .finally(() => setLoadingModules(false));

        // Fetch installed modules
        fetch("/api/v1/modules")
            .then(res => res.json())
            .then(data => setInstalledModules(data.modules || []))
            .catch(() => {});

        // Fetch themes
        fetch("/api/v1/themes")
            .then(res => res.json())
            .then(data => setThemes(data.themes || []))
            .catch(() => {})
            .finally(() => setLoadingThemes(false));
    }, []);

    const installedIds = new Set(installedModules.map(m => m.id));

    // Select recommended modules: verified, from essential categories, not already installed
    const recommendedModules = marketplaceModules
        .filter(m => m.verified && ESSENTIAL_CATEGORIES.includes(m.category) && !installedIds.has(m.id))
        .sort((a, b) => {
            // Sort by total feature count (routes + widgets) descending
            const aScore = a.stats.publicRoutes + a.stats.adminRoutes + a.stats.apiRoutes + a.stats.widgets;
            const bScore = b.stats.publicRoutes + b.stats.adminRoutes + b.stats.apiRoutes + b.stats.widgets;
            return bScore - aScore;
        })
        .slice(0, MAX_RECOMMENDED);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        const reader = new FileReader();
        reader.onload = () => setLogoPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleInstallModule = async (mod: MarketplaceModule) => {
        setInstallingModule(mod.id);
        try {
            const res = await fetch("/api/v1/modules/marketplace/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moduleId: mod.id, zipFile: mod.zip }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`"${mod.name}" installed`);
                setInstalledModules(prev => [...prev, { id: mod.id, name: mod.name, enabled: true }]);
            } else {
                toast.error(data.error || "Install failed");
            }
        } catch { toast.error("Install failed"); }
        finally { setInstallingModule(null); }
    };

    const handleSelectTheme = async (themeId: string) => {
        setSelectedTheme(themeId);
        try {
            await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active_theme: themeId }),
            });
        } catch { /* will be saved in final step too */ }
    };

    const saveAll = async () => {
        setSaving(true);
        try {
            // Upload logo if selected
            if (logoFile) {
                const formData = new FormData();
                formData.append("file", logoFile);
                formData.append("type", "logo");
                await fetch("/api/v1/upload", { method: "POST", body: formData }).catch(() => {});
            }

            // Save settings
            await fetch("/api/v1/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    active_theme: selectedTheme,
                    setup_completed: "true",
                }),
            });
            toast.success("Setup complete!");
            setStep(4);
        } catch {
            toast.error("Failed to save settings");
        }
        setSaving(false);
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-8">
                {steps.map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            i < step ? "bg-green-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
                        }`}>
                            {i < step ? <Check className="w-4 h-4" /> : i + 1}
                        </div>
                        {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? "bg-green-500" : "bg-muted"}`} />}
                    </div>
                ))}
            </div>

            {/* Step 0: Welcome */}
            {step === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <h1 className="text-3xl font-bold mb-4">Welcome to uxwVend!</h1>
                        <p className="text-muted-foreground mb-8">Let&apos;s set up your game server platform in a few quick steps.</p>
                        <Button size="lg" onClick={() => setStep(1)}>
                            Get Started <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Step 1: Site Info */}
            {step === 1 && (
                <Card>
                    <CardHeader><CardTitle>Site Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Site Name</Label>
                            <Input value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={form.siteDescription}
                                onChange={(e) => setForm({ ...form, siteDescription: e.target.value })}
                                placeholder="Describe your server or community"
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label>Logo</Label>
                            <div className="flex items-center gap-4 mt-1">
                                {logoPreview ? (
                                    <Image src={logoPreview} alt="Logo preview" width={64} height={64} className="w-16 h-16 rounded-lg object-contain border" />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                                        <ImageIcon className="w-6 h-6" />
                                    </div>
                                )}
                                <div>
                                    <input type="file" accept="image/*" ref={logoInputRef} className="hidden" onChange={handleLogoChange} />
                                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                                        <Upload className="w-4 h-4 mr-2" /> Upload Logo
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or SVG. Optional.</p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label>Server IP</Label>
                            <Input value={form.serverIp} onChange={(e) => setForm({ ...form, serverIp: e.target.value })} placeholder="play.example.com" />
                        </div>
                        <div>
                            <Label>Contact Email</Label>
                            <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="admin@example.com" />
                        </div>
                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                            <Button onClick={() => setStep(2)}>Next <ArrowRight className="w-4 h-4 ml-2" /></Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Recommended Modules */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" /> Recommended Modules
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Install essential modules to get started. You can install more later from the marketplace.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {loadingModules ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : recommendedModules.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
                                <p>All recommended modules are already installed!</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {recommendedModules.map(mod => {
                                    const isInstalled = installedIds.has(mod.id);
                                    return (
                                        <div key={mod.id} className="flex items-center justify-between p-3 rounded-lg border">
                                            <div className="flex items-center gap-3">
                                                <span className="text-blue-500">{iconMap[mod.icon] || <Package size={20} />}</span>
                                                <div>
                                                    <h4 className="font-medium text-sm flex items-center gap-1.5">
                                                        {mod.name}
                                                        {mod.verified && <CheckCircle className="w-3 h-3 text-blue-500" />}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground line-clamp-1">{mod.description}</p>
                                                </div>
                                            </div>
                                            {isInstalled ? (
                                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Installed
                                                </span>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={installingModule === mod.id}
                                                    onClick={() => handleInstallModule(mod)}
                                                >
                                                    {installingModule === mod.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <><Download className="w-3 h-3 mr-1.5" /> Install</>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="flex justify-between pt-6">
                            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                            <Button onClick={() => setStep(3)}>Next <ArrowRight className="w-4 h-4 ml-2" /></Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Theme Selection */}
            {step === 3 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="w-5 h-5" /> Choose a Theme
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Select a theme for your site. You can change this anytime in Settings.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {loadingThemes ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : themes.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                <p>No themes available. The default theme will be used.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {themes.map(theme => (
                                    <div
                                        key={theme.id}
                                        onClick={() => handleSelectTheme(theme.id)}
                                        className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                            selectedTheme === theme.id
                                                ? "border-blue-500 bg-blue-50/50"
                                                : "border-border hover:border-border"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Palette className={`w-5 h-5 ${selectedTheme === theme.id ? "text-blue-500" : "text-muted-foreground"}`} />
                                            <div>
                                                <h4 className="font-medium text-sm">{theme.name}</h4>
                                                {theme.description && (
                                                    <p className="text-xs text-muted-foreground">{theme.description}</p>
                                                )}
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {theme.author && <span className="text-xs text-muted-foreground">by {theme.author}</span>}
                                                    <span className="text-xs text-muted-foreground">v{theme.version}</span>
                                                    {theme.componentCount > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600">
                                                            {theme.componentCount} components
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {selectedTheme === theme.id && (
                                            <Check className="w-5 h-5 text-blue-500" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between pt-6">
                            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                            <Button onClick={saveAll} disabled={saving}>
                                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : <>Finish Setup <Check className="w-4 h-4 ml-2" /></>}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 4: Done */}
            {step === 4 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">You&apos;re all set!</h2>
                        <p className="text-muted-foreground mb-6">Your platform is ready. You can configure payments, Discord, and more in Settings.</p>
                        <Button onClick={() => router.push("/admin")}>Go to Dashboard</Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
