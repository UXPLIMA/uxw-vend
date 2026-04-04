
import { moduleLoader } from './module-loader';
import { ModuleState, ModuleManifest } from './module-types';

/**
 * Module System for uxwVend
 * 
 * Provides runtime module information populated by the file system loader.
 */

class ModuleSystem {
    private moduleStates: Map<string, ModuleState> = new Map();
    private initialized = false;

    /**
     * Get all module definitions directly from the loader
     */
    getDefinitions(): ModuleManifest[] {
        return moduleLoader.getModules().map(m => m.manifest);
    }

    /**
     * Get a specific module definition
     */
    getDefinition(id: string): ModuleManifest | undefined {
        return moduleLoader.getModule(id)?.manifest;
    }

    /**
     * Initialize module states from database
     */
    async initialize(states: ModuleState[]): Promise<void> {
        this.moduleStates.clear();
        for (const state of states) {
            this.moduleStates.set(state.id, state);
        }
        this.initialized = true;
    }

    /**
     * Check if a module is enabled
     */
    isEnabled(id: string): boolean {
        if (!this.initialized) return false;
        const state = this.moduleStates.get(id);
        // Module must exist in DB AND be enabled
        return state?.enabled === true;
    }

    /**
     * Get module configuration
     */
    getConfig<T = Record<string, unknown>>(id: string): T {
        const definition = this.getDefinition(id);
        const state = this.moduleStates.get(id);

        return {
            ...definition?.defaultConfig,
            ...state?.config,
        } as T;
    }

    /**
     * Get all enabled modules
     */
    getEnabledModules(): ModuleManifest[] {
        return this.getDefinitions().filter((m) => this.isEnabled(m.id));
    }

    /**
     * Get all permissions from enabled modules
     */
    getAllPermissions(): string[] {
        const permissions: string[] = [
            // Core permissions
            "admin.access",
            "admin.settings",
            "admin.users",
            "admin.roles",
        ];

        for (const mod of this.getEnabledModules()) {
            if (mod.permissions) {
                permissions.push(...mod.permissions);
            }
        }

        return permissions;
    }

    /**
     * Check if route belongs to an enabled module
     */
    isRouteEnabled(path: string): boolean {
        // Core routes are always enabled
        if (
            path.startsWith("/auth") ||
            path.startsWith("/admin/settings") ||
            path.startsWith("/admin/users") ||
            path.startsWith("/api/v1/auth") ||
            path.startsWith("/api/v1/users") ||
            path === "/" ||
            path === "/admin"
        ) {
            return true;
        }

        for (const mod of this.getDefinitions()) {
            // Combine public routes and admin routes
            const publicRoutes = mod.routes?.map(r => r.path) || [];
            const adminRoutes = mod.adminRoutes?.map(r => r.path) || [];

            // For admin paths, we need to check if regex matching should include /admin prefix logic
            // Manifest admin routes are like "/store/products". 
            // The URL path will be "/admin/store/products".
            // So we should prefix admin routes with "/admin" for matching.

            const allRoutes = [
                ...publicRoutes,
                ...adminRoutes.map(r => `/admin${r.startsWith('/') ? r : '/' + r}`)
            ];

            for (const route of allRoutes) {
                // Convert route pattern to regex
                // Replace [xxx] with [^/]+
                const pattern = route.replace(/\[.*?\]/g, "[^/]+");
                const regex = new RegExp(`^${pattern}$`);
                if (regex.test(path)) {
                    return this.isEnabled(module.id);
                }
            }
        }

        // Unknown routes are allowed (e.g. static assets or core routes not listed)
        return true;
    }
}

export const moduleSystem = new ModuleSystem();
export default moduleSystem;
