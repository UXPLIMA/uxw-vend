/**
 * A read that did not come back is not an answer.
 *
 * `fetch(...).then((r) => r.json())` resolves for a 500 as happily as for a
 * 200: the error body parses, `data.settings` is undefined, and the screen
 * renders its defaults as though that were the saved state. On a list that
 * reads as "you have no orders". On a settings form it is worse, because the
 * next thing the operator does is press Save, and the defaults go over the
 * settings the form never managed to read.
 *
 * `readJson` is the missing half of `writeError`: it turns a failed response
 * into a rejection, so the `.catch` a screen already has is the branch that
 * actually runs.
 */

export class ReadFailed extends Error {
    constructor(readonly status: number) {
        super(`read failed with ${status}`);
        this.name = "ReadFailed";
    }
}

export async function readJson<T = unknown>(response: Response): Promise<T> {
    if (!response.ok) throw new ReadFailed(response.status);
    return (await response.json()) as T;
}
