"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Loader2, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const steps = ["Welcome", "Site Info", "Payments", "Discord", "Done"];

export default function SetupWizardPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        siteName: "uxwVend",
        siteDescription: "",
        serverIp: "",
        contactEmail: "",
        stripe_public_key: "",
        stripe_secret_key: "",
        discord_webhook_general: "",
        hero_discord_url: "",
    });

    const saveAll = async () => {
        setSaving(true);
        await fetch("/api/v1/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...form,
                setup_completed: "true",
            }),
        });
        toast.success("Setup complete!");
        setSaving(false);
        setStep(4);
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-8">
                {steps.map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            i < step ? "bg-green-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                        }`}>
                            {i < step ? <Check className="w-4 h-4" /> : i + 1}
                        </div>
                        {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? "bg-green-500" : "bg-gray-200"}`} />}
                    </div>
                ))}
            </div>

            {/* Step 0: Welcome */}
            {step === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <h1 className="text-3xl font-bold mb-4">Welcome to uxwVend!</h1>
                        <p className="text-gray-500 mb-8">Let's set up your game server platform in a few quick steps.</p>
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
                            <Input value={form.siteDescription} onChange={(e) => setForm({ ...form, siteDescription: e.target.value })} placeholder="Your server description" />
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

            {/* Step 2: Payments */}
            {step === 2 && (
                <Card>
                    <CardHeader><CardTitle>Payment Setup (Optional)</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">You can skip this and configure later in Settings → Payments</p>
                        <div>
                            <Label>Stripe Public Key</Label>
                            <Input value={form.stripe_public_key} onChange={(e) => setForm({ ...form, stripe_public_key: e.target.value })} placeholder="pk_..." />
                        </div>
                        <div>
                            <Label>Stripe Secret Key</Label>
                            <Input type="password" value={form.stripe_secret_key} onChange={(e) => setForm({ ...form, stripe_secret_key: e.target.value })} placeholder="sk_..." />
                        </div>
                        <div className="flex justify-between pt-4">
                            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
                            <Button onClick={() => setStep(3)}>Next <ArrowRight className="w-4 h-4 ml-2" /></Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Discord */}
            {step === 3 && (
                <Card>
                    <CardHeader><CardTitle>Discord Integration (Optional)</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Discord Invite URL</Label>
                            <Input value={form.hero_discord_url} onChange={(e) => setForm({ ...form, hero_discord_url: e.target.value })} placeholder="https://discord.gg/..." />
                        </div>
                        <div>
                            <Label>Discord Webhook URL</Label>
                            <Input value={form.discord_webhook_general} onChange={(e) => setForm({ ...form, discord_webhook_general: e.target.value })} placeholder="https://discord.com/api/webhooks/..." />
                        </div>
                        <div className="flex justify-between pt-4">
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
                        <h2 className="text-2xl font-bold mb-2">You're all set!</h2>
                        <p className="text-gray-500 mb-6">Your platform is ready. You can configure more in Settings.</p>
                        <Button onClick={() => router.push("/admin")}>Go to Dashboard</Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
