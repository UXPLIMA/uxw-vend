/**
 * Letting an operator style a role's name, in their own CSS.
 *
 * A community wants its founder in gold and its moderators in blue, with a
 * gradient and a glow no colour picker will produce. So they write CSS, and it
 * is rendered into the page beside every name that role wears.
 *
 * `expression`, `url` and `@import` are the three anybody names, and each is
 * real. What that list misses is the attack that needs no function at all.
 *
 * The declarations go inside a rule this site writes - `.role-founder { ... }`
 * - so a closing brace in the middle of what an operator typed ends that rule
 * early and starts one of their own. `} body { }` styles the whole page: an
 * overlay the size of the viewport, painted over the real thing, is a login
 * form that is not ours, and it arrives as CSS, which nobody reads as code.
 * The same goes for `<`, because the block is written into a `<style>` tag and
 * `</style>` ends it.
 *
 * And a blocklist is worth what its spelling is worth. CSS lets an identifier
 * be escaped a character at a time - `\75 rl(` is `url(` - and a comment
 * splits a keyword in two. So the text is folded first and judged after.
 *
 * But only for the words. The characters that end the rule or the tag are
 * judged on what was typed as well, because what is stored is what was typed:
 * anything the folding removes is invisible to the judge and present in what
 * renders. A closing tag inside a comment is the whole of it - an HTML parser
 * does not know what a CSS comment is, so inside a `<style>` element it scans
 * for `</style` and ends the element there, and the script after it is real.
 */

/** Longer than any name style anybody writes by hand. */
const MAX_LENGTH = 2000;

/**
 * Out of the rule, or out of the tag.
 *
 * A brace ends the rule this site wrote and starts one of the operator's own;
 * an angle bracket ends the `<style>` element and what follows is markup.
 * Neither needs a function, and neither is on the list anybody names first.
 */
const BREAKS_OUT = /[{}<>]/;

/**
 * What a browser will read, with the disguises taken off.
 *
 * Comments go first, because they are what splits a keyword. Then CSS escapes
 * become the character they name, and a backslash before anything else is
 * dropped: to a CSS parser `\u` is simply `u`.
 */
function asABrowserReadsIt(css: string): string {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const unescaped = withoutComments.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) =>
        String.fromCodePoint(parseInt(hex, 16)),
    );
    return unescaped.replace(/\\/g, "").toLowerCase();
}

/**
 * Words that fetch something, run something, or have run something in a
 * browser somebody still uses.
 */
const FORBIDDEN = ["url(", "expression(", "behavior:", "-moz-binding", "javascript:", "image-set("];

/** The style to render, or null when it is not one. */
export function safeRoleCss(css: string): string | null {
    const typed = css.trim();
    if (typed === "" || typed.length > MAX_LENGTH) return null;

    // On what was typed, first. The folding is only safe to judge by for
    // things a browser also folds; an HTML parser folds nothing, so a `<`
    // inside a comment still closes the tag it is written into.
    if (BREAKS_OUT.test(typed)) return null;

    const folded = asABrowserReadsIt(typed);

    // And again on the folded form, for the same characters written as an
    // escape: `\3c` is `<`.
    if (BREAKS_OUT.test(folded)) return null;

    // Every at-rule, not only the one that was named: `@import` fetches a
    // stylesheet, and the rest carry a block, which is a brace.
    if (folded.includes("@")) return null;

    for (const word of FORBIDDEN) {
        if (folded.includes(word)) return null;
    }

    // What is stored is what was typed. The folding is for judging it, not for
    // rewriting somebody's stylesheet into a shape they did not write.
    return typed;
}
