import path from "node:path";
import { defineConfig } from "prisma/config";

// Load .env for CLI commands (Prisma 7 doesn't auto-load .env)
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { require("dotenv/config"); } catch { /* dotenv optional */ }

export default defineConfig({
    schema: path.join(__dirname, "prisma", "schema.prisma"),
    datasource: {
        url: process.env.DATABASE_URL!,
    },
});
