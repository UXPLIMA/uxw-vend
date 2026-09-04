
import { moduleLoader } from './module-loader';
import { CORE_PERMISSIONS } from './permission-names';
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
     * Get all enabled modules
     */
    getEnabledModules(): ModuleManifest[] {
        return this.getDefinitions().filter((m) => this.isEnabled(m.id));
    }

    /**
     * Get all permissions from enabled modules
     */
    getAllPermissions(): string[] {
        const permissions: string[] = [...CORE_PERMISSIONS];

        for (const mod of this.getEnabledModules()) {
            if (mod.permissions) {
                permissions.push(...mod.permissions);
            }
        }

        return permissions;
    }

}

export const moduleSystem = new ModuleSystem();
export default moduleSystem;
