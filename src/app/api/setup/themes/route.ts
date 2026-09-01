import { NextResponse } from "next/server";
import { themeRegistry } from "@/core/generated/theme-registry";
import { isSetupComplete } from "@/core/lib/setup-state";

/**
 * Themes available to the first-run wizard.
 *
 * The wizard has always fetched this path; the route did not exist, so the
 * theme step rendered an empty grid and every install silently kept whatever
 * default the client held.
 *
 * Gated on setup being incomplete, like every other route under /api/setup —
 * once a site is live, its theme list is served from the admin API instead.
 */
export async function GET() {
    if (await isSetupComplete()) {
        return NextResponse.json({ error: "Setup has already been completed." }, { status: 409 });
    }

    const themes = Object.values(themeRegistry).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? "",
        author: t.author ?? "",
        version: t.version,
        // Lets the wizard preview a theme without loading its stylesheet.
        defaultMode: t.modes?.default ?? null,
        modes: t.modes?.available ? Object.keys(t.modes.available) : [],
        suggestedModules: t.suggestedModules ?? [],
    }));

    return NextResponse.json({ themes });
}
