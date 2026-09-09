/**
 * An hour box, both ways.
 *
 * Pure, and its own file, because two forms and a campaign need it and none of
 * them should have to import a React component to read a clock. `""` is "no
 * hour set", which is a different thing from midnight - `Number("")` is 0 and
 * midnight is 0, so only the empty check tells them apart.
 */

/** "18:30" to minutes past midnight, or null for an empty box. */
export function minutesFromTime(value: string): number | null {
    if (!value) return null;
    const [hours, minutes] = value.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
}

/** Minutes past midnight back to "18:30", or "" when there is no hour. */
export function timeFromMinutes(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) return "";
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
