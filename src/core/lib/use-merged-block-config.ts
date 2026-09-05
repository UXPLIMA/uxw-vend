"use client";

import { useEffect, useState } from "react";
import type { Config } from "@measured/puck";
import { useAllModules } from "@/core/providers/module-provider";
import { buildMergedBlockConfig, type BlockConfigMode } from "@/core/lib/blocks-merger";

/**
 * The merged Puck config for the current install, or `null` while it loads.
 *
 * Reads the enabled state from the module provider rather than taking it as
 * an argument: a caller that forgot to pass it is what left disabled modules'
 * blocks in the builder palette and on public pages. `onError` fires once if
 * a block module fails to load.
 */
export function useMergedBlockConfig(mode: BlockConfigMode, onError?: () => void): Config | null {
    const moduleStates = useAllModules();
    const [config, setConfig] = useState<Config | null>(null);

    useEffect(() => {
        let cancelled = false;
        buildMergedBlockConfig({ moduleStates, mode })
            .then((merged) => { if (!cancelled) setConfig(merged); })
            .catch(() => { if (!cancelled) onError?.(); });
        return () => { cancelled = true; };
        // onError is a render-scoped callback; re-running on its identity
        // would rebuild the config on every parent render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moduleStates, mode]);

    return config;
}
