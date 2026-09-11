import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * Listings a member has put up, and a few that already sold.
 *
 * Every one names the `role` kind, which is what `role-delivery` claims. A
 * listing whose kind no installed module answers is refused at checkout and
 * shows a seller an error the demo cannot explain, so seeding one would be
 * seeding a broken row.
 *
 * Three are sold rather than live. The board is the interesting screen when it
 * has both, and the sold ones are what make the site's cut visible anywhere at
 * all - it is recorded on the sale and nowhere else.
 */
const LISTINGS: { title: string; body: string; price: number; days: number; sold?: true }[] = [
    { title: "Gold rank, 30 days", body: "Transferring mine, I am taking a break.", price: 450, days: 30 },
    { title: "Gold rank, 7 days", body: "Bought two by mistake.", price: 120, days: 7 },
    { title: "VIP, a fortnight", body: "Coloured name and the extra homes.", price: 260, days: 14 },
    { title: "Gold rank, 90 days", body: "The long one. Will not be renewing.", price: 1_150, days: 90, sold: true },
    { title: "VIP, 30 days", body: "Leaving the server, somebody may as well have it.", price: 380, days: 30, sold: true },
    { title: "Gold rank, 14 days", body: "Spare from the seasonal bundle.", price: 210, days: 14, sold: true },
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        // A role to sell. The listing carries the id, and the delivery module
        // refuses a role that has since been deleted - which is the right
        // behaviour and a confusing demo, so this uses one that exists.
        const role = await ctx.prisma.role.findFirst({
            where: { name: { not: "admin" } },
            orderBy: { priority: "desc" },
            select: { id: true },
        });
        if (!role) { ctx.log("no role to sell, skipped"); return; }

        for (const listing of LISTINGS) {
            const existing = await ctx.prisma.marketListing.findFirst({ where: { title: listing.title } });
            if (existing) continue;

            const seller = ctx.pick(ctx.users);
            const created = await ctx.create("marketListing", () => ctx.prisma.marketListing.create({
                data: {
                    sellerId: seller.id,
                    title: listing.title,
                    body: listing.body,
                    price: listing.price,
                    kind: "role",
                    payload: { roleId: role.id, days: listing.days },
                    isSold: listing.sold === true,
                    soldAt: listing.sold ? ctx.daysAgo(30) : null,
                    isActive: true,
                    createdAt: ctx.daysAgo(90),
                },
            }));

            if (!listing.sold) continue;

            // The three numbers a sale records. The cut is the site's and the
            // rest is the seller's; they have to add up to what was paid, or
            // the one screen that shows the site's earnings is wrong.
            const fee = Math.round(listing.price * 0.05);
            const buyer = ctx.pick(ctx.users.filter((u) => u.id !== seller.id));
            await ctx.create("marketSale", () => ctx.prisma.marketSale.create({
                data: {
                    listingId: created.id,
                    buyerId: buyer?.id ?? seller.id,
                    sellerId: seller.id,
                    price: listing.price,
                    commission: fee,
                    toSeller: listing.price - fee,
                    delivery: "delivered",
                    createdAt: ctx.daysAgo(30),
                },
            }));
        }
        ctx.log(`${LISTINGS.length} listings, ${LISTINGS.filter((l) => l.sold).length} of them sold`);
    },
};
