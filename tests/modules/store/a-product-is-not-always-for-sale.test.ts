/**
 * A product can be for sale only sometimes.
 *
 * Until now the shop had one switch per product - active or not - so every
 * shape a community actually sells took a person watching a clock: a seasonal
 * pack turned on by hand on the 20th and off by hand on the 5th, a Friday
 * evening offer somebody had to be awake for, a "one per account" rule
 * enforced by reading the orders afterwards and apologising.
 *
 * Four rules, and every one of them is asked in three places - the list that
 * decides what to draw, the button that decides whether to offer it, and the
 * checkout that decides whether to take the money. So they are one function
 * and this is what pins it. The third place is the one that matters: the
 * first two are a courtesy, and a shop that only enforces a limit in the
 * browser has no limit.
 */
import { describe, it, expect } from "vitest";
import {
    availabilityOf,
    effectivePrice,
    nextOpening,
    type ProductRules,
} from "@/modules/store/lib/availability";

const ZONE = "Europe/Istanbul";
/** A Friday, 18:30 in Istanbul. */
const FRIDAY_EVENING = new Date("2026-09-11T15:30:00Z");
/** The Tuesday before it, 10:00 in Istanbul. */
const TUESDAY_MORNING = new Date("2026-09-08T07:00:00Z");

const always: ProductRules = {
    isActive: true,
    roleIds: [],
    requiresProductIds: [],
    requiresAny: false,
    availableFrom: null,
    availableUntil: null,
    availableDays: [],
    availableFromMinute: null,
    availableUntilMinute: null,
    outsideWindow: "countdown",
    perPersonLimit: null,
    perPersonPeriod: "ever",
    periodStock: null,
    periodStockWindow: "day",
    stock: null,
    price: 10,
    salePrice: null,
    saleFrom: null,
    saleUntil: null,
};

const counted = { boughtByPerson: 0, soldInPeriod: 0, roleId: "member" };

describe("a product with no rules", () => {
    it("is for sale", () => {
        expect(availabilityOf(always, counted, FRIDAY_EVENING, ZONE).state).toBe("open");
    });

    it("is not for sale when the operator switched it off", () => {
        const off = availabilityOf({ ...always, isActive: false }, counted, FRIDAY_EVENING, ZONE);
        expect(off.state).toBe("off");
        expect(off.buyable).toBe(false);
    });
});

describe("a run between two dates", () => {
    const seasonal: ProductRules = {
        ...always,
        availableFrom: new Date("2026-09-10T00:00:00Z"),
        availableUntil: new Date("2026-09-20T00:00:00Z"),
    };

    it("is not open before it starts, and says when it will", () => {
        const before = availabilityOf(seasonal, counted, TUESDAY_MORNING, ZONE);
        expect(before.state).toBe("early");
        expect(before.buyable).toBe(false);
        expect(before.opensAt).toEqual(seasonal.availableFrom);
    });

    it("is open inside the run", () => {
        expect(availabilityOf(seasonal, counted, FRIDAY_EVENING, ZONE).state).toBe("open");
    });

    it("is over afterwards, and does not offer a next time", () => {
        const after = availabilityOf(seasonal, counted, new Date("2026-09-21T00:00:00Z"), ZONE);
        expect(after.state).toBe("ended");
        expect(after.opensAt).toBeNull();
    });
});

describe("a weekly window", () => {
    /** Fridays and Saturdays, 18:00 to 22:00. */
    const happyHour: ProductRules = {
        ...always,
        availableDays: [5, 6],
        availableFromMinute: 18 * 60,
        availableUntilMinute: 22 * 60,
    };

    it("is open inside it", () => {
        expect(availabilityOf(happyHour, counted, FRIDAY_EVENING, ZONE).state).toBe("open");
    });

    it("is shut on a day it does not run", () => {
        const shut = availabilityOf(happyHour, counted, TUESDAY_MORNING, ZONE);
        expect(shut.state).toBe("closed");
        expect(shut.buyable).toBe(false);
    });

    it("is shut before the hour, on a day it does run", () => {
        // Friday 12:00 Istanbul.
        const noon = new Date("2026-09-11T09:00:00Z");
        expect(availabilityOf(happyHour, counted, noon, ZONE).state).toBe("closed");
    });

    it("reads the hour on the site's clock, not the server's", () => {
        // 16:30 UTC is 19:30 in Istanbul: inside. The same instant is 12:30
        // in New York, and the same rules there would be shut.
        const at = new Date("2026-09-11T16:30:00Z");
        expect(availabilityOf(happyHour, counted, at, ZONE).state).toBe("open");
        expect(availabilityOf(happyHour, counted, at, "America/New_York").state).toBe("closed");
    });

    it("says when it opens next, so the page can count down to it", () => {
        const next = nextOpening(happyHour, TUESDAY_MORNING, ZONE);
        expect(next).not.toBeNull();
        // The coming Friday at 18:00 Istanbul is 15:00 UTC.
        expect(next?.toISOString()).toBe("2026-09-11T15:00:00.000Z");
    });

    it("crosses midnight when the window does", () => {
        // 22:00 to 02:00, on Fridays. Saturday 00:30 Istanbul is inside the
        // Friday window; a naive from < now < until would call it shut.
        const lateNight: ProductRules = {
            ...always,
            availableDays: [5],
            availableFromMinute: 22 * 60,
            availableUntilMinute: 2 * 60,
        };
        const halfPastMidnight = new Date("2026-09-11T21:30:00Z"); // Sat 00:30 Istanbul
        expect(availabilityOf(lateNight, counted, halfPastMidnight, ZONE).state).toBe("open");
    });
});

