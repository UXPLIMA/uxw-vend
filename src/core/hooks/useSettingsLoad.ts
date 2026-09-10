"use client";

import React, { useEffect, useRef, useState } from "react";
import { readJson } from "@/core/lib/read-json";

/**
 * Reads the site settings once, and says whether it worked.
 *
 * Five screens had written this out by hand and all five had the same hole:
 * `.catch(() => setLoading(false))`. A failed read left the form at its
 * defaults with no indication that anything had gone wrong, and the save
 * button underneath it wrote those defaults back - a lost custom stylesheet,
 * a site name reset to "uxwVend", a navbar reseeded from the registry.
 *
 * `apply` is called with `data.settings` on success and not at all otherwise,
 * so the caller keeps its own state and only has to refuse to render the form
 * when `failed` is true. It is read through a ref: a screen that passes an
 * inline closure would otherwise refetch on every render.
 *
 * `secretsConfigured` names the credential keys that currently hold a value.
 * The values themselves are not in the response and never will be, so this is
 * the only way a screen can tell "no key has been set" from "a key is set and
 * you are not being shown it" - a distinction an operator needs before they
 * decide whether the gateway is configured.
 *
 * `deps` is for a screen whose reading of the settings depends on something
 * that arrives after mount - the navbar editor seeds itself from the module
 * registry when there is no saved override, and which modules are enabled
 * comes from a provider.
 */
export function useSettingsLoad(
    apply: (settings: Record<string, unknown>) => void,
    deps: React.DependencyList = [],
) {
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [secretsConfigured, setSecretsConfigured] = useState<string[]>([]);

    const applyRef = useRef(apply);
    applyRef.current = apply;

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        fetch("/api/v1/settings")
            .then(readJson<{ settings?: Record<string, unknown>; secretsConfigured?: string[] }>)
            .then((data) => {
                if (cancelled) return;
                applyRef.current(data.settings ?? {});
                setSecretsConfigured(data.secretsConfigured ?? []);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setFailed(true);
                setLoading(false);
            });
        return () => { cancelled = true; };
    // `deps` is spread deliberately; the caller owns what belongs in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt, ...deps]);

    return { loading, failed, secretsConfigured, retry: () => setAttempt((a) => a + 1) };
}
