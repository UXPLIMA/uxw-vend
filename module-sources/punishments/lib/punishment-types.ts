/**
 * One word for one punishment.
 *
 * Three lists of punishment types had drifted apart inside one module. The
 * admin form offered ban, mute, kick, warning, tempBan and tempMute, and
 * stored exactly what it offered. The public page filtered on ban, mute, kick
 * and warn, and looked its icons, its colours and its labels up under those
 * same four - so the Warning filter matched nothing an admin had ever
 * created, there was no way to filter for either temporary type, and a
 * warning, a tempBan and a tempMute each rendered as the raw column value
 * beside a default icon, with the translation for all three sitting unused in
 * this module's own manifest.
 *
 * The list lives here now and both screens read it. `canonicalType` also folds
 * the spellings a game server plugin is likely to post, because this module's
 * create endpoint takes an API key as well as an admin session and the type it
 * receives is whatever the plugin's own config calls the thing.
 */

export const PUNISHMENT_TYPES = ["ban", "tempBan", "mute", "tempMute", "kick", "warning"] as const;

export type PunishmentType = (typeof PUNISHMENT_TYPES)[number];

/** Other spellings for the same six, folded on the way in and on the way out. */
const ALIASES: Record<string, PunishmentType> = {
    warn: "warning",
    tempbanned: "tempBan",
    tempmuted: "tempMute",
    banned: "ban",
    muted: "mute",
    kicked: "kick",
};

/** Every spelling, reduced to letters, to the type it names. */
const BY_SPELLING = new Map<string, PunishmentType>([
    ...PUNISHMENT_TYPES.map((t) => [fold(t), t] as const),
    ...Object.entries(ALIASES).map(([alias, t]) => [fold(alias), t] as const),
]);

/** Case and punctuation carry no meaning here: `TEMP_BAN` is a tempBan. */
function fold(raw: string): string {
    return raw.trim().toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * The type a value names, or null when it names none of them - in which case
 * a screen prints the value as it stands rather than a message key that this
 * module never declared. Each type is its own message key.
 */
export function canonicalType(raw: string): PunishmentType | null {
    return BY_SPELLING.get(fold(raw)) ?? null;
}

/**
 * Every spelling of one type, so filtering for it finds the rows a plugin
 * wrote in its own words before this list existed.
 */
export function spellingsOf(type: PunishmentType): string[] {
    const out = new Set<string>([type, type.toLowerCase()]);
    for (const [alias, canonical] of Object.entries(ALIASES)) {
        if (canonical === type) out.add(alias);
    }
    return [...out];
}
