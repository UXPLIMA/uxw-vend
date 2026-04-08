"use client";

import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";
import { Trophy } from "lucide-react";

export default function AdminTrophiesPage() {
    return (
        <>
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Trophy className="w-7 h-7" />
                    Trophies
                </h1>
                <p className="text-muted-foreground">User badges awarded automatically by hook events or manually</p>
            </div>
            <AdminCrudPage
                title="Trophies"
                subtitle="User badges and achievements"
                apiPath="/api/v1/trophies"
                listKey="trophies"
                displayField="name"
                secondaryField="description"
                fields={[
                    { key: "name", label: "Name", required: true, placeholder: "First Article" },
                    { key: "description", label: "Description", type: "textarea", placeholder: "Awarded for publishing your first blog post" },
                    { key: "icon", label: "Lucide icon", placeholder: "Award" },
                    { key: "color", label: "Color (Tailwind class or hex)", placeholder: "text-yellow-500 or #f59e0b" },
                    { key: "points", label: "Points", type: "number", defaultValue: "10" },
                    { key: "awardOn", label: "Auto-award rule (e.g. blog.article.created:1)", placeholder: "blog.article.created:1" },
                ]}
            />
        </>
    );
}
