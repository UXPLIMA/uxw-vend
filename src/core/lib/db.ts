import { PrismaClient } from "@prisma/client";
import { onShutdown } from "./shutdown";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
    // Prisma 7 requires a driver adapter for all database connections.
    // We use eval("require") to prevent Turbopack from bundling pg/net/dns/tls
    // into the client SSR bundle — these are Node.js-only modules.
    const _require = typeof __webpack_require__ === "function"
        ? __non_webpack_require__
        : eval("require");

    const { PrismaPg } = _require("@prisma/adapter-pg");
    const { Pool } = _require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    return new PrismaClient({
        adapter: new PrismaPg(pool),
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Drain the Postgres connection pool when the process is asked to stop so
// in-flight queries finish cleanly and the pool doesn't leak sockets that
// the OS would otherwise time out on its own schedule.
onShutdown("prisma", async () => {
    await prisma.$disconnect();
});

export default prisma;

// Webpack/Turbopack global declarations
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
