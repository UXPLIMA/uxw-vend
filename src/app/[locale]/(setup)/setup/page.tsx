"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { toast } from "sonner";
import { defaultThemeId } from "@/core/generated/theme-registry";
import {
    resolveInstallPlan,
    installPlanErrorMessage,
    parseDependency,
    type CatalogEntry,
} from "@/core/lib/install-plan";
import {
    Rocket,
    UserCog,
    Globe,
    Compass,
    Palette,
    Package,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Loader2,
    ArrowRight,
    Search,
    Lock,
    AlertTriangle,
} from "lucide-react";

interface ThemeOption {
    id: string;
    name: string;
    description?: string;
    suggestedModules?: string[];
}

interface PresetOption {
    id: string;
    name: string;
    description: string;
    icon?: string;
    theme?: string;
    modules: string[];
}

interface ModuleOption {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    dependencies: string[];
    conflicts: string[];
    version: string;
    coreVersion: string | null;
}

const LOCALE_OPTIONS = [
    { code: "en", label: "English" },
    { code: "tr", label: "Türkçe" },
    { code: "de", label: "Deutsch" },
    { code: "es", label: "Español" },
    { code: "fr", label: "Français" },
    { code: "ru", label: "Русский" },
    { code: "pt", label: "Português" },
];

/**
 * Known categories in display order. Anything a module declares that isn't
 * here still renders — it lands in "other" — so core never gates which
 * categories exist.
 */
const CATEGORY_ORDER = ["commerce", "community", "gaming", "management", "content", "integration"];

/** Categories `setup.modules.categories` has a label for. */
const LABELLED_CATEGORIES = new Set([...CATEGORY_ORDER, "other"]);

const STEP_IDS = ["welcome", "admin", "site", "type", "theme", "modules", "done"] as const;
const STEP_ICONS = [Rocket, UserCog, Globe, Compass, Palette, Package, CheckCircle2];
const LAST_INPUT_STEP = STEP_IDS.length - 1; // "modules" — the step that submits
const DONE_STEP = STEP_IDS.length; // 1-based

