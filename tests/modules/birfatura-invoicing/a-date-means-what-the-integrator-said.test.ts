// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
    readTurkishDateTime,
    writeTurkishDateTime,
} from "../../../module-sources/birfatura-invoicing/lib/turkish-date";

/**
 * The integrator writes a date the way a Turkish invoice does, and this shop
 * read it the way a browser guesses.
 *
 * Its documentation is explicit: every date crossing this boundary is
 * `dd.MM.yyyy HH:mm:ss`, in both directions. The window it asks for was being
 * parsed with `new Date(value)`, which is not a parser for that format and
 * does not say so. `01.07.2026 00:00:00` - the first of July - came back as
 * the seventh of January, and `16.07.2026 23:59:59` came back as an invalid
 * date, which the endpoint turned into "no end", so a request for one week in
 * July answered with six months of sales starting in the wrong one.
 *
 * Nothing failed. The integrator asked for a window, got orders, and invoiced
 * them; the only way to notice was to compare what it invoiced with what was
 * sold, which is what invoicing is supposed to save somebody from doing.
 *
 * The other direction was wrong too: the answer carried `toISOString()`, and
 * the documentation asks for the same `dd.MM.yyyy HH:mm:ss` it sends.
 *
 * Both are pinned here, in the shop's own time zone, because midnight is
 * midnight where the shop is rather than in UTC: three hours of sales sit on
 * the wrong side of the window otherwise.
 */
const ISTANBUL = "Europe/Istanbul";

describe("a date means what the integrator said it means", () => {
    it("reads the first of July as the first of July", () => {
        const at = readTurkishDateTime("01.07.2026 00:00:00", ISTANBUL);
        expect(at).not.toBeNull();
        // Midnight in Istanbul is 21:00 the day before, in UTC.
        expect(at?.toISOString()).toBe("2026-06-30T21:00:00.000Z");
    });

    it("reads the end of a window as the end of that day", () => {
        const at = readTurkishDateTime("16.07.2026 23:59:59", ISTANBUL);
        expect(at?.toISOString()).toBe("2026-07-16T20:59:59.000Z");
    });

    it("refuses what it cannot read rather than inventing a day", () => {
        expect(readTurkishDateTime("2026-07-01T00:00:00Z", ISTANBUL)).toBeNull();
        expect(readTurkishDateTime("32.07.2026 00:00:00", ISTANBUL)).toBeNull();
        expect(readTurkishDateTime("01.13.2026 00:00:00", ISTANBUL)).toBeNull();
        expect(readTurkishDateTime("", ISTANBUL)).toBeNull();
        expect(readTurkishDateTime(null, ISTANBUL)).toBeNull();
    });

    it("writes a date the way the integrator reads one", () => {
        expect(writeTurkishDateTime(new Date("2026-07-16T11:27:09.000Z"), ISTANBUL)).toBe("16.07.2026 14:27:09");
        expect(writeTurkishDateTime(new Date("2026-06-30T21:00:00.000Z"), ISTANBUL)).toBe("01.07.2026 00:00:00");
    });

    it("comes back out the way it went in", () => {
        const written = "16.07.2026 14:27:09";
        const read = readTurkishDateTime(written, ISTANBUL);
        expect(writeTurkishDateTime(read as Date, ISTANBUL)).toBe(written);
    });
});
