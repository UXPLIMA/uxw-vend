"use client";

import { Package } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";

// Module manifest icons come from each module's `icon` field. Render via
// lucide's DynamicIcon so adding a new icon name in any manifest works
// without touching this file - core stays module-agnostic.
export function ModuleIcon({ name, size = 22 }: { name?: string; size?: number }) {
    if (!name) return <Package size={size} />;
    const kebab = name.replace(/[A-Z]/g, (m, i) => (i === 0 ? m.toLowerCase() : `-${m.toLowerCase()}`));
    return <DynamicIcon name={kebab as IconName} size={size} fallback={() => <Package size={size} />} />;
}
