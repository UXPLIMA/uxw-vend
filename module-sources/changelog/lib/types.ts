/**
 * What a release note can be, in one place.
 *
 * The type reached the row as free text - the admin form was an input with
 * "update, feature, fix, breaking" in its placeholder - and the badge beside
 * it was coloured from a separate `color` field whose default was the same
 * blue for every entry. So a page of releases showed the same blue chip
 * against every one of them, with whatever English word the operator happened
 * to type inside it, on a Turkish page.
 *
 * The type is the meaning, so the colour comes from it rather than from a
 * second field somebody has to remember to change, and the word is a
 * translation key rather than whatever was typed.
 */

export const CHANGELOG_TYPES = [
    "feature",
    "improvement",
    "fix",
    "security",
    "removed",
    "breaking",
] as const;

export type ChangelogType = (typeof CHANGELOG_TYPES)[number];

/** The badge tone each type is drawn in. */
const TONES = {
    feature: "success",
    improvement: "info",
    fix: "neutral",
    security: "warning",
    removed: "neutral",
    breaking: "danger",
} as const;

export function changelogTone(type: string): "neutral" | "success" | "warning" | "danger" | "info" {
    return TONES[type as ChangelogType] ?? "neutral";
}

/**
 * The word for a type. A row written before this vocabulary existed may hold
 * anything at all, so an unknown type is printed as it stands rather than
 * folded into the first word in the list - which is how a "breaking" release
 * would come to be labelled "feature".
 */
export function changelogTypeLabel(t: { (key: string): string; has(key: string): boolean }, type: string): string {
    const key = `type_${type}`;
    return t.has(key) ? t(key) : type;
}
