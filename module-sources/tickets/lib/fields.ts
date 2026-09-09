/**
 * Extra questions on a support form, and what happens to the answers later.
 *
 * A billing department wants an order number, a bug report wants a version, a
 * ban appeal wants an in-game name. An operator adds those per department, and
 * everything interesting happens after they do.
 *
 * The answers outlive the questions. An operator renames a field or deletes it
 * once a season ends, and every ticket ever opened with it is still in the
 * queue being read. Storing the key alone and looking the label up when it is
 * shown loses those tickets their questions: an agent reads a value with
 * nothing above it, or nothing at all. So the label is written down beside the
 * answer, as it was when it was asked.
 *
 * The other half is what a request may store. A form posts keys and a request
 * is not a form: an answer to a question this department does not ask is
 * somebody writing into a ticket, and it is dropped.
 */

export interface DepartmentField {
    key: string;
    label: string;
    /** text | select. Anything else is treated as text. */
    type: string;
    required: boolean;
    /** For a select. The list is the question. */
    options: string[];
}

/** One answer, kept with the question that produced it. */
export interface StoredAnswer {
    key: string;
    label: string;
    value: string;
}

export type AnswersResult =
    | { answers: StoredAnswer[] }
    | { missing: string[] }
    | { notOnTheList: string };

/** What to store for this ticket, or why it cannot be opened yet. */
export function answersFor(
    fields: DepartmentField[],
    given: Record<string, unknown>,
): AnswersResult {
    const said = (key: string): string => {
        const value = given[key];
        return typeof value === "string" ? value.trim() : "";
    };

    // All of them at once: one at a time is a form somebody submits four
    // times to find out what it wanted.
    const missing = fields.filter((field) => field.required && said(field.key) === "").map((f) => f.key);
    if (missing.length > 0) return { missing };

    const answers: StoredAnswer[] = [];
    for (const field of fields) {
        const value = said(field.key);
        // Not asked and left blank are different things on a ticket, so an
        // optional question nobody answered stores nothing at all.
        if (value === "") continue;

        if (field.type === "select" && field.options.length > 0 && !field.options.includes(value)) {
            return { notOnTheList: field.key };
        }

        answers.push({ key: field.key, label: field.label, value });
    }

    return { answers };
}
