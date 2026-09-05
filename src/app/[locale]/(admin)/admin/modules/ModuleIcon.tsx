"use client";

import { Package } from "lucide-react";
import { DynamicIcon, iconNames } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";
import { resolveIconName } from "@/core/lib/icon-names";

// Module manifest icons come from each module's `icon` field. Render via
// lucide's DynamicIcon so adding a new icon name in any manifest works
// without touching this file - core stays module-agnostic. The name is
// resolved against lucide's own list first: five of the modules here are
// named `Gamepad2` or `Code2`, which lucide spells with a hyphen.
export function ModuleIcon({ name, size = 22 }: { name?: string; size?: number }) {
    const resolved = name ? resolveIconName(name, iconNames) : null;
    if (!resolved) return <Package size={size} />;
    return <DynamicIcon name={resolved as IconName} size={size} fallback={() => <Package size={size} />} />;
}
