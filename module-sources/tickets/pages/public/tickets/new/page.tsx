"use client";

import { useState, useEffect } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { useRouter } from "@/core/lib/i18n/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/core/components/ui/button";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { Navbar, Footer } from "@/core/components/layout";
import { useTranslations } from "next-intl";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface Department {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
}

export default function NewTicketPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const t = useTranslations('tickets');
    const commonT = useTranslations('common');
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        subject: "",
        content: "",
        departmentId: "",
        priority: "MEDIUM",
    });

    useEffect(() => {
        fetch("/api/v1/tickets/departments")
            .then((res) => res.json())
            .then((data) => setDepartments(Array.isArray(data) ? data : data.departments || []))
            .catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/v1/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create ticket");
            }

            const ticket = await res.json();
            router.push(`/support/${ticket.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (!session?.user) {
        return (
            <div className="min-h-screen flex flex-col bg-muted">
                <ThemeComponentSlot name="Hero" fallback={() => null} />
                <Navbar />
                <main className="container mx-auto px-4 py-6 flex-1">
                    <div className="bg-card rounded-xl p-8 text-center">
                        <p className="text-muted-foreground mb-4">{t('loginToCreate')}</p>
                        <Link href="/auth/login">
                            <Button>{t('login')}</Button>
                        </Link>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" fallback={() => null} />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-muted-foreground mb-4">
                    <Link href="/" className="hover:text-blue-600">{commonT('home')}</Link>
                    <span className="mx-2">/</span>
                    <Link href="/support" className="hover:text-blue-600">{t('title')}</Link>
                    <span className="mx-2">/</span>
                    <span className="text-foreground">{t('newTicket')}</span>
                </div>

                <h1 className="text-2xl font-bold text-foreground mb-6">{t('createNewTicket')}</h1>

                <div className="bg-card rounded-xl border border-border p-6 max-w-3xl">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="department">{t('department')} *</Label>
                            <select
                                id="department"
                                value={formData.departmentId}
                                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                className="w-full mt-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">{t('selectDepartment')}</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label htmlFor="priority">{t('priority')}</Label>
                            <select
                                id="priority"
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full mt-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="LOW">{t('low')}</option>
                                <option value="MEDIUM">{t('medium')}</option>
                                <option value="HIGH">{t('high')}</option>
                                <option value="URGENT">{t('urgent')}</option>
                            </select>
                        </div>

                        <div>
                            <Label htmlFor="subject">{t('subject')} *</Label>
                            <input
                                id="subject"
                                type="text"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full mt-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={t('briefDescription')}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="content">{t('message')} *</Label>
                            <Textarea
                                id="content"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder={t('describeIssue')}
                                rows={8}
                                required
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button type="submit" disabled={loading}>
                                {loading ? t('creating') : t('createTicket')}
                            </Button>
                            <Link href="/support">
                                <Button type="button" variant="outline">{t('cancel')}</Button>
                            </Link>
                        </div>
                    </form>
                </div>
            </main>

            <Footer />
        </div>
    );
}
