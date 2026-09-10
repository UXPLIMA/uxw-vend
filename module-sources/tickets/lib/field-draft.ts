/**
 * What an operator is allowed to ask on a department's form.
 *
 * `fields.ts` decided what happens to the answers. This decides what may be
 * asked, and it exists for one refusal in particular.
 *
 * `answersFor` checks a select against its list only when there is a list,
 * which is right: a field that has lost its options should not start rejecting
 * answers on tickets already open. But it means a select an operator created
 * and never filled in accepts anything at all. They have made a dropdown, the
 * form has nothing to drop down, and whatever arrives is stored as though it
 * had been chosen from somewhere. A control that appears to constrain and does
 * not can only be caught before it is saved, which is here.
 *
 * The key is the other half. It is what the form posts and what the answer is
 * filed under, so two questions sharing one is two questions with one answer,
 * and a key that is not a plain name is one nobody can post reliably.
 */

import type { DepartmentField } from "./fields";

export type FieldRefusal =
    | "bad_key"
    | "no_label"
    | "repeated_key"
    | "select_without_options"
    | "repeated_option";

/** What a form may post as a key: a plain name, starting with a letter. */
const KEY = /^[a-z][a-z0-9_]*$/i;

/** The options with the blanks taken out, which is what would be stored. */
export function usableOptions(options: readonly string[]): string[] {
    return options.map((option) => option.trim()).filter((option) => option !== "");
}

/** Null when the whole set may be saved, or the first thing wrong with it. */
export function checkFields(
    fields: readonly DepartmentField[],
): { reason: FieldRefusal; key: string } | null {
    const seen = new Set<string>();

    for (const field of fields) {
        const key = field.key.trim();
        if (key === "" || key.length > 64 || !KEY.test(key)) return { reason: "bad_key", key };
        if (seen.has(key)) return { reason: "repeated_key", key };
        seen.add(key);

        if (field.label.trim() === "") return { reason: "no_label", key };

        if (field.type === "select") {
            const options = usableOptions(field.options);
            if (options.length === 0) return { reason: "select_without_options", key };
            if (new Set(options).size !== options.length) return { reason: "repeated_option", key };
        }
    }

    return null;
}