describe("a limit per person", () => {
    const oneEach: ProductRules = { ...always, perPersonLimit: 1, perPersonPeriod: "ever" };

    it("lets somebody who has none buy", () => {
        expect(availabilityOf(oneEach, { ...counted, boughtByPerson: 0 }, FRIDAY_EVENING, ZONE).buyable).toBe(true);
    });

    it("refuses somebody who has theirs", () => {
        const done = availabilityOf(oneEach, { ...counted, boughtByPerson: 1 }, FRIDAY_EVENING, ZONE);
        expect(done.state).toBe("limit_reached");
        expect(done.buyable).toBe(false);
    });

    it("counts how many are left, so the page can say", () => {
        const some = availabilityOf({ ...oneEach, perPersonLimit: 3 }, { ...counted, boughtByPerson: 1 }, FRIDAY_EVENING, ZONE);
        expect(some.remainingForPerson).toBe(2);
    });
});

describe("a limit that refills", () => {
    const tenADay: ProductRules = { ...always, periodStock: 10, periodStockWindow: "day" };

    it("is open while the day's allowance lasts", () => {
        const left = availabilityOf(tenADay, { ...counted, soldInPeriod: 9 }, FRIDAY_EVENING, ZONE);
        expect(left.buyable).toBe(true);
        expect(left.remainingInPeriod).toBe(1);
    });

    it("is shut once the allowance is gone, and comes back", () => {
        const gone = availabilityOf(tenADay, { ...counted, soldInPeriod: 10 }, FRIDAY_EVENING, ZONE);
        expect(gone.state).toBe("sold_out_for_now");
        expect(gone.buyable).toBe(false);
        // Not "ended": tomorrow it sells again, and a page that says
        // otherwise sends the reader away for good.
        expect(gone.opensAt).not.toBeNull();
    });
});

describe("what a shopper pays", () => {
    const onSale: ProductRules = {
        ...always,
        price: 100,
        salePrice: 60,
        saleFrom: new Date("2026-09-10T00:00:00Z"),
        saleUntil: new Date("2026-09-13T00:00:00Z"),
    };

    it("is the sale price inside the sale", () => {
        expect(effectivePrice(onSale, FRIDAY_EVENING)).toEqual({ price: 60, was: 100, onSale: true });
    });

    it("is the ordinary price before and after it", () => {
        expect(effectivePrice(onSale, TUESDAY_MORNING).price).toBe(100);
        expect(effectivePrice(onSale, new Date("2026-09-14T00:00:00Z")).onSale).toBe(false);
    });

    it("ignores a sale price nobody dated, rather than discounting forever", () => {
        expect(effectivePrice({ ...onSale, saleFrom: null, saleUntil: null }, FRIDAY_EVENING).price).toBe(60);
    });

    it("never charges more than the ordinary price", () => {
        // A typo in the admin form is not a price rise.
        expect(effectivePrice({ ...onSale, salePrice: 150 }, FRIDAY_EVENING).price).toBe(100);
    });
});

describe("a product for certain ranks", () => {
    const vipOnly: ProductRules = { ...always, roleIds: ["role-vip"] };

    it("is for sale to somebody who has the rank", () => {
        const buyer = { ...counted, roleId: "role-vip" };
        expect(availabilityOf(vipOnly, buyer, FRIDAY_EVENING, ZONE).state).toBe("open");
    });

    it("is refused to somebody who does not", () => {
        const shut = availabilityOf(vipOnly, counted, FRIDAY_EVENING, ZONE);
        expect(shut.state).toBe("wrong_role");
        expect(shut.buyable).toBe(false);
    });

    it("is refused to a visitor with no account at all", () => {
        expect(availabilityOf(vipOnly, { ...counted, roleId: null }, FRIDAY_EVENING, ZONE).state).toBe("wrong_role");
    });

    it("says the rank before the clock, because that is the one they cannot wait out", () => {
        // Shut and not for them: telling them to come back on Friday wastes
        // their Friday.
        const both = { ...vipOnly, availableDays: [5], availableFromMinute: 18 * 60, availableUntilMinute: 22 * 60 };
        expect(availabilityOf(both, counted, TUESDAY_MORNING, ZONE).state).toBe("wrong_role");
    });

    it("lets everybody in when no rank is named", () => {
        expect(availabilityOf(always, { ...counted, roleId: null }, FRIDAY_EVENING, ZONE).state).toBe("open");
    });
});
