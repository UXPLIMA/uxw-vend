"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Link } from "@/core/lib/i18n/navigation";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Check, ShoppingCart, Ticket, MessageSquare, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/core/lib/utils";

interface UserProfile {
    id: string;
    email: string;
    username: string;
    avatar: string | null;
    locale: string;
    currency: string;
    createdAt: string;
    role: { name: string; displayName: string; color: string | null } | null;
    _count: { orders: number; tickets: number; topics: number; comments: number };
}

interface Order {
    id: string;
    orderNumber: string;
    subtotal: number;
    discount: number;
    total: number;
    status: string;
    createdAt: string;
    items: {
        id: string;
        name: string;
        price: number;
        quantity: number;
        product: { id: string; name: string; image: string | null } | null;
    }[];
}

export default function ProfilePage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"profile" | "orders" | "security" | "accounts" | "chest">("profile");
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    // Linked accounts & Chest
    const [linkedAccounts, setLinkedAccounts] = useState<{ id: string; provider: string; username: string | null }[]>([]);
    const [chestItems, setChestItems] = useState<{ id: string; productName: string; quantity: number; createdAt: string }[]>([]);
    const [mcUsername, setMcUsername] = useState("");

    // 2FA
    const [twoFAStep, setTwoFAStep] = useState<"idle" | "setup" | "verify" | "backup">("idle");
    const [qrCode, setQrCode] = useState("");
    const [twoFASecret, setTwoFASecret] = useState("");
    const [twoFAToken, setTwoFAToken] = useState("");
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [twoFAError, setTwoFAError] = useState("");
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [disableToken, setDisableToken] = useState("");

    // Profile form
    const [username, setUsername] = useState("");
    const [avatar, setAvatar] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [profileError, setProfileError] = useState("");

    // Password form
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordSaved, setPasswordSaved] = useState(false);
    const [passwordError, setPasswordError] = useState("");

    useEffect(() => {
        if (authStatus === "unauthenticated") {
            router.push("/auth/login");
            return;
        }
        if (authStatus !== "authenticated") return;

        Promise.all([
            fetch("/api/v1/auth/profile").then((r) => r.json()),
            fetch("/api/v1/store/orders?limit=10").then((r) => r.json()),
            fetch("/api/v1/linked-accounts").then((r) => r.json()).catch(() => ({ accounts: [] })),
            fetch("/api/v1/chest").then((r) => r.json()).catch(() => ({ items: [] })),
        ]).then(([profileData, ordersData, accountsData, chestData]) => {
            if (profileData.user) {
                setProfile(profileData.user);
                setUsername(profileData.user.username);
                setAvatar(profileData.user.avatar || "");
                setTwoFAEnabled(profileData.user.twoFactorEnabled || false);
            }
            setOrders(ordersData.orders || []);
            setLinkedAccounts(accountsData.accounts || []);
            setChestItems(chestData.items || []);
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

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingPassword(true);
        setPasswordError("");
        setPasswordSaved(false);

        if (newPassword !== confirmPassword) {
            setPasswordError("Passwords don't match");
            setSavingPassword(false);
            return;
        }

        try {
            const res = await fetch("/api/v1/auth/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setPasswordError(data.error || "Failed to change password");
                return;
            }
            setPasswordSaved(true);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setPasswordSaved(false), 3000);
        } catch {
            setPasswordError("Something went wrong");
        } finally {
            setSavingPassword(false);
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case "COMPLETED": return "bg-green-100 text-green-700";
            case "PENDING": return "bg-yellow-100 text-yellow-700";
            case "PROCESSING": return "bg-blue-100 text-blue-700";
            case "CANCELLED": return "bg-red-100 text-red-700";
            default: return "bg-gray-100 text-gray-700";
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

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                        { icon: ShoppingCart, label: "Orders", value: profile?._count.orders || 0 },
                        { icon: Ticket, label: "Tickets", value: profile?._count.tickets || 0 },
                        { icon: MessageSquare, label: "Topics", value: profile?._count.topics || 0 },
                        { icon: FileText, label: "Comments", value: profile?._count.comments || 0 },
                    ].map((stat) => (
                        <Card key={stat.label}>
                            <CardContent className="p-4 text-center">
                                <stat.icon className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                                <p className="text-xl font-bold">{stat.value}</p>
                                <p className="text-xs text-muted-foreground">{stat.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {(["profile", "orders", "chest", "accounts", "security"] as const).map((tab) => (
                        <Button
                            key={tab}
                            variant={activeTab === tab ? "default" : "outline"}
                            size="sm"
                            onClick={() => setActiveTab(tab)}
                            className="capitalize"
                        >
                            {tab}
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

                {/* Orders Tab */}
                {activeTab === "orders" && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Order History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {orders.length === 0 ? (
                                <div className="text-center py-8">
                                    <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-muted-foreground">No orders yet</p>
                                    <Link href="/store">
                                        <Button variant="outline" className="mt-3">Browse Store</Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map((order) => (
                                        <div key={order.id}>
                                            <button
                                                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                            >
                                                <div className="text-left">
                                                    <p className="font-medium">{order.orderNumber}</p>
                                                    <p className="text-xs text-muted-foreground">{formatDate(new Date(order.createdAt))}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="font-bold">{formatCurrency(Number(order.total))}</p>
                                                        <span className={`text-xs px-2 py-0.5 rounded ${statusColor(order.status)}`}>
                                                            {order.status}
                                                        </span>
                                                    </div>
                                                    {expandedOrder === order.id
                                                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                                                    }
                                                </div>
                                            </button>
                                            {expandedOrder === order.id && order.items && (
                                                <div className="mt-1 p-4 bg-background border rounded-lg">
                                                    <div className="space-y-2">
                                                        {order.items.map((item) => (
                                                            <div key={item.id} className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-muted rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                                    {item.product?.image ? (
                                                                        <img src={item.product.image} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-sm">📦</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-medium">{item.product?.name || item.name}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {formatCurrency(Number(item.price))} × {item.quantity}
                                                                    </p>
                                                                </div>
                                                                <p className="text-sm font-medium">
                                                                    {formatCurrency(Number(item.price) * item.quantity)}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {Number(order.discount) > 0 && (
                                                        <div className="flex justify-between mt-3 pt-3 border-t text-sm text-green-600">
                                                            <span>Discount</span>
                                                            <span>-{formatCurrency(Number(order.discount))}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between mt-2 pt-2 border-t text-sm font-bold">
                                                        <span>Total</span>
                                                        <span>{formatCurrency(Number(order.total))}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Chest Tab */}
                {activeTab === "chest" && (
                    <Card>
                        <CardHeader><CardTitle>My Chest</CardTitle></CardHeader>
                        <CardContent>
                            {chestItems.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">Your chest is empty. Purchase items to store them here.</p>
                            ) : (
                                <div className="space-y-3">
                                    {chestItems.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <p className="font-medium">{item.productName}</p>
                                                <p className="text-xs text-muted-foreground">Qty: {item.quantity} · {new Date(item.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={async () => {
                                                    await fetch(`/api/v1/chest/${item.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
                                                    setChestItems(chestItems.filter((c) => c.id !== item.id));
                                                }}>Redeem</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

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

                            {/* Link Minecraft */}
                            {!linkedAccounts.find((a) => a.provider === "minecraft") && (
                                <div className="p-4 border border-dashed border-gray-200 rounded-lg">
                                    <p className="text-sm font-medium mb-2">Link Minecraft Account</p>
                                    <div className="flex gap-2">
                                        <Input value={mcUsername} onChange={(e) => setMcUsername(e.target.value)} placeholder="Minecraft username" />
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

                {/* Security Tab */}
                {activeTab === "security" && (
                    <div className="space-y-6">
                        {/* 2FA Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    Two-Factor Authentication
                                    <span className={`text-xs px-2 py-1 rounded ${twoFAEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                        {twoFAEnabled ? "Enabled" : "Disabled"}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {twoFAError && (
                                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg mb-4">{twoFAError}</div>
                                )}

                                {!twoFAEnabled && twoFAStep === "idle" && (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            Add an extra layer of security to your account with a TOTP authenticator app.
                                        </p>
                                        <Button onClick={async () => {
                                            setTwoFAError("");
                                            const res = await fetch("/api/v1/auth/two-factor/setup", { method: "POST" });
                                            const data = await res.json();
                                            if (res.ok) {
                                                setQrCode(data.qrCode);
                                                setTwoFASecret(data.secret);
                                                setTwoFAStep("setup");
                                            } else {
                                                setTwoFAError(data.error);
                                            }
                                        }}>
                                            Enable 2FA
                                        </Button>
                                    </div>
                                )}

                                {twoFAStep === "setup" && (
                                    <div className="space-y-4 max-w-sm">
                                        <p className="text-sm text-muted-foreground">
                                            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                                        </p>
                                        {qrCode && <img src={qrCode} alt="2FA QR Code" className="mx-auto" />}
                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground">Or enter this code manually:</p>
                                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono select-all">{twoFASecret}</code>
                                        </div>
                                        <div>
                                            <Label>Enter the 6-digit code from your app</Label>
                                            <Input
                                                value={twoFAToken}
                                                onChange={(e) => setTwoFAToken(e.target.value)}
                                                placeholder="000000"
                                                className="text-center font-mono text-lg tracking-widest"
                                                maxLength={6}
                                            />
                                        </div>
                                        <Button onClick={async () => {
                                            setTwoFAError("");
                                            const res = await fetch("/api/v1/auth/two-factor/verify", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ token: twoFAToken }),
                                            });
                                            const data = await res.json();
                                            if (res.ok) {
                                                setBackupCodes(data.backupCodes);
                                                setTwoFAEnabled(true);
                                                setTwoFAStep("backup");
                                            } else {
                                                setTwoFAError(data.error);
                                            }
                                        }}>
                                            Verify & Enable
                                        </Button>
                                    </div>
                                )}

                                {twoFAStep === "backup" && (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <p className="text-sm font-medium text-yellow-800 mb-2">Save your backup codes!</p>
                                            <p className="text-xs text-yellow-700 mb-3">
                                                Store these codes in a safe place. Each code can only be used once if you lose access to your authenticator.
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {backupCodes.map((code, i) => (
                                                    <code key={i} className="text-sm bg-white px-3 py-1 rounded border font-mono text-center">
                                                        {code}
                                                    </code>
                                                ))}
                                            </div>
                                        </div>
                                        <Button onClick={() => { setTwoFAStep("idle"); setTwoFAToken(""); }}>
                                            I've saved my codes
                                        </Button>
                                    </div>
                                )}

                                {twoFAEnabled && twoFAStep === "idle" && (
                                    <div className="space-y-4 max-w-sm">
                                        <p className="text-sm text-muted-foreground">
                                            Enter your 2FA code to disable two-factor authentication.
                                        </p>
                                        <Input
                                            value={disableToken}
                                            onChange={(e) => setDisableToken(e.target.value)}
                                            placeholder="Enter 6-digit code"
                                            className="text-center font-mono"
                                            maxLength={6}
                                        />
                                        <Button variant="destructive" onClick={async () => {
                                            setTwoFAError("");
                                            const res = await fetch("/api/v1/auth/two-factor/disable", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ token: disableToken }),
                                            });
                                            const data = await res.json();
                                            if (res.ok) {
                                                setTwoFAEnabled(false);
                                                setDisableToken("");
                                            } else {
                                                setTwoFAError(data.error);
                                            }
                                        }}>
                                            Disable 2FA
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Password Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Change Password</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={changePassword} className="space-y-4 max-w-md">
                                    {passwordError && (
                                        <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">{passwordError}</div>
                                    )}
                                    {passwordSaved && (
                                        <div className="p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-lg">Password updated!</div>
                                    )}
                                    <div>
                                        <Label>Current Password</Label>
                                        <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                                    </div>
                                    <div>
                                        <Label>New Password</Label>
                                        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                                    </div>
                                    <div>
                                        <Label>Confirm New Password</Label>
                                        <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                                    </div>
                                    <Button type="submit" disabled={savingPassword}>
                                        {savingPassword ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Updating...</> : "Change Password"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
