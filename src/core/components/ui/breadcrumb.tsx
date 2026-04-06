"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
    label: string;
    href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
    return (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <Link href="/" className="hover:text-foreground transition-colors">
                <Home className="w-3.5 h-3.5" />
            </Link>
            {items.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" />
                    {item.href ? (
                        <Link href={item.href} className="hover:text-foreground transition-colors">{item.label}</Link>
                    ) : (
                        <span className="text-foreground font-medium">{item.label}</span>
                    )}
                </span>
            ))}
        </nav>
    );
}
