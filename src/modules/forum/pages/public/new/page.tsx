"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/core/lib/i18n/navigation";
import { Link } from "@/core/lib/i18n/navigation";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Textarea } from "@/core/components/ui/textarea";
import { Label } from "@/core/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
}

export default function NewTopicPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: "",
        content: "",
        categoryId: "",
    });

    useEffect(() => {
        fetch("/api/v1/forum/categories")
            .then((r) => r.json())
            .then((d) => setCategories(d.categories || []))
            .catch(() => {});
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const res = await fetch("/api/v1/forum/topics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to create topic");
                return;
            }

            const data = await res.json();
            router.push(`/forum/topic/${data.topic.number}/${data.topic.slug}`);
        } catch {
            setError("Something went wrong");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <Link href="/forum" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to Forum
                </Link>

                <Card>
                    <CardHeader>
                        <CardTitle>New Topic</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label>Category *</Label>
                                <select
                                    value={form.categoryId}
                                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    required
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Label>Title *</Label>
                                <Input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="What's your topic about?"
                                    required
                                    minLength={3}
                                />
                            </div>

                            <div>
                                <Label>Content *</Label>
                                <Textarea
                                    value={form.content}
                                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                                    placeholder="Write your message..."
                                    rows={8}
                                    required
                                    minLength={10}
                                />
                            </div>

                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</>
                                ) : (
                                    "Create Topic"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
