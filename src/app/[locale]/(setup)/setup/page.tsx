"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { toast } from "sonner";
import {
    Rocket,
    UserCog,
    Globe,
    Palette,
    Package,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Loader2,
    ArrowRight,
} from "lucide-react";

interface ThemeOption {
    id: string;
    name: string;
    description?: string;
}

interface ModuleOption {
    id: string;
    name: string;
    description: string;
    zipFile: string;
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

const RECOMMENDED_MODULES: ModuleOption[] = [
    { id: "blog", name: "Blog", description: "Publish news and articles.", zipFile: "blog.zip" },
    { id: "forum", name: "Forum", description: "Community discussion boards.", zipFile: "forum.zip" },
    { id: "store", name: "Store", description: "Sell products and services.", zipFile: "store.zip" },
    { id: "tickets", name: "Tickets", description: "Support ticketing system.", zipFile: "tickets.zip" },
    { id: "announcements", name: "Announcements", description: "Broadcast important updates.", zipFile: "announcements.zip" },
];

const STEPS = [
    { id: 1, label: "Welcome", icon: Rocket },
    { id: 2, label: "Admin", icon: UserCog },
    { id: 3, label: "Site", icon: Globe },
    { id: 4, label: "Theme", icon: Palette },
    { id: 5, label: "Modules", icon: Package },
    { id: 6, label: "Done", icon: CheckCircle2 },
];

export default function SetupWizardPage() {
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);

    // Step 2: Admin
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");

    // Step 3: Site
    const [siteName, setSiteName] = useState("uxwVend");
    const [siteDescription, setSiteDescription] = useState("");
    const [defaultLocaleCode, setDefaultLocaleCode] = useState("en");

    // Step 4: Theme
    const [themes, setThemes] = useState<ThemeOption[]>([
        { id: "flat", name: "Flat", description: "Default light theme." },
    ]);
    const [activeTheme, setActiveTheme] = useState("flat");

