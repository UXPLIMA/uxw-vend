/**
 * The rules core asks for on every request that is not a static asset.
 *
 * Core keeps the answer for a minute, so this is one query a minute rather
 * than one a request. Only the switched-on ones: a rule an operator turned off
 * should stop redirecting immediately, not stay in the answer with a flag
 * nothing reads.
 */
import type { HookHandlerFor } from "@/core/sdk";
import { prisma } from "@/core/sdk/server";

const onRoutingRedirects: HookHandlerFor<"routing.redirects", "filter"> = async (rules) => {
    const mine = await prisma.urlRedirect.findMany({
        where: { isActive: true },
        select: { from: true, to: true, permanent: true },
        // A site with more than this many moved pages has a different
        // problem, and the list is held in memory on every request.
        take: 500,
    });
    return [...rules, ...mine];
};

export default onRoutingRedirects;
