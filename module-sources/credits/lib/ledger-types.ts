/**
 * The name a member reads for a row in their credit history.
 *
 * The ledger stores a machine word for what happened - `admin_grant`,
 * `credit_purchase`, `transfer_in` - and the screen needs a sentence. The rule
 * that turns one into the other lives here rather than inline in the tab,
 * because it is half of a pair: the other half is the catalogue, and the two
 * drifted. Four keys existed, seven kinds of row were written, and a member
 * looking at where their credits came from read `credits.typeAdmin_grant` on
 * a screen whose whole job is explaining a balance.
 */
export function creditTypeKey(type: string): string {
    const word = type.trim();
    if (word === "") return "typeUnknown";
    return `type${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

/**
 * The key the screen should actually ask for.
 *
 * The award door takes a reason from whoever calls it, so a module added next
 * year writes a word this catalogue has never seen - and the gate that holds
 * the two lists together cannot find it, because it is a variable rather than
 * a literal. Without this the member reads `credits.typeForum_post` on the one
 * screen whose whole job is explaining a balance.
 *
 * `known` is the catalogue's own answer to "do you have this", so the fallback
 * is decided where the words are rather than guessed.
 */
export function labelKeyFor(type: string, known: (key: string) => boolean): string {
    const key = creditTypeKey(type);
    return known(key) ? key : "typeUnknown";
}
