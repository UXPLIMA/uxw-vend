"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { ShoppingCart, MessageSquare, FileText, Ticket, HelpCircle, Package } from "lucide-react";

interface Module {
    id: string;
    name: string;
    description: string;
    version: string;
    icon?: string;
    enabled: boolean;
    routes: {
        public: string[];
        admin: string[];
    };
}

export default function AdminModulesPage() {
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/v1/modules")
            .then(res => res.json())
            .then(data => {
                setModules(data.modules || []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const toggleModule = async (moduleId: string, enabled: boolean) => {
        setUpdating(moduleId);
        try {
            const res = await fetch("/api/v1/modules", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ moduleId, enabled }),
            });

            if (res.ok) {
                setModules(modules.map(m =>
                    m.id === moduleId ? { ...m, enabled } : m
                ));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdating(null);
        }
    };

    const iconMap: Record<string, React.ReactNode> = {
        ShoppingCart: <ShoppingCart size={24} />,
        MessageSquare: <MessageSquare size={24} />,
        FileText: <FileText size={24} />,
        Ticket: <Ticket size={24} />,
        HelpCircle: <HelpCircle size={24} />,
    };

    return (
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Module Management</h1>
                <p className="text-muted-foreground">Enable or disable platform modules</p>
            </div>

                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">Loading modules...</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {modules.map((module) => (
                            <Card key={module.id} className={`transition-all ${!module.enabled ? 'opacity-60' : ''}`}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-primary">{iconMap[module.icon || ''] || <Package size={24} />}</span>
                                            <div>
                                                <CardTitle>{module.name}</CardTitle>
                                                <p className="text-xs text-muted-foreground">v{module.version}</p>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-medium ${module.enabled
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {module.enabled ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="mb-4">
                                        {module.description}
                                    </CardDescription>

                                    <div className="text-xs text-muted-foreground mb-4">
                                        <p><strong>Routes:</strong> {module.routes.public.length} public, {module.routes.admin.length} admin</p>
                                    </div>

                                    <Button
                                        variant={module.enabled ? "outline" : "default"}
                                        size="sm"
                                        className="w-full"
                                        disabled={updating === module.id}
                                        onClick={() => toggleModule(module.id, !module.enabled)}
                                    >
                                        {updating === module.id
                                            ? "Updating..."
                                            : module.enabled
                                                ? "Disable Module"
                                                : "Enable Module"
                                        }
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

            <div className="mt-8 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Disabling a module will hide its pages and API endpoints.
                    Users trying to access disabled module routes will see a 404 error.
                </p>
            </div>
        </>
    );
}
