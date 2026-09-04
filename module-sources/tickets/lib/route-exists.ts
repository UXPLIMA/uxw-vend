import { prisma } from "@/core/sdk/server";

/**
 * Does `/support/<id>` name a ticket?
 *
 * Existence only: whether the visitor may read it is the page's question, and
 * it answers 401 or 403 for that. Ids are cuids, so answering "no such thing"
 * for an id nobody issued tells a prober nothing they could have guessed.
 */
export default async function ticketExists(params: Record<string, string | string[]>): Promise<boolean> {
    const raw = params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id) return false;
    const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
    return ticket !== null;
}
