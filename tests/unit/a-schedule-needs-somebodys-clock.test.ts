/**
 * "Friday at 18:00" is not a moment until somebody says whose clock.
 *
 * The server keeps UTC, the operator lives somewhere, and the visitor could
 * be anywhere. A shop that opens a product on Friday evening has to mean one
 * of those three, and the only one that makes a sale start at the same
 * instant for everybody - which is what a limited run needs - is the site's
 * own clock, set by the operator.
 *
 * So there is one setting and one reader, and everything scheduled goes
 * through it. Getting this wrong is silent: the window simply opens at the
 * wrong hour, and on a server in UTC with an operator in Istanbul that is
 * three hours of a sale nobody could buy.
 */
import { describe, it, expect } from "vitest";
import { minutesInto, weekdayIn, zonedNow, isValidTimeZone, wallClockToInstant, instantToWallClock, DEFAULT_TIME_ZONE } from "@/core/lib/site-time";

// A Friday, 15:30 UTC.
const MOMENT = new Date("2026-09-11T15:30:00Z");

describe("reading a wall clock in a named zone", () => {
    it("gives the hour that zone is showing", () => {
        expect(minutesInto(MOMENT, "UTC")).toBe(15 * 60 + 30);
        expect(minutesInto(MOMENT, "Europe/Istanbul")).toBe(18 * 60 + 30);
        expect(minutesInto(MOMENT, "America/New_York")).toBe(11 * 60 + 30);
    });

    it("gives the day that zone is on, which is not always the same day", () => {
        // 22:30 UTC on a Friday is already Saturday in Auckland.
        const evening = new Date("2026-09-11T22:30:00Z");
        expect(weekdayIn(evening, "UTC")).toBe(5);
        expect(weekdayIn(evening, "Pacific/Auckland")).toBe(6);
    });

    it("counts Sunday as 0, the way every schedule in this codebase does", () => {
        expect(weekdayIn(new Date("2026-09-13T12:00:00Z"), "UTC")).toBe(0);
        expect(weekdayIn(new Date("2026-09-14T12:00:00Z"), "UTC")).toBe(1);
    });

    it("follows daylight saving, because a fixed offset does not", () => {
        // Istanbul does not move; New York does. Same wall-clock hour in
        // January and July only if the zone is read rather than an offset
        // remembered.
        const january = new Date("2026-01-11T17:00:00Z");
        const july = new Date("2026-07-11T16:00:00Z");
        expect(minutesInto(january, "America/New_York")).toBe(12 * 60);
        expect(minutesInto(july, "America/New_York")).toBe(12 * 60);
    });

    it("falls back rather than throwing on a zone that is not one", () => {
        // The setting is a string an operator typed. A bad one must not take
        // the shop down; it means the site keeps the clock it had.
        expect(isValidTimeZone("Europe/Istanbul")).toBe(true);
        expect(isValidTimeZone("Mars/Olympus")).toBe(false);
        expect(isValidTimeZone("")).toBe(false);
        expect(minutesInto(MOMENT, "Mars/Olympus")).toBe(minutesInto(MOMENT, DEFAULT_TIME_ZONE));
    });

    it("hands back both halves at once, since every caller wants both", () => {
        expect(zonedNow(MOMENT, "Europe/Istanbul")).toEqual({ weekday: 5, minutes: 18 * 60 + 30 });
    });
});

describe("a date an operator typed", () => {
    it("means the hour they meant, on the site's clock", () => {
        // 18:00 in Istanbul is 15:00 UTC.
        expect(wallClockToInstant("2026-10-20T18:00", "Europe/Istanbul")?.toISOString())
            .toBe("2026-10-20T15:00:00.000Z");
        expect(wallClockToInstant("2026-10-20T18:00", "UTC")?.toISOString())
            .toBe("2026-10-20T18:00:00.000Z");
    });

    it("comes back out the way it went in", () => {
        for (const zone of ["Europe/Istanbul", "America/New_York", "UTC"]) {
            const wall = "2026-10-20T18:00";
            const instant = wallClockToInstant(wall, zone) as Date;
            expect(instantToWallClock(instant, zone)).toBe(wall);
        }
    });

    it("answers nothing for a string that is not a date", () => {
        // The value is typed by a person, and an empty field is how a
        // schedule is removed.
        expect(wallClockToInstant("", "UTC")).toBeNull();
        expect(wallClockToInstant("whenever", "UTC")).toBeNull();
    });
});
