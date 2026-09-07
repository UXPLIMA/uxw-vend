/**
 * How many units of a product have been sold.
 *
 * The shop's "most popular" sort used to work this out per request: a
 * `groupBy` over every paid order item, joined to Order for the status and to
 * Product for the list's own filter, with no limit, because a ranking has to
 * be complete before a page of it can be cut. Measured in a scratch schema
 * with 50,000 orders, 150,000 order items and 3,000 products:
 *
 *     the aggregation, as the route ran it        90.3 ms
 *     ordering by this counter, indexed            1.0 ms
 *
 * So it is kept on the row, and maintained in the same transaction that grants
 * the products: a counter that can drift away from the orders it describes is
 * worse than one that costs 90 ms.
 *
 * It counts units. An order for five of something moves it by five, which is
 * what the name says and what "most sold" means; the old ranking counted order
 * lines, which was what a `groupBy` could express rather than a decision
 * anybody made.
 */
import type { StockClaim } from "./stock";

/** The part of the Prisma client this needs, transaction client included. */
export interface PopularityClient {
    product: {
        updateMany(args: {
            where: { id: string; unitsSold?: { gte: number } };
            data: { unitsSold: { increment?: number; decrement?: number } };
        }): Promise<{ count: number }>;
    };
}

/** Record a sale. Every product counts, stocked or not: popularity is not stock. */
export async function countSales(client: PopularityClient, claims: StockClaim[]): Promise<void> {
    for (const claim of claims) {
        await client.product.updateMany({
            where: { id: claim.productId },
            data: { unitsSold: { increment: claim.quantity } },
        });
    }
}

/**
 * Take a refunded sale back out.
 *
 * The condition is a floor rather than a race guard: an order settled before
 * this column existed has nothing here to give back, and a refund for it must
 * not push the count below zero. Where the count is short, it stays where it
 * is - a number that is too high by one beats a negative one that no ordering
 * can make sense of.
 */
export async function uncountSales(client: PopularityClient, claims: StockClaim[]): Promise<void> {
    for (const claim of claims) {
        await client.product.updateMany({
            where: { id: claim.productId, unitsSold: { gte: claim.quantity } },
            data: { unitsSold: { decrement: claim.quantity } },
        });
    }
}
