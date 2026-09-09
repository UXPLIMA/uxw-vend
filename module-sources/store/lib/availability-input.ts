import { siteTimeZone } from "@/core/sdk/server";
import { wallClockToInstant } from "@/core/sdk";
import type { ProductInput } from "./validations";

/**
 * The scheduling fields of a product, as they arrive from a form.
 *
 * The dates come as the operator typed them - "2026-10-20T18:00" - and mean
 * that hour where the shop is. Turning them into instants here, on the
 * server, is the whole point: a browser would use its own zone, so an
 * operator on holiday would schedule a sale three hours out and nothing would
 * say so.
 *
 * An absent field is left alone; an empty string clears the schedule, which
 * is how a form removes one.
 */
export async function availabilityData(
    input: Partial<ProductInput>,
    /** The product being edited, so it cannot be made to require itself. */
    selfId?: string,
): Promise<Record<string, unknown>> {
    const zone = await siteTimeZone();
    const data: Record<string, unknown> = {};

    const instant = (value: string | null | undefined) =>
        value === undefined ? undefined : value ? wallClockToInstant(value, zone) : null;

    const set = (key: string, value: unknown) => {
        if (value !== undefined) data[key] = value;
    };

    set("availableFrom", instant(input.availableFrom));
    set("availableUntil", instant(input.availableUntil));
    set("availableDays", input.availableDays);
    set("availableFromMinute", input.availableFromMinute);
    set("availableUntilMinute", input.availableUntilMinute);
    set("outsideWindow", input.outsideWindow);
    // One role is the question an operator asks; the column stays a list so
    // several remain possible through the API.
    if (input.roleId !== undefined) data.roleIds = input.roleId ? [input.roleId] : [];
    else set("roleIds", input.roleIds);
    set("perPersonLimit", input.perPersonLimit);
    set("perPersonPeriod", input.perPersonPeriod);
    set("periodStock", input.periodStock);
    set("periodStockWindow", input.periodStockWindow);
    // What a purchase grants: how long it lasts and which role it gives.
    // Carried here with the rest of the product's rules so one route writes
    // them all and none is forgotten by the next one added.
    set("durationDays", input.durationDays);
    set("grantsRoleId", input.grantsRoleId === "" ? null : input.grantsRoleId);
    // A product cannot require itself: the form offers every product and the
    // one being edited is in that list, so a stray click would make it
    // unbuyable by anybody, for ever, with nothing on screen saying why.
    if (input.requiresProductIds !== undefined) {
        data.requiresProductIds = input.requiresProductIds.filter((id) => id !== selfId);
    }
    set("requiresAny", input.requiresAny);
    set("salePrice", input.salePrice);
    set("saleFrom", instant(input.saleFrom));
    set("saleUntil", instant(input.saleUntil));

    return data;
}
