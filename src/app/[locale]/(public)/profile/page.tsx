"use client";

import { useState, useEffect, useId } from "react";
import { useSession } from "next-auth/react";
import { Link, useRouter } from "@/core/lib/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Check, Award, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { formatDate } from "@/core/lib/utils";
import { ModuleProfileTabs, ProfileTabRegistry } from "@/core/generated/module-registry";
import { useAllModules } from "@/core/providers/module-provider";
import { ModuleErrorBoundary } from "@/core/components/ModuleErrorBoundary";
import { NotificationPrefsTab } from "@/core/components/profile/NotificationPrefsTab";
import { MessagesTab } from "@/core/components/profile/MessagesTab";
import { SessionsTab } from "@/core/components/profile/SessionsTab";
import { ActivityTab } from "@/core/components/profile/ActivityTab";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface UserProfile {
    id: string;
    email: string;
    username: string;
    avatar: string | null;
    locale: string;
    currency: string;
    createdAt: string;
    role: { name: string; displayName: string; color: string | null } | null;
}

export default function ProfilePage() {
    const { status: authStatus } = useSession();
    const router = useRouter();
    const modules = useAllModules();
    const t = useTranslations("profile");
    const commonT = useTranslations("common");

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>("profile");

    // Stable ids for label associations
    const usernameId = useId();
    const avatarId = useId();
    const emailId = useId();
    const memberSinceId = useId();
    const deletePasswordId = useId();
    const deleteConfirmId = useId();
    const mcUsernameId = useId();

    // Trophies earned by this user
    interface EarnedTrophy {
        id: string;
        awardedAt: string;
        trophy: {
            id: string;
            name: string;
            description: string | null;
            icon: string | null;
            color: string | null;
            points: number;
        };
    }
    const [earnedTrophies, setEarnedTrophies] = useState<EarnedTrophy[]>([]);
    const [totalTrophies, setTotalTrophies] = useState(0);

    // Linked accounts
    const [linkedAccounts, setLinkedAccounts] = useState<{ id: string; provider: string; username: string | null }[]>([]);
    const [mcUsername, setMcUsername] = useState("");

    // Profile form
    const [username, setUsername] = useState("");
    const [avatar, setAvatar] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [profileError, setProfileError] = useState("");

    // Privacy / GDPR
    const [exportingData, setExportingData] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const handleExportData = async () => {
        setExportingData(true);
        try {
            const res = await fetch("/api/v1/auth/profile/export");
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                toast.error(body.error || t("failedToExportData"));
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const cd = res.headers.get("Content-Disposition") || "";
            const match = cd.match(/filename="([^"]+)"/);
            a.download = match?.[1] || "uxwvend-data.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(t("dataExported"));
        } catch {
            toast.error(t("failedToExportData"));
        } finally {
            setExportingData(false);
        }
    };

    const handleDeleteAccount = async () => {
        setDeleteError("");
        setDeletingAccount(true);
        try {
            const res = await fetch("/api/v1/auth/profile/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password: deletePassword,
                    confirmText: deleteConfirmText,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setDeleteError(data.error || t("failedToUpdate"));
                return;
            }
            toast.success(t("accountDeleted"));
            await signOut({ callbackUrl: "/" });
        } catch {
            setDeleteError(t("somethingWentWrong"));
        } finally {
            setDeletingAccount(false);
        }
    };

    // Module profile tabs filtered by enabled modules and registered components
    const moduleProfileTabs = ModuleProfileTabs
        .filter(t => modules[t.module] === true)
        .filter(t => ProfileTabRegistry[t.id]);

    // Close delete modal on Escape
    useEffect(() => {
        if (!deleteModalOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !deletingAccount) setDeleteModalOpen(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [deleteModalOpen, deletingAccount]);

    useEffect(() => {
        if (authStatus === "unauthenticated") {
            router.push("/auth/login");
            return;
        }
        if (authStatus !== "authenticated") return;

        Promise.all([
            fetch("/api/v1/auth/profile").then(r => r.json()),
            fetch("/api/v1/linked-accounts").then(r => r.json()).catch(() => ({ accounts: [] })),
            fetch("/api/v1/me/trophies").then(r => r.json()).catch(() => ({ earned: [], total: 0 })),
        ]).then(([profileData, accountsData, trophyData]) => {
            if (profileData.user) {
                setProfile(profileData.user);
                setUsername(profileData.user.username);
                setAvatar(profileData.user.avatar || "");
            }
            setLinkedAccounts(accountsData.accounts || []);
            setEarnedTrophies(trophyData.earned || []);
            setTotalTrophies(trophyData.total || 0);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [authStatus, router]);

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileError("");
        setProfileSaved(false);

        try {
            const res = await fetch("/api/v1/auth/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, avatar: avatar || null }),
            });
            const data = await res.json();
            if (!res.ok) {
                setProfileError(data.error || t("failedToUpdate"));
                return;
            }
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 3000);
        } catch {
            setProfileError(t("somethingWentWrong"));
        } finally {
            setSavingProfile(false);
        }
    };

    if (authStatus === "loading" || loading) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <ThemeComponentSlot name="Hero" />
                <Navbar />
                <main id="main-content" tabIndex={-1} className="container mx-auto px-4 py-6 flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-label={t("loadingProfile")} />
                </main>
                <Footer />
            </div>
        );
    }

    // Build tab list: core tabs + module tabs in between
    const allTabs = [
        { id: "profile", label: t("title") },
        { id: "activity", label: t("activity") },
        { id: "messages", label: t("messages") },
        { id: "notifications", label: t("notifications") },
        { id: "sessions", label: t("sessions") },
        ...moduleProfileTabs.map(mt => {
            const key = `profileTab_${mt.id}`;
            return { id: mt.id, label: t.has(key) ? t(key) : mt.label };
        }),
        { id: "accounts", label: t("accounts") },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main id="main-content" tabIndex={-1} className="container mx-auto px-4 py-6 flex-1 max-w-4xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                        {profile?.avatar ? (
                            <Image src={profile.avatar} alt="" width={64} height={64} className="w-full h-full object-cover" unoptimized />
                        ) : (
                            (profile?.username || "U")[0].toUpperCase()
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{profile?.username}</h1>
                        <p className="text-muted-foreground text-sm">{profile?.email}</p>
                        {profile?.role && (
                            <span
                                className="text-xs px-2 py-0.5 rounded mt-1 inline-block"
                                style={{
                                    backgroundColor: (profile.role.color || "#6366f1") + "20",
                                    color: profile.role.color || "#6366f1",
                                }}
                            >
                                {profile.role.displayName}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tabs — horizontally scrollable on mobile so they never wrap awkwardly */}
                <div className="-mx-4 px-4 mb-6 overflow-x-auto">
                    <div
                        className="flex gap-2 w-max"
                        role="tablist"
                        aria-label={t("title")}
                    >
                        {allTabs.map((tab) => (
                            <Button
                                key={tab.id}
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                aria-controls={`profile-tabpanel-${tab.id}`}
                                id={`profile-tab-${tab.id}`}
                                variant={activeTab === tab.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveTab(tab.id)}
                                className="shrink-0"
                            >
                                {tab.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Profile Tab */}
                {activeTab === "profile" && (
                    <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("settings")}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={saveProfile} className="space-y-4">
                                {profileError && (
                                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">{profileError}</div>
                                )}
                                <div>
                                    <Label htmlFor={usernameId}>{t("username")}</Label>
                                    <Input id={usernameId} value={username} onChange={(e) => setUsername(e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor={avatarId}>{t("avatarUrl")}</Label>
                                    <Input id={avatarId} value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." />
                                </div>
                                <div>
                                    <Label htmlFor={emailId}>{t("email")}</Label>
                                    <Input id={emailId} value={profile?.email || ""} disabled className="bg-muted" aria-describedby={`${emailId}-help`} />
                                    <p id={`${emailId}-help`} className="text-xs text-muted-foreground mt-1">{t("emailCannotChange")}</p>
                                </div>
                                <div>
                                    <Label htmlFor={memberSinceId}>{t("memberSince")}</Label>
                                    <Input id={memberSinceId} value={profile ? formatDate(new Date(profile.createdAt)) : ""} disabled className="bg-muted" />
                                </div>
                                <Button type="submit" disabled={savingProfile}>
                                    {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("saving")}</> :
                                     profileSaved ? <><Check className="w-4 h-4 mr-2" /> {t("saved")}</> : t("saveChanges")}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-amber-500" />
                                {t("trophies")}
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                    {t("trophiesEarnedCount", { earned: earnedTrophies.length, total: totalTrophies })}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {earnedTrophies.length === 0 ? (
                                <div className="text-sm text-muted-foreground">
                                    {t("noTrophiesYet")}{" "}
                                    <Link href="/trophies" className="text-primary hover:underline">
                                        {t("seeWhatYouCanEarn")}
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {earnedTrophies.map((et) => (
                                        <div
                                            key={et.id}
                                            className="flex items-center gap-2 p-2 rounded-md border border-border"
                                            title={et.trophy.description || et.trophy.name}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                                                style={{ backgroundColor: et.trophy.color || "#6366f1" }}
                                            >
                                                <Award className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-medium text-xs truncate">{et.trophy.name}</div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {formatDate(new Date(et.awardedAt))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Download className="w-5 h-5 text-blue-500" />
                                {t("privacy")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="text-sm">
                                    <div className="font-medium text-foreground">
                                        {t("downloadYourData")}
                                    </div>
                                    <div className="text-muted-foreground">
                                        {t("downloadYourDataDesc")}
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExportData}
                                    disabled={exportingData}
                                >
                                    {exportingData ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            {t("preparing")}
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4 mr-2" />
                                            {t("download")}
                                        </>
                                    )}
                                </Button>
                            </div>
                            <div className="border-t border-border pt-4 flex items-start justify-between gap-4">
                                <div className="text-sm">
                                    <div className="font-medium text-foreground">
                                        {t("deleteYourAccount")}
                                    </div>
                                    <div className="text-muted-foreground">
                                        {t("deleteYourAccountDesc")}
                                    </div>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        setDeletePassword("");
                                        setDeleteConfirmText("");
                                        setDeleteError("");
                                        setDeleteModalOpen(true);
                                    }}
                                >
                                    {t("deleteAccount")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    </div>
                )}

                {/* Activity Tab */}
                {activeTab === "activity" && <ActivityTab />}

                {/* Messages Tab */}
                {activeTab === "messages" && <MessagesTab />}

                {/* Notification Preferences Tab */}
                {activeTab === "notifications" && <NotificationPrefsTab />}

                {/* Active Sessions Tab */}
                {activeTab === "sessions" && <SessionsTab />}

                {/* Module Profile Tabs (rendered dynamically) */}
                {moduleProfileTabs.map(mt => {
                    if (activeTab !== mt.id) return null;
                    const TabComponent = ProfileTabRegistry[mt.id];
                    if (!TabComponent || typeof TabComponent !== "function") return null;
                    return (
                        <ModuleErrorBoundary key={mt.id}>
                            <TabComponent />
                        </ModuleErrorBoundary>
                    );
                })}

                {/* Accounts Tab */}
                {activeTab === "accounts" && (
                    <Card>
                        <CardHeader><CardTitle>{t("linkedAccounts")}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {/* Current links */}
                            {linkedAccounts.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {linkedAccounts.map((acc) => (
                                        <div key={acc.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="capitalize font-medium">{acc.provider}</span>
                                                {acc.username && <span className="text-sm text-muted-foreground">{acc.username}</span>}
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                                                await fetch("/api/v1/linked-accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: acc.provider }) });
                                                setLinkedAccounts(linkedAccounts.filter((a) => a.id !== acc.id));
                                            }}>{t("unlink")}</Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Link Game Account */}
                            {linkedAccounts.length > 0 && !linkedAccounts.find((a) => a.provider === "minecraft") && (
                                <div className="p-4 border border-dashed border-border rounded-lg">
                                    <p className="text-sm font-medium mb-2">{t("linkGameAccount")}</p>
                                    <div className="flex gap-2">
                                        <Input id={mcUsernameId} value={mcUsername} onChange={(e) => setMcUsername(e.target.value)} placeholder={t("gameUsername")} aria-label={t("gameUsername")} />
                                        <Button size="sm" onClick={async () => {
                                            if (!mcUsername.trim()) return;
                                            const res = await fetch("/api/v1/linked-accounts", {
                                                method: "POST", headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ provider: "minecraft", providerId: mcUsername, username: mcUsername }),
                                            });
                                            if (res.ok) {
                                                const data = await res.json();
                                                setLinkedAccounts([...linkedAccounts, data.account]);
                                                setMcUsername("");
                                            }
                                        }}>{t("link")}</Button>
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground">{t("oauthAutoLink")}</p>
                        </CardContent>
                    </Card>
                )}
            </main>

            <Footer />

            {deleteModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center"
                    role="presentation"
                >
                    <div
                        className="fixed inset-0 bg-black/50"
                        onClick={() => !deletingAccount && setDeleteModalOpen(false)}
                        aria-hidden="true"
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-title"
                        className="relative bg-card border border-[var(--uxw-color-border)] rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
                    >
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
                            </div>
                            <div>
                                <h3 id="delete-title" className="font-semibold text-foreground">
                                    {t("deleteAccountPermanently")}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t("deleteAccountWarning")}
                                </p>
                            </div>
                        </div>

                        {deleteError && (
                            <div className="mb-3 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                                {deleteError}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <Label htmlFor={deletePasswordId}>{t("currentPassword")}</Label>
                                <Input
                                    id={deletePasswordId}
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                            </div>
                            <div>
                                <Label htmlFor={deleteConfirmId}>
                                    {t("typeDeleteToConfirm", { keyword: "DELETE" })}
                                </Label>
                                <Input
                                    id={deleteConfirmId}
                                    value={deleteConfirmText}
                                    onChange={(e) =>
                                        setDeleteConfirmText(e.target.value)
                                    }
                                    placeholder="DELETE"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteModalOpen(false)}
                                disabled={deletingAccount}
                            >
                                {commonT("cancel")}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDeleteAccount}
                                disabled={
                                    deletingAccount ||
                                    deletePassword.length === 0 ||
                                    deleteConfirmText !== "DELETE"
                                }
                            >
                                {deletingAccount ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        {t("deleting")}
                                    </>
                                ) : (
                                    t("deleteAccount")
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
