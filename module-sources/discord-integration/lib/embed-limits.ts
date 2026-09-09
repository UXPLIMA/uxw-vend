/**
 * What the service will take, checked before it is sent.
 *
 * The limits are per part and also across all of them. A title of 256, a
 * description of 4096 and twenty-five fields are each fine on their own and
 * add up to a message that is refused: the total across everything with words
 * in it is six thousand characters, and going over rejects the whole message
 * rather than trimming it.
 *
 * That total is the one an operator cannot find. Every box on their screen is
 * inside its own limit, the preview looks right, and the message never
 * arrives - the service answers a bare 400. So it is checked here, and the
 * answer names which limit and by how much.
 */

/** The service's own numbers. Not ours to choose, only to respect. */
export const LIMITS = {
    title: 256,
    description: 4096,
    fields: 25,
    fieldName: 256,
    fieldValue: 1024,
    footer: 2048,
    author: 256,
    /** Across the title, the description, every field, the footer and the author. */
    total: 6000,
} as const;

export interface BuiltEmbed {
    title?: string;
    description?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    footer?: { text: string };
    author?: { name: string };
}

export interface EmbedRefusal {
    /** Which limit, in the words of the box the operator is looking at. */
    over: string;
    limit: number;
    by: number;
}

const measure = (text: string | undefined): number => (text ?? "").length;

/** Why this embed will be refused, or null when it will not. */
export function embedRefusal(embed: BuiltEmbed): EmbedRefusal | null {
    const over = (name: string, length: number, limit: number): EmbedRefusal | null =>
        length > limit ? { over: name, limit, by: length - limit } : null;

    // The parts first. Both a part and the total can be over at once, and the
    // one an operator can point at is the one worth saying.
    const title = over("title", measure(embed.title), LIMITS.title);
    if (title) return title;

    const description = over("description", measure(embed.description), LIMITS.description);
    if (description) return description;

    const author = over("author", measure(embed.author?.name), LIMITS.author);
    if (author) return author;

    const footer = over("footer", measure(embed.footer?.text), LIMITS.footer);
    if (footer) return footer;

    const fields = embed.fields ?? [];
    const tooMany = over("fields", fields.length, LIMITS.fields);
    if (tooMany) return tooMany;

    for (const [index, field] of fields.entries()) {
        // By position: a field has no name to give until it has a name, and
        // the one that is too long is often the one with no name yet.
        const name = over(`field ${index + 1} name`, measure(field.name), LIMITS.fieldName);
        if (name) return name;
        const value = over(`field ${index + 1} value`, measure(field.value), LIMITS.fieldValue);
        if (value) return value;
    }

    const everything =
        measure(embed.title) +
        measure(embed.description) +
        measure(embed.author?.name) +
        measure(embed.footer?.text) +
        fields.reduce((sum, field) => sum + measure(field.name) + measure(field.value), 0);

    return over("everything", everything, LIMITS.total);
}
