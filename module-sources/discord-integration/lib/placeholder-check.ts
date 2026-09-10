/**
 * Which names an operator wrote, and whether this event carries them.
 *
 * `placeholders.ts` decided what happens at send time: a name nobody supplied
 * is left in the message rather than blanked, so a typo shows as `{palyer}`
 * instead of a gap nobody can explain. That is right, and it means an operator
 * finds out in a live channel unless something says so earlier.
 *
 * This is that something. It warns rather than refuses, because leaving the
 * name visible is a decision the module already made on purpose and a brace an
 * operator meant to type is theirs to type. What they should not have is no
 * warning at all.
 *
 * The pattern is the sender's, character for character. A checker reading a
 * different grammar is a screen that warns about names which work and stays
 * quiet about ones that do not, and a warning that is not exactly true is
 * worse than none: the second time it is wrong, nobody reads it again.
 */

/** The same shape `fillPlaceholders` replaces. Kept identical on purpose. */
const NAME = /\{([a-zA-Z0-9_]+)\}/g;

/** Every name the text asks for, once each, in the order they appear. */
export function namesUsed(text: string | null | undefined): string[] {
    if (!text) return [];
    const found: string[] = [];
    for (const match of text.matchAll(NAME)) {
        if (!found.includes(match[1])) found.push(match[1]);
    }
    return found;
}

export interface WrittenEmbed {
    title?: string | null;
    description?: string | null;
    footer?: string | null;
    fields?: { name: string; value: string }[];
}

/**
 * The names this event does not carry, once each, in the order an operator
 * would find them reading down the form.
 */
export function unknownPlaceholders(embed: WrittenEmbed, supplied: readonly string[]): string[] {
    const written = [
        embed.title,
        embed.description,
        embed.footer,
        ...(embed.fields ?? []).flatMap((field) => [field.name, field.value]),
    ];

    const unknown: string[] = [];
    for (const text of written) {
        for (const name of namesUsed(text)) {
            if (supplied.includes(name) || unknown.includes(name)) continue;
            unknown.push(name);
        }
    }
    return unknown;
}