export default function SetupWizardPage() {
    const t = useTranslations("setup");

    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [result, setResult] = useState<SetupResult | null>(null);

    // Step 2: Admin
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");

    // Step 3: Site
    const [siteName, setSiteName] = useState("uxwVend");
    const [siteDescription, setSiteDescription] = useState("");
    const [defaultLocaleCode, setDefaultLocaleCode] = useState("en");

    // Step 4: Site type — presets are marketplace data, never a list in core.
    const [presets, setPresets] = useState<PresetOption[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

    // Step 5: Theme — the default id comes from the generated theme registry
    // so core never names a specific theme.
    const [themes, setThemes] = useState<ThemeOption[]>([]);
    const [activeTheme, setActiveTheme] = useState<string>(defaultThemeId);

    // Step 6: Modules — populated from the marketplace catalog at mount time.
    const [catalog, setCatalog] = useState<ModuleOption[]>([]);
    const [picked, setPicked] = useState<string[]>([]);

    useEffect(() => {
        fetch("/api/setup/themes")
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { themes?: ThemeOption[] } | null) => {
                if (!data?.themes?.length) return;
                setThemes(data.themes);
                if (!data.themes.some((x) => x.id === defaultThemeId)) {
                    setActiveTheme(data.themes[0].id);
                }
            })
            .catch(() => {
                /* non-fatal — the theme step explains the empty state */
            });

        fetch("/api/setup/presets")
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { presets?: PresetOption[] } | null) => {
                if (data?.presets?.length) setPresets(data.presets);
            })
            .catch(() => {
                /* non-fatal — the site-type step explains the empty state */
            });

        fetch("/api/v1/modules/marketplace")
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { modules?: Array<Partial<ModuleOption> & { id: string; name: string }> } | null) => {
                if (!data?.modules) return;
                setCatalog(
                    data.modules.map((m) => ({
                        id: m.id,
                        name: m.name,
                        description: m.description ?? "",
                        category: m.category ?? "other",
                        tags: m.tags ?? [],
                        dependencies: m.dependencies ?? [],
                        conflicts: m.conflicts ?? [],
                        version: m.version ?? "0.0.0",
                        coreVersion: m.coreVersion ?? null,
                    })),
                );
            })
            .catch(() => {
                /* non-fatal — modules step shows an empty list */
            });
    }, []);

    // Everything the wizard shows about the selection — what will actually be
    // installed, what got pulled in, and why a combination is refused — comes
    // from the same planner the setup API runs server-side. Two
    // implementations would eventually disagree, and the operator would be
    // shown one thing and given another.
    const catalogEntries: CatalogEntry[] = useMemo(
        () =>
            catalog.map((m) => ({
                id: m.id,
                version: m.version,
                dependencies: m.dependencies,
                conflicts: m.conflicts,
                ...(m.coreVersion ? { coreVersion: m.coreVersion } : {}),
            })),
        [catalog],
    );

    const plan = useMemo(
        () => resolveInstallPlan(picked, catalogEntries),
        [picked, catalogEntries],
    );

    const applyPreset = (preset: PresetOption) => {
        setSelectedPreset(preset.id);
        setPicked(preset.modules);
        if (preset.theme) setActiveTheme(preset.theme);
    };

    const togglePicked = (id: string) => {
        setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
        // A hand-edited selection is no longer the preset's selection.
        setSelectedPreset(null);
    };

    const canAdvance = (): boolean => {
        switch (step) {
            case 1:
                return true;
            case 2:
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
                if (!username || username.length < 3) return false;
                if (!password || password.length < 8) return false;
                if (password !== passwordConfirm) return false;
                return true;
            case 3:
                return siteName.trim().length > 0;
            case 4:
                return true;
            case 5:
                return activeTheme.length > 0;
            case 6:
                // Never let a refused combination reach the API — the server
                // would reject it after the admin account is already created.
                return plan.errors.length === 0;
            default:
                return true;
        }
    };

    const goNext = () => {
        if (!canAdvance()) {
            toast.error(t("incomplete"));
            return;
        }
        if (step < DONE_STEP) setStep(step + 1);
    };

    const goBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async () => {
        if (!canAdvance()) {
            toast.error(t("incomplete"));
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/setup", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    admin: { email, username, password },
                    site: { siteName, siteDescription, defaultLocale: defaultLocaleCode },
                    theme: activeTheme,
                    // Send the planned order, not the raw clicks: dependencies
                    // are included and prerequisites come first.
                    modules: plan.order,
                }),
            });

            const data = (await res.json()) as SetupResult & { error?: string };

            if (!res.ok || !data.success) {
                toast.error(data.error || t("failed"));
                setSubmitting(false);
                return;
            }

            setResult(data);
            setCompleted(true);
            setStep(DONE_STEP);
        } catch {
            toast.error(t("failed"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-2">
                        <Rocket className="w-6 h-6 text-blue-600" />
                        <span className="font-bold text-2xl text-foreground">{t("title")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
                </div>

                {/* Progress */}
                <div className="flex items-center justify-between mb-8">
                    {STEP_IDS.map((id, idx) => {
                        const Icon = STEP_ICONS[idx];
                        const number = idx + 1;
                        const reached = step >= number;
                        const active = step === number;
                        return (
                            <div key={id} className="flex-1 flex items-center">
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                                            active
                                                ? "bg-blue-600 border-blue-600 text-white"
                                                : reached
                                                  ? "bg-blue-100 border-blue-600 text-blue-600"
                                                  : "bg-card border-border text-muted-foreground"
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <span
                                        className={`text-[11px] mt-1 text-center ${
                                            active ? "text-foreground font-medium" : "text-muted-foreground"
                                        }`}
                                    >
                                        {t(`steps.${id}`)}
                                    </span>
                                </div>
                                {idx < STEP_IDS.length - 1 && (
                                    <div
                                        className={`h-0.5 w-full -mt-4 ${
                                            step > number ? "bg-blue-600" : "bg-border"
                                        }`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="bg-card border border-border rounded-lg shadow-sm p-6">
                    {step === 1 && <WelcomeStep />}
                    {step === 2 && (
                        <AdminStep
                            email={email}
                            username={username}
                            password={password}
                            passwordConfirm={passwordConfirm}
                            setEmail={setEmail}
                            setUsername={setUsername}
                            setPassword={setPassword}
                            setPasswordConfirm={setPasswordConfirm}
                        />
                    )}
                    {step === 3 && (
                        <SiteStep
                            siteName={siteName}
                            siteDescription={siteDescription}
                            defaultLocaleCode={defaultLocaleCode}
                            setSiteName={setSiteName}
                            setSiteDescription={setSiteDescription}
                            setDefaultLocaleCode={setDefaultLocaleCode}
                        />
                    )}
                    {step === 4 && (
                        <SiteTypeStep
                            presets={presets}
                            selected={selectedPreset}
                            onSelect={applyPreset}
                        />
                    )}
                    {step === 5 && (
                        <ThemeStep themes={themes} activeTheme={activeTheme} setActiveTheme={setActiveTheme} />
                    )}
                    {step === 6 && (
                        <ModulesStep
                            catalog={catalog}
                            picked={picked}
                            plan={plan}
                            onToggle={togglePicked}
                            onClear={() => {
                                setPicked([]);
                                setSelectedPreset(null);
                            }}
                        />
                    )}
                    {step === DONE_STEP && <DoneStep completed={completed} result={result} />}
                </div>

                {step < DONE_STEP && (
                    <div className="flex items-center justify-between mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={goBack}
                            disabled={step === 1 || submitting}
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> {t("back")}
                        </Button>

                        {step < LAST_INPUT_STEP && (
                            <Button
                                type="button"
                                onClick={goNext}
                                disabled={!canAdvance()}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {t("next")} <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        )}

                        {step === LAST_INPUT_STEP && (
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting || !canAdvance()}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("finishing")}
                                    </>
                                ) : (
                                    <>
                                        {t("finish")} <ArrowRight className="w-4 h-4 ml-1" />
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

interface SetupResult {
    success?: boolean;
    installedModules?: string[];
    autoAdded?: string[];
    failedModules?: Array<{ id: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function WelcomeStep() {
    const t = useTranslations("setup.welcome");
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("body")}</p>
            <p className="text-xs text-muted-foreground italic">{t("note")}</p>
        </div>
    );
}

interface AdminStepProps {
    email: string;
    username: string;
    password: string;
    passwordConfirm: string;
    setEmail: (v: string) => void;
    setUsername: (v: string) => void;
    setPassword: (v: string) => void;
    setPasswordConfirm: (v: string) => void;
}

function AdminStep({
    email, username, password, passwordConfirm,
    setEmail, setUsername, setPassword, setPasswordConfirm,
}: AdminStepProps) {
    const t = useTranslations("setup.admin");
    const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            <div className="space-y-3">
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("email")}</span>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("username")}</span>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("password")}</span>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                    <span className="text-xs text-muted-foreground">{t("passwordHint")}</span>
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("passwordConfirm")}</span>
                    <Input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" />
                    {mismatch && <span className="text-xs text-red-600">{t("mismatch")}</span>}
                </label>
            </div>
        </div>
    );
}

interface SiteStepProps {
    siteName: string;
    siteDescription: string;
    defaultLocaleCode: string;
    setSiteName: (v: string) => void;
    setSiteDescription: (v: string) => void;
    setDefaultLocaleCode: (v: string) => void;
}

function SiteStep({
    siteName, siteDescription, defaultLocaleCode,
    setSiteName, setSiteDescription, setDefaultLocaleCode,
}: SiteStepProps) {
    const t = useTranslations("setup.site");
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            <div className="space-y-3">
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("name")}</span>
                    <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("descriptionField")}</span>
                    <Input value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} />
                    <span className="text-xs text-muted-foreground">{t("descriptionHint")}</span>
                </label>
                <label className="block">
                    <span className="text-sm font-medium text-foreground">{t("locale")}</span>
                    <select
                        value={defaultLocaleCode}
                        onChange={(e) => setDefaultLocaleCode(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
                    >
                        {LOCALE_OPTIONS.map((l) => (
                            <option key={l.code} value={l.code}>{l.label}</option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    );
}

interface SiteTypeStepProps {
    presets: PresetOption[];
    selected: string | null;
    onSelect: (p: PresetOption) => void;
}

function SiteTypeStep({ presets, selected, onSelect }: SiteTypeStepProps) {
    const t = useTranslations("setup.type");
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            {presets.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t("unavailable")}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {presets.map((p) => {
                        const active = selected === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelect(p)}
                                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                                    active ? "border-blue-600 bg-blue-50" : "border-border bg-card hover:border-blue-300"
                                }`}
                            >
                                <div className="font-medium text-foreground">{p.name}</div>
                                {p.description && (
                                    <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
                                )}
                                <div className="text-[11px] text-blue-700 mt-2">
                                    {p.modules.length > 0
                                        ? t("moduleCount", { count: p.modules.length })
                                        : t("noModules")}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

interface ThemeStepProps {
    themes: ThemeOption[];
    activeTheme: string;
    setActiveTheme: (v: string) => void;
}

function ThemeStep({ themes, activeTheme, setActiveTheme }: ThemeStepProps) {
    const t = useTranslations("setup.theme");
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
            {themes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t("empty")}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {themes.map((th) => {
                        const active = activeTheme === th.id;
                        return (
                            <button
                                key={th.id}
                                type="button"
                                onClick={() => setActiveTheme(th.id)}
                                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                                    active ? "border-blue-600 bg-blue-50" : "border-border bg-card hover:border-blue-300"
                                }`}
                            >
                                <div className="font-medium text-foreground">{th.name}</div>
                                {th.description && (
                                    <div className="text-xs text-muted-foreground mt-1">{th.description}</div>
                                )}
                                {th.suggestedModules && th.suggestedModules.length > 0 && (
                                    <div className="text-[11px] text-muted-foreground mt-2">
                                        {t("suggested", { modules: th.suggestedModules.join(", ") })}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

interface ModulesStepProps {
    catalog: ModuleOption[];
    picked: string[];
    plan: ReturnType<typeof resolveInstallPlan>;
    onToggle: (id: string) => void;
    onClear: () => void;
}

function ModulesStep({ catalog, picked, plan, onToggle, onClear }: ModulesStepProps) {
    const t = useTranslations("setup.modules");
    const [query, setQuery] = useState("");

    const pickedSet = useMemo(() => new Set(picked), [picked]);
    const autoAddedSet = useMemo(() => new Set(plan.autoAdded), [plan.autoAdded]);

    /** For an auto-added module, which picked modules pulled it in. */
    const requiredBy = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const m of catalog) {
            if (!plan.order.includes(m.id)) continue;
            for (const spec of m.dependencies) {
                const dep = parseDependency(spec).id;
                if (!map.has(dep)) map.set(dep, []);
                map.get(dep)!.push(m.id);
            }
        }
        return map;
    }, [catalog, plan.order]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return catalog;
        return catalog.filter(
            (m) =>
                m.name.toLowerCase().includes(q) ||
                m.description.toLowerCase().includes(q) ||
                m.id.includes(q) ||
                m.tags.some((tag) => tag.toLowerCase().includes(q)),
        );
    }, [catalog, query]);

    // Group by whatever categories the catalog actually declares. Known ones
    // lead in a fixed order; anything else follows alphabetically, so a module
    // inventing a category still shows up rather than vanishing.
    const grouped = useMemo(() => {
        const byCategory = new Map<string, ModuleOption[]>();
        for (const m of filtered) {
            const key = m.category || "other";
            if (!byCategory.has(key)) byCategory.set(key, []);
            byCategory.get(key)!.push(m);
        }
        const known = CATEGORY_ORDER.filter((c) => byCategory.has(c));
        const rest = [...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
        return [...known, ...rest].map((c) => [c, byCategory.get(c)!] as const);
    }, [filtered]);

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>

            {catalog.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t("empty")}</p>
            ) : (
                <>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("search")}
                            className="pl-9"
                        />
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-foreground font-medium">
                            {t("selectedCount", { count: pickedSet.size })}
                        </span>
                        {autoAddedSet.size > 0 && (
                            <span className="text-blue-700">
                                {t("autoAddedCount", { count: autoAddedSet.size })}
                            </span>
                        )}
                        {pickedSet.size > 0 && (
                            <button
                                type="button"
                                onClick={onClear}
                                className="ml-auto text-muted-foreground hover:text-foreground underline"
                            >
                                {t("clear")}
                            </button>
                        )}
                    </div>

                    {plan.errors.length > 0 && (
                        <div className="rounded-md border border-red-300 bg-red-50 p-3 space-y-1">
                            {plan.errors.map((e, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-red-800">
                                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{installPlanErrorMessage(e)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {filtered.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">{t("noResults", { query })}</p>
                    ) : (
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                            {grouped.map(([category, mods]) => (
                                <div key={category}>
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                        {categoryLabel(t, category)}
                                    </h3>
                                    <div className="space-y-2">
                                        {mods.map((m) => {
                                            const isPicked = pickedSet.has(m.id);
                                            const isAuto = autoAddedSet.has(m.id);
                                            const pulledBy = requiredBy.get(m.id) ?? [];
                                            const deps = m.dependencies.map((s) => parseDependency(s).id);
                                            return (
                                                <label
                                                    key={m.id}
                                                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                                        isAuto
                                                            ? "border-blue-300 bg-blue-50/60 cursor-default"
                                                            : "border-border hover:bg-accent/30 cursor-pointer"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isPicked || isAuto}
                                                        // An auto-added module can't be unchecked here:
                                                        // it is only present because something selected
                                                        // needs it. Deselect that instead.
                                                        disabled={isAuto && !isPicked}
                                                        onChange={() => onToggle(m.id)}
                                                        className="mt-1"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-foreground flex items-center gap-1.5">
                                                            {m.name}
                                                            {isAuto && !isPicked && (
                                                                <Lock className="w-3 h-3 text-blue-600" />
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {m.description}
                                                        </div>
                                                        {isAuto && !isPicked && pulledBy.length > 0 && (
                                                            <div className="text-[11px] text-blue-700 mt-1">
                                                                {t("requiredBy", { modules: pulledBy.join(", ") })}
                                                            </div>
                                                        )}
                                                        {!isAuto && deps.length > 0 && (
                                                            <div className="text-[11px] text-muted-foreground mt-1">
                                                                {t("requires", { modules: deps.join(", ") })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * Falls back to the raw slug when a module declares a category we have no
 * label for. Membership is checked against our own list rather than asking the
 * translator, so an unlabelled category renders its slug instead of a missing
 * -key warning.
 */
function categoryLabel(t: ReturnType<typeof useTranslations>, category: string): string {
    return LABELLED_CATEGORIES.has(category) ? t(`categories.${category}`) : category;
}

function DoneStep({ completed, result }: { completed: boolean; result: SetupResult | null }) {
    const t = useTranslations("setup.done");
    const installed = result?.installedModules ?? [];
    const autoAdded = result?.autoAdded ?? [];
    const failed = result?.failedModules ?? [];
    return (
        <div className="text-center space-y-4 py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
                {completed ? t("title") : t("working")}
            </h2>
            <p className="text-sm text-muted-foreground">{completed ? t("body") : t("waiting")}</p>

            {completed && installed.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                    <div>{t("installed", { modules: installed.join(", ") })}</div>
                    {autoAdded.length > 0 && (
                        <div className="text-blue-700">
                            {t("autoAdded", { modules: autoAdded.join(", ") })}
                        </div>
                    )}
                </div>
            )}
            {completed && failed.length > 0 && (
                <div className="text-xs text-red-700">
                    {t("failed", { modules: failed.map((f) => f.id).join(", ") })}
                </div>
            )}

            {completed && (
                <div className="pt-2">
                    <Link
                        href="/admin"
                        className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                    >
                        {t("goAdmin")} <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            )}
        </div>
    );
}
