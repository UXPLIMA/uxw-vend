/**
 * Comparing a secret a caller sent against one the server holds.
 *
 * `===` on two strings stops at the first byte that differs, so a value whose
 * first character is wrong is rejected measurably sooner than one that is
 * wrong only at the end. Everywhere else this codebase already avoids that:
 * a webhook signature goes through `crypto.timingSafeEqual`.
 *
 * Written by hand rather than reaching for that builtin because `csrf.ts`
 * calls this and `csrf.ts` is reached from the proxy, which is not a place to
 * depend on a Node builtin being there.
 */

/**
 * Whether `provided` is the same secret as `expected`, read to the end either
 * way.
 *
 * An empty `expected` is never a match: a server that holds no secret must
 * not accept every caller, which is what a plain comparison of two empty
 * strings would have done.
 */
export function secretsMatch(provided: string | null | undefined, expected: string): boolean {
    if (typeof provided !== "string" || expected.length === 0) return false;

    // The loop covers the longer of the two, and the lengths themselves are
    // folded into the same accumulator, so a wrong length is not a shortcut.
    const span = Math.max(provided.length, expected.length);
    let difference = provided.length ^ expected.length;
    for (let i = 0; i < span; i++) {
        difference |= (provided.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
    }
    return difference === 0;
}
