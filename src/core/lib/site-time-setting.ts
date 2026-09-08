/**
 * The zone the operator set, read from `Setting`.
 *
 * Its own file so `site-time.ts` stays pure: the helpers there interpret a
 * clock and are safe in a browser bundle, while this one reaches the
 * database and is not.
 */

import { prisma } from "./db";
import { DEFAULT_TIME_ZONE, TIME_ZONE_SETTING, isValidTimeZone } from "./site-time";

export async function siteTimeZone(): Promise<string> {
    try {
        const row = await prisma.setting.findUnique({ where: { key: TIME_ZONE_SETTING } });
        const value = typeof row?.value === "string" ? row.value : null;
        return value && isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
    } catch {
        // A shop whose database blinked keeps the clock it had rather than
        // refusing to price anything.
        return DEFAULT_TIME_ZONE;
    }
}
