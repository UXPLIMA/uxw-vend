import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { log, readJsonBody } from "@/core/sdk/server";
import { applyFiltersAsync } from "@/core/sdk";
import { asPunishmentReport, liteBansReport } from "../../lib/report";

/**
 * One punishment, from a LiteBans server.
 *
 * The punishments module used to hold this endpoint itself, which made a
 * module about a member's record the owner of one plugin's payload shape, one
 * API key and one game's idea of a player. It owns the record; this owns
 * LiteBans.
 *
 * Two questions are asked and neither is answered here. Who the player is, if
 * anybody linked that account, and then: record this. The second one comes
 * back with `recorded: false` when nothing wrote it down, and that is a 503
 * rather than a 200, because a plugin that is told "fine" throws the event
 * away.
 */
function keyMatches(provided: string | null, expected: string | undefined): boolean {
    if (!provided || !expected) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    // Length is compared first: `timingSafeEqual` throws on a mismatch, and
    // the throw is itself a signal.
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    if (!keyMatches(request.headers.get("x-api-key"), process.env.MINECRAFT_LITEBANS_API_KEY)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;

    const parsed = liteBansReport.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid punishment", issues: parsed.error.issues.map((i) => i.path.join(".")) },
            { status: 400 },
        );
    }

    // Who this is, if this site knows. A name nobody has proved they own gets
    // a null and the punishment is still recorded under the name.
    const match = await applyFiltersAsync(
        "game-account.resolve",
        { userId: null },
        { uuid: parsed.data.uuid ?? null, username: parsed.data.name },
    );

    const outcome = await applyFiltersAsync(
        "punishment.record",
        { recorded: false, id: null },
        asPunishmentReport(parsed.data, match.userId),
    );

    if (!outcome.recorded) {
        log.warn("[minecraft-litebans] nothing recorded a punishment", { ref: String(parsed.data.id) });
        return NextResponse.json({ error: "Not recorded" }, { status: 503 });
    }

    return NextResponse.json({ recorded: true, id: outcome.id, linked: match.userId !== null });
}
