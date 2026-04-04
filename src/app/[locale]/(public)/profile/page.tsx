"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Check, Hash } from "lucide-react";
import { formatDate } from "@/core/lib/utils";
import { ModuleProfileTabs, ProfileTabRegistry } from "@/core/generated/module-registry";
import { useAllModules } from "@/core/providers/module-provider";

interface UserProfile {
    id: string;
    email: string;
    username: string;
    avatar: string | null;
    locale: string;
    currency: string;
    createdAt: string;
    role: { name: string; displayName: string; color: string | null } | null;
    _count: Record<string, number>;
}

export default function ProfilePage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const modules = useAllModules();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>("profile");

    // Linked accounts
    const [linkedAccounts, setLinkedAccounts] = useState<{ id: string; provider: string; username: string | null }[]>([]);
    const [mcUsername, setMcUsername] = useState("");

    // Profile form
    const [username, setUsername] = useState("");
    const [avatar, setAvatar] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [profileError, setProfileError] = useState("");

    // Module profile tabs filtered by enabled modules and registered components
    const moduleProfileTabs = ModuleProfileTabs
        .filter(t => modules[t.module] === true)
        .filter(t => ProfileTabRegistry[t.id]);

    useEffect(() => {
        if (authStatus === "unauthenticated") {
            router.push("/auth/login");
            return;
        }
        if (authStatus !== "authenticated") return;

        Promise.all([
            fetch("/api/v1/auth/profile").then(r => r.json()),
            fetch("/api/v1/linked-accounts").then(r => r.json()).catch(() => ({ accounts: [] })),
        ]).then(([profileData, accountsData]) => {
            if (profileData.user) {
                setProfile(profileData.user);
                setUsername(profileData.user.username);
                setAvatar(profileData.user.avatar || "");
            }
            setLinkedAccounts(accountsData.accounts || []);
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
                setProfileError(data.error || "Failed to update profile");
                return;
            }
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 3000);
        } catch {
            setProfileError("Something went wrong");
        } finally {
            setSavingProfile(false);
        }
    };

    if (authStatus === "loading" || loading) {
        return (
            <div className="min-h-screen flex flex-col bg-gray-100">
                <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
                <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
                <main className="container mx-auto px-4 py-6 flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </main>
                <ThemeSlot name="Footer" defaultComponent={<Footer />} />
            </div>
        );
    }

    // Build tab list: core tabs + module tabs in between
    const allTabs = [
        { id: "profile", label: "Profile" },
        ...moduleProfileTabs.map(t => ({ id: t.id, label: t.label })),
        { id: "accounts", label: "Accounts" },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-4xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                        {profile?.avatar ? (
                            <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                            (profile?.username || "U")[0].toUpperCase()
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{profile?.username}</h1>
                        <p className="text-gray-500 text-sm">{profile?.email}</p>
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

                {/* Stats — fully data-driven from API _count, no hardcoded field names */}
                {(() => {
                    const counts = profile?._count || {};
                    const statItems = Object.entries(counts)
                        .filter(([, v]) => v > 0)
                        .map(([key, value]) => ({
                            label: key.charAt(0).toUpperCase() + key.slice(1),
                            value,
                        }));

                    if (statItems.length === 0) return null;

                    return (
                        <div className={`grid grid-cols-${Math.min(statItems.length, 4)} gap-4 mb-6`}>
                            {statItems.map((stat) => (
                                <Card key={stat.label}>
                                    <CardContent className="p-4 text-center">
                                        <Hash className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                                        <p className="text-xl font-bold">{stat.value}</p>
                                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    );
                })()}

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {allTabs.map((tab) => (
                        <Button
                            key={tab.id}
                            variant={activeTab === tab.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </div>

                {/* Profile Tab */}
                {activeTab === "profile" && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Settings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={saveProfile} className="space-y-4">
                                {profileError && (
                                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">{profileError}</div>
                                )}
                                <div>
                                    <Label>Username</Label>
                                    <Input value={username} onChange={(e) => setUsername(e.target.value)} />
                                </div>
                                <div>
                                    <Label>Avatar URL</Label>
                                    <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." />
                                </div>
                                <div>
                                    <Label>Email</Label>
                                    <Input value={profile?.email || ""} disabled className="bg-gray-50" />
                                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                                </div>
                                <div>
                                    <Label>Member since</Label>
                                    <Input value={profile ? formatDate(new Date(profile.createdAt)) : ""} disabled className="bg-gray-50" />
                                </div>
                                <Button type="submit" disabled={savingProfile}>
                                    {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> :
                                     profileSaved ? <><Check className="w-4 h-4 mr-2" /> Saved</> : "Save Changes"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Module Profile Tabs (rendered dynamically) */}
                {moduleProfileTabs.map(t => {
                    if (activeTab !== t.id) return null;
                    const TabComponent = ProfileTabRegistry[t.id];
                    return <TabComponent key={t.id} />;
                })}

                {/* Accounts Tab */}
                {activeTab === "accounts" && (
                    <Card>
                        <CardHeader><CardTitle>Linked Accounts</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {/* Current links */}
                            {linkedAccounts.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {linkedAccounts.map((acc) => (
                                        <div key={acc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="capitalize font-medium">{acc.provider}</span>
                                                {acc.username && <span className="text-sm text-muted-foreground">{acc.username}</span>}
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                                                await fetch("/api/v1/linked-accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: acc.provider }) });
                                                setLinkedAccounts(linkedAccounts.filter((a) => a.id !== acc.id));
                                            }}>Unlink</Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Link Game Account */}
                            {linkedAccounts.length > 0 && !linkedAccounts.find((a) => a.provider === "minecraft") && (
                                <div className="p-4 border border-dashed border-gray-200 rounded-lg">
                                    <p className="text-sm font-medium mb-2">Link Game Account</p>
                                    <div className="flex gap-2">
                                        <Input value={mcUsername} onChange={(e) => setMcUsername(e.target.value)} placeholder="Game username" />
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
                                        }}>Link</Button>
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground">Discord and Google accounts are automatically linked when you log in with them.</p>
                        </CardContent>
                    </Card>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
