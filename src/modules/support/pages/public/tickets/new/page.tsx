"use client";

import { useState, useEffect } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { useRouter } from "@/core/lib/i18n/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/core/components/ui/button";
import { Label } from "@/core/components/ui/label";
import { Textarea } from "@/core/components/ui/textarea";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { ThemeSlot } from "@/core/components/theme-slot";

interface Department {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
}

export default function NewTicketPage() {
    const { data: session } = useSession();
    const router = useRouter();
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
            .then((data) => setDepartments(data))
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
            <div className="min-h-screen flex flex-col bg-gray-100">
                <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
                <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />
                <main className="container mx-auto px-4 py-6 flex-1">
                    <div className="bg-white rounded-xl p-8 text-center">
                        <p className="text-gray-500 mb-4">Please login to create a support ticket</p>
                        <Link href="/auth/login">
                            <Button>Login</Button>
                        </Link>
                    </div>
                </main>
                <ThemeSlot name="Footer" defaultComponent={<Footer />} />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1">
                {/* Breadcrumb */}
                <div className="text-sm text-gray-500 mb-4">
                    <Link href="/" className="hover:text-blue-600">Home</Link>
                    <span className="mx-2">/</span>
                    <Link href="/support" className="hover:text-blue-600">Support</Link>
                    <span className="mx-2">/</span>
                    <span className="text-gray-700">New Ticket</span>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Ticket</h1>

                <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="department">Department *</Label>
                            <select
                                id="department"
                                value={formData.departmentId}
                                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">Select a department</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label htmlFor="priority">Priority</Label>
                            <select
                                id="priority"
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>

                        <div>
                            <Label htmlFor="subject">Subject *</Label>
                            <input
                                id="subject"
                                type="text"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Brief description of your issue"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="content">Message *</Label>
                            <Textarea
                                id="content"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Describe your issue in detail..."
                                rows={8}
                                required
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button type="submit" disabled={loading}>
                                {loading ? "Creating..." : "Create Ticket"}
                            </Button>
                            <Link href="/support">
                                <Button type="button" variant="outline">Cancel</Button>
                            </Link>
                        </div>
                    </form>
                </div>
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}
