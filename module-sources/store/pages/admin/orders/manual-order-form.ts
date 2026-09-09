/**
 * What the hand-entered order form holds, and what it sends.
 *
 * Every box on this screen is a string, and `Number("")` is 0. On a price box
 * that is the difference between a row the operator has not finished and a
 * product they gave away: both reach the endpoint as zero, and the endpoint
 * cannot tell them apart. A replacement really is worth zero and an operator
 * really does type it, so the endpoint cannot reject zero either.
 *
 * So a blank price is answered here, by row number, and the screen asks. A
 * blank quantity is not the same question: one is the only reading of "I
 * picked this product", so it fills itself in.
 *
 * A row where no product was chosen is a spare row the form drew, not an
 * omission. It is dropped without comment.
 */

export interface ManualLineValue {
    productId: string;
    /** Strings, because the boxes are. */
    quantity: string;
    unitAmount: string;
}

export interface ManualOrderFormValue {
    userId: string;
    currency: string;
    notes: string;
    markPaid: boolean;
    lines: ManualLineValue[];
}

export const EMPTY_MANUAL_ORDER: ManualOrderFormValue = {
    userId: "",
    currency: "",
    notes: "",
    markPaid: false,
    lines: [],
};

export interface ManualOrderPayload {
    userId: string;
    currency: string;
    notes?: string;
    markPaid: boolean;
    lines: { productId: string; quantity: number; unitAmount: number }[];
}

/**
 * What the form sends, or which question the screen has to ask first.
 *
 * The refusals are in the order an operator can act on them: who it is for,
 * then whether there is anything in it, then the row that is not finished.
 */
export function manualOrderPayload(
    value: ManualOrderFormValue,
):
    | { payload: ManualOrderPayload }
    | { noBuyer: true }
    | { empty: true }
    | { blankPrice: number } {
    if (value.userId.trim() === "") return { noBuyer: true };

    // The row number an operator sees counts every row on screen, including
    // the spare ones, so it is taken before any are dropped.
    const chosen = value.lines
        .map((line, index) => ({ line, row: index + 1 }))
        .filter(({ line }) => line.productId.trim() !== "");
    if (chosen.length === 0) return { empty: true };

    const lines: ManualOrderPayload["lines"] = [];
    for (const { line, row } of chosen) {
        if (line.unitAmount.trim() === "") return { blankPrice: row };
        const unitAmount = Number(line.unitAmount);
        if (!Number.isFinite(unitAmount)) return { blankPrice: row };
        // Untouched means one of it. Anything typed is taken as typed, and
        // the endpoint says so if it is not a whole number of things.
        const quantity = line.quantity.trim() === "" ? 1 : Number(line.quantity);
        lines.push({ productId: line.productId, quantity, unitAmount });
    }

    return {
        payload: {
            userId: value.userId,
            currency: value.currency,
            notes: value.notes.trim() || undefined,
            markPaid: value.markPaid,
            lines,
        },
    };
}
