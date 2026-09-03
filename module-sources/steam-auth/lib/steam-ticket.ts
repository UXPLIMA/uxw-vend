/**
 * The bridge between Steam's redirect and an Auth.js session.
 *
 * Steam sends the browser back to a GET route. A GET route cannot sign anyone
 * in - Auth.js mints sessions from its own POST endpoint with a CSRF token -
 * so the callback stores the verified Steam id under a random token and hands
 * that token to the browser. The client page then calls `signIn("steam")` with
 * it, and the provider trades it for the id exactly once.
 *
 * The token is the only secret in the flow. It lives for two minutes, works
 * once, and is stored hashed.
 */
import crypto from "crypto";
import { prisma } from "@/core/sdk/server";

/** Long enough that guessing is hopeless, short enough for a query string. */
const TOKEN_BYTES = 32;

/**
 * Two minutes. The ticket only has to survive one redirect and one page load;
 * anything longer is just a wider window for a ticket leaked through browser
 * history or a referrer header.
 */
const TICKET_TTL_MS = 2 * 60 * 1000;

function hash(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/** Records a verified Steam id and returns the token that redeems it. */
export async function issueTicket(steamId: string): Promise<string> {
    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    await prisma.steamLoginTicket.create({
        data: {
            tokenHash: hash(token),
            steamId,
            expiresAt: new Date(Date.now() + TICKET_TTL_MS),
        },
    });
    // Cheap opportunistic sweep - this table would otherwise only ever grow
    // with the tickets of people who abandoned the flow half way.
    await prisma.steamLoginTicket
        .deleteMany({ where: { expiresAt: { lt: new Date() } } })
        .catch(() => undefined);
    return token;
}

/**
 * Redeems a token, returning the Steam id it stood for.
 *
 * The row is deleted before the expiry is checked, so a replay of an expired
 * token finds nothing rather than racing a second reader.
 */
export async function consumeTicket(token: string): Promise<string | null> {
    if (!token) return null;
    const row = await prisma.steamLoginTicket.findUnique({ where: { tokenHash: hash(token) } });
    if (!row) return null;
    await prisma.steamLoginTicket.delete({ where: { id: row.id } }).catch(() => undefined);
    if (row.expiresAt.getTime() < Date.now()) return null;
    return row.steamId;
}
