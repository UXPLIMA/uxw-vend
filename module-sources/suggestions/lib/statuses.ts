/**
 * What a suggestion's status can be, in one place.
 *
 * Four lists disagreed. The admin dropdown offered six statuses; the schema
 * that validates the request accepted four of them, so choosing "Under Review"
 * or "In Progress" produced a 400 and a failure toast. The public board
 * filtered on `under_review`, `accepted` and `rejected`, which no suggestion
 * could ever hold, so three of its six filter buttons always returned an empty
 * board. And its badge fell back to the first word in the list, so a planned
 * or declined suggestion was labelled "Open" to every visitor who read it.
 *
 * The six are the vocabulary: the manifest already carried a name for each of
 * them in both languages, and the admin who opened the dropdown was offered
 * all six. `canonicalStatus` folds the spellings the old screens used so a row
 * written under one of them still reads correctly.
 */

export const SUGGESTION_STATUSES = [
    "open",
    "underReview",
    "planned",
    "inProgress",
    "completed",
    "declined",
] as const;

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/** The spellings the board's own screens used before this list existed. */
const ALIASES: Record<string, SuggestionStatus> = {
    under_review: "underReview",
    in_progress: "inProgress",
    accepted: "planned",
    rejected: "declined",
};

const BY_SPELLING = new Map<string, SuggestionStatus>([
    ...SUGGESTION_STATUSES.map((s) => [fold(s), s] as const),
    ...Object.entries(ALIASES).map(([alias, s]) => [fold(alias), s] as const),
]);

/** Case and punctuation carry no meaning: `UNDER_REVIEW` is underReview. */
function fold(raw: string): string {
    return raw.trim().toLowerCase().replace(/[^a-z]/g, "");
}

/** The status a value names, or null when it names none of them. */
export function canonicalStatus(raw: string): SuggestionStatus | null {
    return BY_SPELLING.get(fold(raw)) ?? null;
}

/** Every spelling of one status, so a filter finds the rows written as any. */
export function spellingsOf(status: SuggestionStatus): string[] {
    const out = new Set<string>([status]);
    for (const [alias, canonical] of Object.entries(ALIASES)) {
        if (canonical === status) out.add(alias);
    }
    return [...out];
}

/** One look for a status, on the board and in the admin list alike. */
export const STATUS_BADGE_CLASS: Record<SuggestionStatus, string> = {
    open: "bg-primary/10 text-primary",
    underReview: "bg-warning/10 text-warning",
    planned: "bg-accent/10 text-accent",
    inProgress: "bg-primary/10 text-primary",
    completed: "bg-success/10 text-success",
    declined: "bg-destructive/10 text-destructive",
};
