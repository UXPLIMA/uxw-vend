/**
 * Turning two vote counters into an answer an operator can act on.
 *
 * The panel used to print "40 / 3" and leave the division to the reader, over
 * two hundred rows. The question behind that column is always the same one:
 * which pages are helping the people who arrive on them, and which are not?
 *
 * A plain share cannot order that list, because it sorts by luck in both
 * directions. One reader clicking yes is 100% and would outrank an article two
 * hundred people voted on at 96%. One reader clicking no is 0% and would head
 * the list of things to rewrite, above an article two hundred people actually
 * found useless.
 *
 * So the ordering starts every article at "nobody knows" and lets each vote
 * pull it away from the middle - a prior of a couple of votes each way, which
 * a handful of real ones barely moves and a few hundred wash out entirely.
 * An article nobody has voted on sits in the middle, out of the way of both
 * ends of the sort, which is exactly where an unknown belongs. The plain share
 * is kept beside it, because that is the number the operator wants to read.
 *
 * The verdict is a third thing and refuses to exist below a handful of votes.
 * "Nobody knows yet" is a true answer and it is the one two votes deserve.
 */

/** Below this, an article gets no verdict at all. */
export const MIN_VOTES_FOR_A_VERDICT = 5;

/**
 * The votes every article is assumed to start with, half of them each way.
 * Two is enough to stop a single click reading as a verdict and small enough
 * that twenty real votes have almost entirely replaced it.
 */
const PRIOR_EACH_WAY = 2;

/** Where a settled score stops being good news and starts being bad. */
const HELPING_AT = 0.6;
const FAILING_AT = 0.4;

export type Verdict = "unrated" | "helping" | "mixed" | "failing";

export interface Helpfulness {
    votes: number;
    /** The plain share of readers helped, or null when nobody has voted. */
    ratio: number | null;
    /** The share with the prior still in it. Orders the list, both ways. */
    score: number;
    verdict: Verdict;
}

/** A counter is a database column, so it arrives as whatever is in the row. */
function count(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.floor(value);
}

export function helpfulness(helpful: number, notHelpful: number): Helpfulness {
    const yes = count(helpful);
    const no = count(notHelpful);
    const votes = yes + no;

    const score = (yes + PRIOR_EACH_WAY) / (votes + 2 * PRIOR_EACH_WAY);
    const ratio = votes === 0 ? null : yes / votes;

    if (votes < MIN_VOTES_FOR_A_VERDICT) return { votes, ratio, score, verdict: "unrated" };
    if (score >= HELPING_AT) return { votes, ratio, score, verdict: "helping" };
    if (score < FAILING_AT) return { votes, ratio, score, verdict: "failing" };
    return { votes, ratio, score, verdict: "mixed" };
}
