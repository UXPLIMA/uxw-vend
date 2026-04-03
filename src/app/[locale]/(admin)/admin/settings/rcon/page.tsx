"use client";
import { SettingsForm } from "../settings-form";

export default function RconSettingsPage() {
    return (
        <SettingsForm
            title="Game Server (RCON)"
            subtitle="Configure RCON connection for in-game command delivery"
            fields={[
                { key: "rcon_host", label: "RCON Host", placeholder: "127.0.0.1", description: "Game server IP or hostname" },
                { key: "rcon_port", label: "RCON Port", type: "number", placeholder: "25575", description: "Default: 25575 for Minecraft" },
                { key: "rcon_password", label: "RCON Password", type: "password", placeholder: "your-rcon-password", description: "Set in server.properties (rcon.password)" },
                { key: "mc_server_host", label: "Query Host", placeholder: "play.example.com", description: "For server status widget (can be different from RCON host)" },
                { key: "mc_server_port", label: "Query Port", type: "number", placeholder: "25565", description: "Game port for status query" },
            ]}
        />
    );
}
