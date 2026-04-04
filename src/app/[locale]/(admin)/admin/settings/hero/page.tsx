"use client";
import { SettingsForm } from "../settings-form";

export default function HeroSettingsPage() {
    return (
        <SettingsForm
            title="Hero Banner"
            subtitle="Customize the main hero section"
            fields={[
                { key: "hero_background_image", label: "Background Image URL", type: "url", placeholder: "/background1.png" },
                { key: "hero_logo_image", label: "Logo Image URL", type: "url", placeholder: "/logo.png" },
                { key: "hero_server_ip", label: "Server IP (displayed)", placeholder: "play.example.com" },
                { key: "hero_discord_url", label: "Discord Invite URL", type: "url", placeholder: "https://discord.gg/..." },
                { key: "hero_show_player_count", label: "Show Player Count", placeholder: "true", description: "'true' to show live player count from server query" },
                { key: "hero_height", label: "Banner Height (px)", type: "number", placeholder: "280" },
            ]}
        />
    );
}
