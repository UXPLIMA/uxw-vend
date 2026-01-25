"use client";

import { useState, useEffect } from "react";

interface ModuleStatus {
    [moduleId: string]: boolean;
}

let cachedStatus: ModuleStatus | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Hook to check if a module is enabled
 * Returns: { enabled: boolean, loading: boolean }
 */
export function useModuleEnabled(moduleId: string) {
    const [enabled, setEnabled] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const checkStatus = async () => {
            const now = Date.now();

            // Use cache if available
            if (cachedStatus && now - cacheTime < CACHE_TTL) {
                setEnabled(cachedStatus[moduleId] ?? true);
                setLoading(false);
                return;
            }

            try {
                const res = await fetch("/api/v1/modules/status");
                if (res.ok) {
                    const data = await res.json();
                    cachedStatus = data.modules || {};
                    cacheTime = now;
                    setEnabled(cachedStatus?.[moduleId] ?? true);
                }
            } catch {
                // Default to enabled on error
                setEnabled(true);
            } finally {
                setLoading(false);
            }
        };

        checkStatus();
    }, [moduleId]);

    return { enabled, loading };
}

/**
 * Hook to get all module statuses
 */
export function useModules() {
    const [modules, setModules] = useState<ModuleStatus>({});
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        fetch("/api/v1/modules/status")
            .then(res => res.json())
            .then(data => {
                setModules(data.modules || {});
                cachedStatus = data.modules || {};
                cacheTime = Date.now();
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    return { modules, loading };
}

/**
 * Clear the module cache (call after toggling a module)
 */
export function clearModuleCache() {
    cachedStatus = null;
    cacheTime = 0;
}
