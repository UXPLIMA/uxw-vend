/**
 * Putting the event into the message an operator wrote.
 *
 * They write "{player} bought {product}" and the values arrive with the event.
 * Two decisions, and one of them is a hole if it goes the other way.
 *
 * The values come from members: a username, a ticket subject, a product name,
 * all typed by somebody who is not the operator. Substituting and then
 * scanning the result again lets a member called `{webhookUrl}` pull whatever
 * that names into a message. So the pass is single - what a value contains is
 * text, whatever it looks like.
 *
 * The other is a name nobody supplied. Blanking it hides a typo: the operator
 * reads a sentence with a gap and no idea which word they misspelled. Leaving
 * it shows them `{palyer}` in the test send, which is what a test send is for.
 */

/** One pass, left to right, reading nothing it has written. */
export function fillPlaceholders(template: string, values: Record<string, unknown>): string {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, name: string) => {
        const value = values[name];
        // Nothing supplied. The name stays, so a typo is visible rather than
        // a gap nobody can explain.
        if (value === undefined || value === null) return whole;
        return String(value);
    });
}
