/**
 * The campaign a shop is running right now, if any, as prices.
 *
 * Read once per listing rather than per product: a shop runs few campaigns and
 * asking for each product's entry separately would be a query a line. The
 * answer is the same for everybody, so it stays cacheable alongside the rest
 * of the listing - a campaign is announced, not hidden.
 */
import { campaignIsRunning, campaignPriceFor, type CampaignEntry } from "./campaign";

interface CampaignReader {
    campaign: {
        findMany(args: {
            where: { isActive: true };
            select: {
                isActive: true;
                days: true;
                fromMinute: true;
                untilMinute: true;
                entries: { select: { productId: true; price: true; stock: true } };
            };
            take: number;
        }): Promise<{
            isActive: boolean;
            days: number[];
            fromMinute: number | null;
            untilMinute: number | null;
            entries: { productId: string; price: unknown; stock: number | null }[];
        }[]>;
    };
}

/**
 * Every entry from every campaign open at this moment.
 *
 * Two campaigns listing one product is an operator's decision that the two
 * offers overlap, and the buyer gets the better of them: `campaignPriceFor`
 * takes the lowest, so the order the rows arrive in cannot change a price.
 */
export async function runningCampaignEntries(
    db: CampaignReader,
    now: Date,
    zone: string,
): Promise<CampaignEntry[]> {
    const campaigns = await db.campaign.findMany({
        where: { isActive: true },
        // On the hot path: every product listing asks this. Switched-on
        // campaigns are few by nature, and a shop that has left fifty running
        // has a different problem - but the listing must not get slower with
        // every one an operator forgot to switch off.
        take: 50,
        select: {
            isActive: true,
            days: true,
            fromMinute: true,
            untilMinute: true,
            entries: { select: { productId: true, price: true, stock: true } },
        },
    });

    return campaigns
        .filter((campaign) => campaignIsRunning(campaign, now, zone))
        .flatMap((campaign) =>
            campaign.entries.map((entry) => ({
                productId: entry.productId,
                price: Number(entry.price),
            })),
        );
}

/** The price a product is listed at, once any running campaign is applied. */
export function pricedForCampaign(
    productId: string,
    priced: { price: number; was: number | null; onSale: boolean },
    entries: CampaignEntry[],
): { price: number; was: number | null; onSale: boolean } {
    if (entries.length === 0) return priced;
    const price = campaignPriceFor(productId, priced.price, entries);
    if (price === priced.price) return priced;
    // The struck-through figure stays whatever it already was, or becomes the
    // ordinary price: a shopper compares against what they would have paid a
    // minute ago, not against a list price nobody was charging.
    return { price, was: priced.was ?? priced.price, onSale: true };
}