    // Step 5: Modules
    const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        // Attempt to fetch installed themes for the theme step.
        fetch("/api/setup/themes")
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { themes?: ThemeOption[] } | null) => {
                if (data?.themes && data.themes.length > 0) {
                    setThemes(data.themes);
                }
            })
            .catch(() => {
                /* non-fatal, keep default flat */
            });
    }, []);

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
                return activeTheme.length > 0;
            case 5:
                return true;
            default:
                return true;
        }
    };

    const goNext = () => {
        if (!canAdvance()) {
            toast.error("Please complete the required fields before continuing.");
            return;
        }
        if (step < STEPS.length) setStep(step + 1);
    };

    const goBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const moduleIds = Object.entries(selectedModules)
                .filter(([, v]) => v)
                .map(([k]) => k);

            const res = await fetch("/api/setup", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    admin: { email, username, password },
                    site: {
                        siteName,
                        siteDescription,
                        defaultLocale: defaultLocaleCode,
                    },
                    theme: activeTheme,
                    modules: moduleIds,
                }),
            });

            const data = (await res.json()) as { success?: boolean; error?: string; redirectTo?: string };

            if (!res.ok || !data.success) {
                toast.error(data.error || "Setup failed. Please try again.");
                setSubmitting(false);
                return;
            }

            setCompleted(true);
            setStep(6);
        } catch {
            toast.error("Setup failed. Please try again.");
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
                        <span className="font-bold text-2xl text-foreground">uxwVend Setup</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        A few quick steps and your platform is ready.
                    </p>
                </div>

                {/* Progress */}
                <div className="flex items-center justify-between mb-8">
                    {STEPS.map((s, idx) => {
                        const Icon = s.icon;
                        const reached = step >= s.id;
                        const active = step === s.id;
                        return (
                            <div key={s.id} className="flex-1 flex items-center">
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
                                        className={`text-[11px] mt-1 ${
                                            active ? "text-foreground font-medium" : "text-muted-foreground"
                                        }`}
                                    >
                                        {s.label}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div
                                        className={`h-0.5 w-full -mt-4 ${
                                            step > s.id ? "bg-blue-600" : "bg-border"
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
                        <ThemeStep themes={themes} activeTheme={activeTheme} setActiveTheme={setActiveTheme} />
                    )}
                    {step === 5 && (
                        <ModulesStep
                            selected={selectedModules}
                            setSelected={setSelectedModules}
                        />
                    )}
                    {step === 6 && <DoneStep completed={completed} />}
                </div>

                {step < 6 && (
                    <div className="flex items-center justify-between mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={goBack}
                            disabled={step === 1 || submitting}
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Back
                        </Button>

                        {step < 5 && (
                            <Button
                                type="button"
                                onClick={goNext}
                                disabled={!canAdvance()}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Next <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        )}

                        {step === 5 && (
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Finishing...
                                    </>
                                ) : (
                                    <>
                                        Finish Setup <ArrowRight className="w-4 h-4 ml-1" />
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

function WelcomeStep() {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Welcome to uxwVend</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
                This short wizard will help you set up your administrator account, configure your
                site&rsquo;s basic information, pick a theme, and optionally install a few recommended
                modules from the marketplace. You can always change these later from the admin panel.
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 pl-4">
                <li>1. Create your administrator account</li>
                <li>2. Set your site name and default language</li>
                <li>3. Choose an initial theme</li>
                <li>4. Optionally enable recommended modules</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-2">
                Click <strong>Next</strong> when you&rsquo;re ready to begin.
            </p>
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
    email,
    username,
    password,
    passwordConfirm,
    setEmail,
    setUsername,
    setPassword,
    setPasswordConfirm,
}: AdminStepProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Create your admin account</h2>
            <p className="text-sm text-muted-foreground">
                This account will have full administrator permissions.
            </p>
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Username</label>
                    <Input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        minLength={3}
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        minLength={8}
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Confirm password</label>
                    <Input
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="Re-enter your password"
                        minLength={8}
                        required
                    />
                    {password.length > 0 && passwordConfirm.length > 0 && password !== passwordConfirm && (
                        <p className="text-xs text-red-600">Passwords do not match.</p>
                    )}
                </div>
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
    siteName,
    siteDescription,
    defaultLocaleCode,
    setSiteName,
    setSiteDescription,
    setDefaultLocaleCode,
}: SiteStepProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Site configuration</h2>
            <div className="space-y-3">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Site name</label>
                    <Input
                        type="text"
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <Input
                        type="text"
                        value={siteDescription}
                        onChange={(e) => setSiteDescription(e.target.value)}
                        placeholder="Brief description of your community or store"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Default language</label>
                    <select
                        value={defaultLocaleCode}
                        onChange={(e) => setDefaultLocaleCode(e.target.value)}
                        className="w-full border border-border bg-background rounded-md px-3 py-2 text-sm text-foreground"
                    >
                        {LOCALE_OPTIONS.map((l) => (
                            <option key={l.code} value={l.code}>
                                {l.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}

interface ThemeStepProps {
    themes: ThemeOption[];
    activeTheme: string;
    setActiveTheme: (v: string) => void;
}

function ThemeStep({ themes, activeTheme, setActiveTheme }: ThemeStepProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Choose a theme</h2>
            <p className="text-sm text-muted-foreground">
                Pick the look and feel of your site. You can switch themes later.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {themes.map((t) => {
                    const active = activeTheme === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTheme(t.id)}
                            className={`p-4 rounded-lg border-2 text-left transition-colors ${
                                active
                                    ? "border-blue-600 bg-blue-50"
                                    : "border-border bg-card hover:border-blue-300"
                            }`}
                        >
                            <div className="font-medium text-foreground">{t.name}</div>
                            {t.description && (
                                <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

interface ModulesStepProps {
    selected: Record<string, boolean>;
    setSelected: (v: Record<string, boolean>) => void;
}

function ModulesStep({ selected, setSelected }: ModulesStepProps) {
    const toggle = (id: string) => {
        setSelected({ ...selected, [id]: !selected[id] });
    };
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Recommended modules</h2>
            <p className="text-sm text-muted-foreground">
                Install a few common modules to get started. You can skip this step and install
                modules from the marketplace at any time.
            </p>
            <div className="space-y-2">
                {RECOMMENDED_MODULES.map((m) => (
                    <label
                        key={m.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 cursor-pointer transition-colors"
                    >
                        <input
                            type="checkbox"
                            checked={!!selected[m.id]}
                            onChange={() => toggle(m.id)}
                            className="mt-1"
                        />
                        <div>
                            <div className="font-medium text-foreground">{m.name}</div>
                            <div className="text-xs text-muted-foreground">{m.description}</div>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}

function DoneStep({ completed }: { completed: boolean }) {
    return (
        <div className="text-center space-y-4 py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
                {completed ? "Setup complete!" : "Finishing..."}
            </h2>
            <p className="text-sm text-muted-foreground">
                {completed
                    ? "Your platform is ready. You can sign in to the admin panel now."
                    : "Please wait while we finalize your setup."}
            </p>
            {completed && (
                <div className="pt-2">
                    <Link
                        href="/admin"
                        className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                    >
                        Go to admin panel <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            )}
        </div>
    );
}
