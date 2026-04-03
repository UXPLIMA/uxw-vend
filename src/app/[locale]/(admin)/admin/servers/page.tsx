"use client";
import { AdminCrudPage } from "@/core/components/admin/AdminCrudPage";

export default function Page() {
    return (
        <AdminCrudPage
            title="Game Servers"
            subtitle="Manage connected game servers for RCON and status"
            apiPath="/api/v1/servers"
            listKey="servers"
            displayField="name"
            secondaryField="host"
            fields={[
                { key: "name", label: "Server Name", required: true, placeholder: "Survival #1" },
                { key: "type", label: "Game Type", type: "select", required: true, options: [
                    { value: "minecraft", label: "Minecraft" },
                    { value: "fivem", label: "FiveM" },
                    { value: "rust", label: "Rust" },
                    { value: "ark", label: "ARK" },
                    { value: "csgo", label: "CS2/CS:GO" },
                ], defaultValue: "minecraft" },
                { key: "host", label: "Host / IP", required: true, placeholder: "play.example.com" },
                { key: "port", label: "Game Port", type: "number", defaultValue: "25565" },
                { key: "queryPort", label: "Query Port", type: "number", placeholder: "25565" },
                { key: "rconPort", label: "RCON Port", type: "number", placeholder: "25575" },
                { key: "rconPassword", label: "RCON Password", type: "text", placeholder: "your-rcon-password" },
                { key: "isDefault", label: "Default Server", type: "toggle", defaultValue: "false" },
                { key: "isActive", label: "Active", type: "toggle", defaultValue: "true" },
            ]}
        />
    );
}
