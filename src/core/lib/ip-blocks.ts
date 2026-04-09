import { prisma } from "@/core/lib/db";
import type { IpBlock } from "@prisma/client";

/**
 * IP allowlist / blocklist.
 *
 * Backed by the IpBlock table. Supports single IPv4 addresses
 * (e.g. "1.2.3.4") and IPv4 CIDR ranges (e.g. "192.168.1.0/24").
 * IPv6 is intentionally not supported — middleware falls back to
 * "not blocked" for non-IPv4 input.
 *
 * Block scopes:
 *   - "all"   : entire site
 *   - "admin" : only admin UI / admin API routes
 *   - "api"   : only /api/* endpoints
 *
 * Middleware calls `isIpBlocked()` on every request — the block
 * list is cached in-process for CACHE_TTL_MS. If the DB query
 * fails the loader returns the previous cache (or an empty list
 * on cold start) so a DB outage cannot lock everyone out.
 */

export type IpBlockScope = "all" | "admin" | "api";

interface CachedBlock {
    ip: string;
    scope: string;
    expiresAt: Date | null;
}

const CACHE_TTL_MS = 60 * 1000;

let cache: CachedBlock[] = [];
let cacheLoadedAt = 0;
let cacheWarm = false;

/**
 * Load the active block list, using a 60s in-process cache.
 * Fails open: on a DB error, returns the last known cache (or an
 * empty list) rather than throwing.
 */
async function loadBlocks(): Promise<CachedBlock[]> {
    const now = Date.now();
    if (cacheWarm && now - cacheLoadedAt < CACHE_TTL_MS) {
        return cache;
    }

    try {
        const rows = await prisma.ipBlock.findMany({
            where: {
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { ip: true, scope: true, expiresAt: true },
        });
        cache = rows;
        cacheLoadedAt = now;
        cacheWarm = true;
        return cache;
    } catch (err) {
        console.error("[ip-blocks] Failed to load block list (failing open):", err);
        // Fail-open: return existing cache (possibly empty) so a DB
        // outage does not deny all traffic.
        return cache;
    }
}

/** Force-refresh the cached block list on the next read. */
export function invalidateIpBlockCache(): void {
    cacheLoadedAt = 0;
    cacheWarm = false;
}

/**
 * True if `ip` is a syntactically valid dotted-quad IPv4 address.
 */
function isIpv4(ip: string): boolean {
    const parts = ip.split(".");
    if (parts.length !== 4) return false;
    for (const p of parts) {
        if (!/^\d{1,3}$/.test(p)) return false;
        const n = Number(p);
        if (n < 0 || n > 255) return false;
    }
    return true;
}

function ipv4ToInt(ip: string): number | null {
    if (!isIpv4(ip)) return null;
    const parts = ip.split(".").map(Number);
    return (
        ((parts[0] << 24) >>> 0) +
        ((parts[1] << 16) >>> 0) +
        ((parts[2] << 8) >>> 0) +
        parts[3]
    );
}

/**
 * Returns true when `ip` falls inside the IPv4 CIDR range `cidr`.
 * Supports prefix lengths /0 through /32. Returns false for any
 * malformed input rather than throwing.
 */
export function ipInCidr(ip: string, cidr: string): boolean {
    if (!cidr.includes("/")) {
        // Not a CIDR — treat as exact match
        return ip === cidr;
    }
    const [network, prefixStr] = cidr.split("/");
    const prefix = Number(prefixStr);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

    const ipInt = ipv4ToInt(ip);
    const netInt = ipv4ToInt(network);
    if (ipInt === null || netInt === null) return false;

    if (prefix === 0) return true;
    const mask = prefix === 32 ? 0xffffffff : ((0xffffffff << (32 - prefix)) >>> 0);
    return (ipInt & mask) === (netInt & mask);
}

/**
 * True if `ip` matches a block entry with a compatible scope.
 * A block of scope "all" matches every request; a scoped block
 * only matches when the caller asks for that same scope.
 */
export async function isIpBlocked(ip: string, scope: IpBlockScope): Promise<boolean> {
    if (!ip || ip === "unknown") return false;

    const blocks = await loadBlocks();
    if (blocks.length === 0) return false;

    const now = Date.now();
    for (const block of blocks) {
        if (block.expiresAt && block.expiresAt.getTime() <= now) continue;
        if (block.scope !== "all" && block.scope !== scope) continue;

        if (block.ip.includes("/")) {
            if (ipInCidr(ip, block.ip)) return true;
        } else if (block.ip === ip) {
            return true;
        }
    }
    return false;
}

/** List every block (including expired) for the admin UI. */
export async function listBlocks(): Promise<IpBlock[]> {
    return prisma.ipBlock.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * Validate a single IPv4 address or IPv4 CIDR string.
 * Returns true when the value is safe to persist.
 */
export function isValidIpOrCidr(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.includes("/")) {
        const [ip, prefixStr] = trimmed.split("/");
        const prefix = Number(prefixStr);
        if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
        return isIpv4(ip);
    }
    return isIpv4(trimmed);
}

export async function addBlock(params: {
    ip: string;
    scope?: string;
    reason?: string;
    expiresAt?: Date | null;
    createdById?: string;
}): Promise<IpBlock> {
    const scope = params.scope === "admin" || params.scope === "api" ? params.scope : "all";
    const created = await prisma.ipBlock.create({
        data: {
            ip: params.ip.trim(),
            scope,
            reason: params.reason ?? null,
            expiresAt: params.expiresAt ?? null,
            createdById: params.createdById ?? null,
        },
    });
    invalidateIpBlockCache();
    return created;
}

export async function removeBlock(id: string): Promise<void> {
    await prisma.ipBlock.delete({ where: { id } });
    invalidateIpBlockCache();
}
