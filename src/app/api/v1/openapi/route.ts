import { NextResponse } from "next/server";

// GET /api/v1/openapi - OpenAPI spec
export async function GET() {
    const spec = {
        openapi: "3.0.0",
        info: {
            title: "uxwVend API",
            version: "1.0.0",
            description: "Game server management and marketplace platform API",
        },
        servers: [
            { url: "/api/v1", description: "API v1" },
        ],
        paths: {
            "/store/products": {
                get: { summary: "List products", tags: ["Store"], parameters: [
                    { name: "page", in: "query", schema: { type: "integer" } },
                    { name: "limit", in: "query", schema: { type: "integer" } },
                    { name: "category", in: "query", schema: { type: "string" } },
                    { name: "search", in: "query", schema: { type: "string" } },
                    { name: "featured", in: "query", schema: { type: "boolean" } },
                ]},
                post: { summary: "Create product (admin)", tags: ["Store"], security: [{ session: [] }] },
            },
            "/store/products/{id}": {
                get: { summary: "Get product", tags: ["Store"] },
                patch: { summary: "Update product (admin)", tags: ["Store"], security: [{ session: [] }] },
                delete: { summary: "Delete product (admin)", tags: ["Store"], security: [{ session: [] }] },
            },
            "/store/cart": {
                get: { summary: "Get cart", tags: ["Store"], security: [{ session: [] }] },
                post: { summary: "Add to cart", tags: ["Store"], security: [{ session: [] }] },
                delete: { summary: "Clear cart", tags: ["Store"], security: [{ session: [] }] },
            },
            "/store/checkout": {
                post: { summary: "Create checkout session", tags: ["Store"], security: [{ session: [] }] },
            },
            "/store/orders": {
                get: { summary: "List orders", tags: ["Store"], security: [{ session: [] }] },
            },
            "/store/categories": {
                get: { summary: "List categories", tags: ["Store"] },
                post: { summary: "Create category (admin)", tags: ["Store"], security: [{ session: [] }] },
            },
            "/store/coupons": {
                get: { summary: "List coupons (admin)", tags: ["Store"], security: [{ session: [] }] },
                post: { summary: "Create coupon (admin)", tags: ["Store"], security: [{ session: [] }] },
            },
            "/blog/articles": {
                get: { summary: "List articles", tags: ["Blog"] },
                post: { summary: "Create article (admin)", tags: ["Blog"], security: [{ session: [] }] },
            },
            "/blog/categories": {
                get: { summary: "List blog categories", tags: ["Blog"] },
            },
            "/forum/categories": {
                get: { summary: "List forum categories", tags: ["Forum"] },
            },
            "/forum/topics": {
                get: { summary: "List topics", tags: ["Forum"] },
                post: { summary: "Create topic", tags: ["Forum"], security: [{ session: [] }] },
            },
            "/forum/topics/{id}": {
                get: { summary: "Get topic with posts", tags: ["Forum"] },
                post: { summary: "Reply to topic", tags: ["Forum"], security: [{ session: [] }] },
            },
            "/tickets": {
                get: { summary: "List tickets", tags: ["Support"], security: [{ session: [] }] },
                post: { summary: "Create ticket", tags: ["Support"], security: [{ session: [] }] },
            },
            "/announcements": { get: { summary: "Active announcements", tags: ["Content"] } },
            "/changelog": { get: { summary: "Changelog entries", tags: ["Content"] } },
            "/suggestions": {
                get: { summary: "List suggestions", tags: ["Content"] },
                post: { summary: "Create suggestion", tags: ["Content"], security: [{ session: [] }] },
            },
            "/leaderboard": {
                get: { summary: "Leaderboard", tags: ["Content"], parameters: [
                    { name: "type", in: "query", schema: { type: "string", enum: ["buyers", "voters", "forum"] } },
                ]},
            },
            "/vote": { get: { summary: "Vote sites", tags: ["Content"] } },
            "/vote/claim": { post: { summary: "Claim vote reward", tags: ["Content"], security: [{ session: [] }] } },
            "/credits": { get: { summary: "Credit balance", tags: ["Credits"], security: [{ session: [] }] } },
            "/wheel/prizes": { get: { summary: "Wheel prizes", tags: ["Game"] } },
            "/wheel/spin": { post: { summary: "Spin wheel", tags: ["Game"], security: [{ session: [] }] } },
            "/downloads": { get: { summary: "List downloads", tags: ["Content"] } },
            "/punishments": { get: { summary: "List punishments", tags: ["Content"] } },
            "/auth/profile": {
                get: { summary: "Get profile", tags: ["Auth"], security: [{ session: [] }] },
                patch: { summary: "Update profile", tags: ["Auth"], security: [{ session: [] }] },
            },
            "/rcon": { post: { summary: "Send RCON command (admin)", tags: ["Server"], security: [{ session: [] }] } },
        },
        components: {
            securitySchemes: {
                session: { type: "apiKey", in: "cookie", name: "next-auth.session-token" },
            },
        },
    };

    return NextResponse.json(spec);
}
