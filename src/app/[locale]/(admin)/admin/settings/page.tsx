
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Palette, Settings } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
    // const t = useTranslations("Admin.Settings"); // Assuming translations might not be there yet, fallback to English text

    const settingsItems = [
        {
            title: "Appearance",
            description: "Manage themes, colors, and layout customization.",
            href: "/admin/settings/theme",
            icon: Palette,
            color: "text-purple-500",
        },
        // Future settings can go here
    ];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Settings</h3>
                <p className="text-sm text-muted-foreground">
                    Manage your platform settings and configurations.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
