/**
 * A refusal, in the words the operator needs.
 *
 * Every endpoint of this service answers a failure the same way: an `errors`
 * list, each entry carrying a `title` and a `detail`. The `detail` is the
 * sentence somebody can act on - which field is wrong, what already exists -
 * and the module was putting the first 300 characters of the raw body into
 * the invoice's `reason` instead.
 *
 * It matters more here than in most places. A refused invoice is found after
 * the money moved, by somebody who has to fix the sale and try again, and a
 * slice of JSON with the braces still on tells them nothing about where to
 * look.
 *
 * The status stays in the message when the body is not that shape - a gateway
 * error page, an empty body - because then the number is all there is.
 */
const LIMIT = 300;

interface ServiceError {
    title?: unknown;
    detail?: unknown;
}

export function refusalMessage(status: number, body: string): string {
    const said = sentences(body);
    if (said.length === 0) {
        return `The accounting service refused the request (${status})`;
    }
    const joined = said.join("; ");
    const trimmed = joined.length > LIMIT ? `${joined.slice(0, LIMIT)}…` : joined;
    return `The accounting service refused the request (${status}): ${trimmed}`;
}

function sentences(body: string): string[] {
    if (!body.trim()) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return [];
    }

    const errors = (parsed as { errors?: unknown })?.errors;
    const list = Array.isArray(errors) ? errors : errors ? [errors] : [];
    return list
        .map((entry) => {
            const { detail, title } = (entry ?? {}) as ServiceError;
            if (typeof detail === "string" && detail.trim() !== "") return detail.trim();
            if (typeof title === "string" && title.trim() !== "") return title.trim();
            return "";
        })
        .filter((sentence) => sentence !== "");
}
