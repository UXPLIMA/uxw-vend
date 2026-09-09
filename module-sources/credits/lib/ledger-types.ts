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
