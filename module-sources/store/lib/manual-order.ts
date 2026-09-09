/**
 * An order an operator types in, for something that happened elsewhere.
 *
 * The cases the checkout cannot reach: money that arrived by bank transfer, a
 * replacement for an order that went wrong, a sale agreed in a message.
 * Without it the only ways to make somebody whole are a coupon for the full
 * price or an edit to the database.
 *
 * The total is worked out from the lines rather than taken from the form.
 * That form is an admin screen, but it is still a client, and a total that
 * arrives from a client is a total somebody can choose - an order claiming to
 * be worth nothing goes into the same reports as one claiming a thousand.
 */

export interface ManualLine {
    unitAmount: number;
    quantity: number;
}

const cents = (value: number) => Math.round(value * 100) / 100;

/** What went wrong with one row, for the route to put into its own words. */
export interface BadLine {
    /** One-based, so it matches the row the operator is looking at. */
    line: number;
    reason: "not-a-number" | "negative";
}

/**
 * What the lines come to, or which row is wrong.
 *
 * Answers rather than throws. A thrown message travels straight into an HTTP
 * response by the shortest path, and a route that repeats what a helper said
 * to itself is a route whose words are somebody else's - untranslatable, and
 * one refactor away from leaking something internal. The row number is the
 * part the operator needs; the sentence belongs to whoever is speaking.
 *
 * A negative line is a discount nobody granted and a line that is not a number
 * is a form that did not validate. Zero is allowed and is exactly what a
 * replacement is worth.
 */
export function manualOrderTotal(lines: ManualLine[]): { total: number } | { bad: BadLine } {
    let total = 0;
    for (const [index, line] of lines.entries()) {
        const { unitAmount, quantity } = line;
        if (!Number.isFinite(unitAmount) || !Number.isFinite(quantity)) {
            return { bad: { line: index + 1, reason: "not-a-number" } };
        }
        if (unitAmount < 0 || quantity < 1) {
            return { bad: { line: index + 1, reason: "negative" } };
        }
        total += unitAmount * quantity;
    }
    return { total: cents(total) };
}
