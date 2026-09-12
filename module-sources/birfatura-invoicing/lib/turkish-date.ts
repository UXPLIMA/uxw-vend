/**
 * The one date format this integration speaks: `dd.MM.yyyy HH:mm:ss`.
 *
 * Its documentation asks for that in both directions, and neither direction
 * was doing it. The window it sends was read with `new Date(value)`, which is
 * not a parser for this format: `01.07.2026 00:00:00` came back as the
 * seventh of January and `16.07.2026 23:59:59` came back invalid, which the
 * endpoint read as "no end". A request for one week in July answered with
 * half a year starting in the wrong month, and nothing failed - the
 * integrator asked, got orders, and invoiced them.
 *
 * The shop's own time zone decides what midnight means. A window that starts
 * at 00:00:00 starts when the shop's day does; reading it as UTC moves three
 * hours of sales to the wrong side of it.
 */

const STAMP = /^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/;

/** What a zone's offset is at a given instant, in minutes. */
function offsetAt(instant: Date, timeZone: string): number {
    // `en-US` with a fixed numeric shape, because the parts are read back
    // positionally and a locale that reorders them would be read wrong.
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(instant);

    const find = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
    // `24` for midnight is a legal answer from this formatter.
    const hour = find("hour") % 24;
    const asUtc = Date.UTC(find("year"), find("month") - 1, find("day"), hour, find("minute"), find("second"));
    return (asUtc - instant.getTime()) / 60_000;
}

/**
 * `16.07.2026 14:27:09` in a time zone, as an instant.
 *
 * Null rather than a guess when the string is not that shape: a window this
 * module cannot read is a question it cannot answer, and answering with the
 * wrong half year is worse than answering with nothing.
 */
export function readTurkishDateTime(value: string | null | undefined, timeZone: string): Date | null {
    const match = STAMP.exec((value ?? "").trim());
    if (!match) return null;

    const [, day, month, year, hour, minute, second] = match.map(Number) as unknown as number[];
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;

    const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);
    // Two passes, because the offset that applies is the one at the instant
    // being named rather than at the guess. Turkey has not moved its clocks
    // since 2016, so the second pass changes nothing there and everything in
    // a zone that does.
    const firstGuess = new Date(wallClock - offsetAt(new Date(wallClock), timeZone) * 60_000);
    const settled = new Date(wallClock - offsetAt(firstGuess, timeZone) * 60_000);

    // A day that does not exist - the 31st of a 30 day month - rolls over in
    // `Date.UTC`, and a rolled over date is not the date that was asked for.
    const check = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(settled);
    const asked = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return check === asked ? settled : null;
}

/** An instant, as `dd.MM.yyyy HH:mm:ss` in a time zone. */
export function writeTurkishDateTime(instant: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(instant);

    const find = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    const hour = find("hour") === "24" ? "00" : find("hour");
    return `${find("day")}.${find("month")}.${find("year")} ${hour}:${find("minute")}:${find("second")}`;
}
