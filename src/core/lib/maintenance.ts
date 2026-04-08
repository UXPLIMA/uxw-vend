import prisma from "@/core/lib/db";

/**
 * Maintenance mode configuration, backed by the Setting table under key
 * `maintenance_mode`. Values are cached in memory for 30 seconds to keep
 * middleware hot-path cheap.
 */

export interface MaintenanceConfig {
    enabled: boolean;
    message?: string;
    allowedRoles?: string[];
}

const DEFAULT_CONFIG: MaintenanceConfig = {
    enabled: false,
    message: "",
    allowedRoles: ["admin"],
};

const SETTING_KEY = "maintenance_mode";
const CACHE_TTL_MS = 30_000;

let cached: MaintenanceConfig | null = null;
let cachedAt = 0;

function normalize(raw: unknown): MaintenanceConfig {
    if (!raw || typeof raw !== "object") return { ...DEFAULT_CONFIG };
    const obj = raw as Record<string, unknown>;
    const allowed = Array.isArray(obj.allowedRoles)
        ? (obj.allowedRoles as unknown[]).filter((r): r is string => typeof r === "string")
        : DEFAULT_CONFIG.allowedRoles;
    return {
        enabled: Boolean(obj.enabled),
        message: typeof obj.message === "string" ? obj.message : "",
        allowedRoles: allowed,
    };
}

export async function getMaintenanceConfig(): Promise<MaintenanceConfig> {
    const now = Date.now();
    if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

    try {
        const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
        const config = row ? normalize(row.value) : { ...DEFAULT_CONFIG };
        cached = config;
        cachedAt = now;
        return config;
    } catch {
        // On DB error, fail-safe: return disabled so site stays up.
        return { ...DEFAULT_CONFIG };
    }
}

export async function setMaintenanceConfig(config: MaintenanceConfig): Promise<void> {
    const normalized = normalize(config);
    await prisma.setting.upsert({
        where: { key: SETTING_KEY },
        update: { value: normalized as unknown as object },
        create: { key: SETTING_KEY, value: normalized as unknown as object, module: "core" },
    });
    cached = normalized;
    cachedAt = Date.now();
}

export function invalidateMaintenanceCache(): void {
    cached = null;
    cachedAt = 0;
}
