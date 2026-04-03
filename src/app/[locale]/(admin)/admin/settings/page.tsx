import { Card, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Palette, Globe, Mail, CreditCard } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
    const settingsItems = [
        {
            title: "Appearance",
            description: "Manage themes, colors, and layout customization.",
            href: "/admin/settings/theme",
            icon: Palette,
            color: "text-purple-500",
        },
        {
            title: "Site Configuration",
            description: "Server name, description, social links, and general settings.",
            href: "/admin/settings/site",
            icon: Globe,
            color: "text-blue-500",
        },
        {
            title: "Email",
            description: "Email service configuration and templates.",
            href: "/admin/settings/email",
            icon: Mail,
            color: "text-green-500",
        },
        {
            title: "Payments",
            description: "Stripe and payment gateway configuration.",
            href: "/admin/settings/payments",
            icon: CreditCard,
            color: "text-orange-500",
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your platform settings and configurations.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {settingsItems.map((item) => (
                    <Link href={item.href} key={item.href}>
                        <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2 text-base">
                                    <item.icon className={`w-5 h-5 ${item.color}`} />
                                    <span>{item.title}</span>
                                </CardTitle>
                                <CardDescription>
                                    {item.description}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
