import { NextResponse } from "next/server";
import moduleSystem from "@/core/lib/modules";

export async function GET() {
    const modules = moduleSystem.getDefinitions();

    // Core paths
    const paths: Record<string, Record<string, unknown>> = {
        "/api/v1/auth/register": {
            post: {
                summary: "Register new user",
                tags: ["Auth"],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    email: { type: "string" },
                                    username: { type: "string" },
                                    password: { type: "string" },
                                    confirmPassword: { type: "string" },
                                },
                                required: [
                                    "email",
                                    "username",
                                    "password",
                                    "confirmPassword",
                                ],
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "User created" },
                    "400": { description: "Validation error" },
                },
            },
        },
        "/api/v1/auth/forgot-password": {
            post: {
                summary: "Request password reset",
                tags: ["Auth"],
                requestBody: {
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    email: { type: "string" },
                                },
                                required: ["email"],
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Reset email sent" },
                },
            },
        },
        "/api/v1/auth/reset-password": {
            post: { summary: "Reset password with token", tags: ["Auth"] },
        },
        "/api/v1/auth/profile": {
            get: {
                summary: "Get current user profile",
                tags: ["Auth"],
                security: [{ bearerAuth: [] }],
            },
            patch: {
                summary: "Update profile",
                tags: ["Auth"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/users": {
            get: {
                summary: "List users (admin)",
                tags: ["Users"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/users/{id}": {
            get: {
                summary: "Get user by ID (admin)",
                tags: ["Users"],
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                    },
                ],
            },
            patch: {
                summary: "Update user (admin)",
                tags: ["Users"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/roles": {
            get: {
                summary: "List roles",
                tags: ["Roles"],
                security: [{ bearerAuth: [] }],
            },
            post: {
                summary: "Create role (admin)",
                tags: ["Roles"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/settings": {
            get: {
                summary: "Get settings",
                tags: ["Settings"],
                security: [{ bearerAuth: [] }],
            },
            patch: {
                summary: "Update settings (admin)",
                tags: ["Settings"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/public-settings": {
            get: { summary: "Get public settings", tags: ["Settings"] },
        },
        "/api/v1/modules": {
            get: {
                summary: "List modules (admin)",
                tags: ["Modules"],
                security: [{ bearerAuth: [] }],
            },
            patch: {
                summary: "Enable/disable module (admin)",
                tags: ["Modules"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/modules/marketplace/install": {
            post: {
                summary: "Install module from marketplace (admin)",
                tags: ["Modules"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/stats": {
            get: {
                summary: "Dashboard statistics (admin)",
                tags: ["Stats"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/health": {
            get: {
                summary: "Health check",
                tags: ["System"],
                responses: {
                    "200": { description: "Healthy" },
                    "503": { description: "Degraded" },
                },
            },
        },
        "/api/v1/admin/metrics": {
            get: {
                summary: "Request metrics (admin)",
                tags: ["System"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/admin/system": {
            get: {
                summary: "System health info (admin)",
                tags: ["System"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/admin/backup": {
            get: {
                summary: "List backups (admin)",
                tags: ["System"],
                security: [{ bearerAuth: [] }],
            },
            post: {
                summary: "Create backup (admin)",
                tags: ["System"],
                security: [{ bearerAuth: [] }],
            },
        },
        "/api/v1/api-keys": {
            get: {
                summary: "List API keys (admin)",
                tags: ["API Keys"],
                security: [{ bearerAuth: [] }],
            },
            post: {
                summary: "Create API key (admin)",
                tags: ["API Keys"],
                security: [{ bearerAuth: [] }],
            },
        },
    };

    // Module paths from manifests
    for (const mod of modules) {
        if (!mod.api) continue;
        for (const api of mod.api) {
            const fullPath = `/api/v1${api.path.startsWith("/") ? api.path : "/" + api.path}`;
            paths[fullPath] = {
                get: {
                    summary: `${mod.name} API`,
                    tags: [mod.name],
                    description: `Module: ${mod.id}`,
                },
            };
        }
    }

    const spec = {
        openapi: "3.1.0",
        info: {
            title: "uxwVend API",
            description:
                "Game server management platform API. Modules add additional endpoints dynamically.",
            version: "1.0.0",
            contact: {
                name: "uxwVend",
                url: "https://github.com/siracozmen01/uxwVend",
            },
        },
        servers: [{ url: "/", description: "Current server" }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
                apiKeyAuth: {
                    type: "apiKey",
                    in: "header",
                    name: "x-api-key",
                },
            },
        },
        paths,
        tags: [
            { name: "Auth", description: "Authentication and user management" },
            { name: "Users", description: "User administration" },
            {
                name: "Roles",
                description: "Role and permission management",
            },
            { name: "Settings", description: "Platform settings" },
            { name: "Modules", description: "Module management" },
            { name: "System", description: "Health, metrics, backups" },
            { name: "API Keys", description: "API key management" },
            { name: "Stats", description: "Dashboard statistics" },
            ...modules
                .filter((m) => m.api && m.api.length > 0)
                .map((m) => ({
                    name: m.name,
                    description: `${m.description} (Module: ${m.id})`,
                })),
        ],
    };

    return NextResponse.json(spec, {
        headers: { "Access-Control-Allow-Origin": "*" },
    });
}
