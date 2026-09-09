/**
 * The two addresses on a card, and why neither is trusted.
 *
 * A card is a picture, a heading, a line of text and somewhere to go. An
 * operator types all four, and two of them are handed to the browser as
 * addresses - which brings two spellings a path never had to worry about.
 *
 * `javascript:` in a link is script execution on click, in the reader's
 * session, on a page they trust. It is the oldest one there is and it still
 * works, because a href is not a URL until a browser decides it is. `data:` in
 * an image is a document rendered without fetching anything, which is how an
 * SVG becomes a script.
 *
 * So each is either a path on this site or a whole https address, and anything
 * else is dropped rather than escaped. A card that renders without its link is
 * a card; a card that renders with a link nobody can explain is a trap.
 */

/**
 * A scheme, as a browser finds one.
 *
 * Whitespace inside a scheme is ignored by a browser and not by a naive
 * check, which is what `java\tscript:` is for, so it is stripped before the
 * question is asked rather than after.
 */
function hasScheme(value: string): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(value.replace(/[\s\u0000-\u001f]/g, ""));
}

/** A path of ours: one leading slash, and nothing that folds into two. */
function ourPath(value: string): string | null {
    const folded = value.replace(/\\/g, "/");
    if (!folded.startsWith("/")) return null;
    // `//evil.example` reads as a path to whoever typed it and as another
    // site to a browser.
    if (folded.startsWith("//")) return null;
    if (/[\u0000-\u001f\u007f]/.test(folded)) return null;
    return folded;
}

/** Somewhere else, said out loud and encrypted. */
function elsewhere(value: string): string | null {
    return /^https:\/\/[^\s/]+/i.test(value) ? value : null;
}

/** Where a card sends a reader, or null for a card that does not. */
export function cardLink(href: string | null | undefined): string | null {
    const value = (href ?? "").trim();
    if (value === "") return null;
    if (hasScheme(value)) return elsewhere(value);
    return ourPath(value);
}

/**
 * The picture on a card, or null for a card without one.
 *
 * The same rule as the link. An image served without encryption is blocked by
 * the browser on an encrypted page anyway, so allowing it would only produce a
 * broken card.
 */
export function cardImage(src: string | null | undefined): string | null {
    return cardLink(src);
}
