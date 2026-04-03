import { Card, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Palette, Globe, Mail, CreditCard, MessageSquare, Shield, Server, Target, BarChart3, Bot } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
    const settingsItems = [
        {
            title: "Appearance",
            description: "Themes, colors, and layout customization.",
            href: "/admin/settings/theme",
            icon: Palette,
            color: "text-purple-500",
        },
        {
            title: "Site Configuration",
            description: "Server name, description, social links.",
            href: "/admin/settings/site",
            icon: Globe,
            color: "text-blue-500",
        },
        {
            title: "Discord",
            description: "Webhook notifications for events.",
            href: "/admin/settings/discord",
            icon: MessageSquare,
            color: "text-indigo-500",
        },
        {
            title: "Payments",
            description: "Stripe keys and payment gateway.",
            href: "/admin/settings/payments",
            icon: CreditCard,
            color: "text-orange-500",
        },
        {
            title: "Email (SMTP)",
            description: "Resend API key and email settings.",
            href: "/admin/settings/email",
            icon: Mail,
            color: "text-green-500",
        },
        {
            title: "Game Server (RCON)",
            description: "RCON connection and command delivery.",
            href: "/admin/settings/rcon",
            icon: Server,
            color: "text-red-500",
        },
        {
            title: "Security",
            description: "CAPTCHA, rate limiting, and protection.",
            href: "/admin/settings/security",
            icon: Shield,
            color: "text-yellow-500",
        },
        {
            title: "Community Goals",
            description: "Set monthly revenue targets.",
            href: "/admin/settings/goals",
            icon: Target,
            color: "text-pink-500",
        },
        {
            title: "Analytics",
            description: "Google Analytics tracking configuration.",
            href: "/admin/settings/analytics",
            icon: BarChart3,
            color: "text-cyan-500",
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {settingsItems.map((item) => (
                    <Link href={item.href} key={item.href}>
                        <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center space-x-2 text-sm">
                                    <item.icon className={`w-4 h-4 ${item.color}`} />
                                    <span>{item.title}</span>
                                </CardTitle>
                                <CardDescription className="text-xs">
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
