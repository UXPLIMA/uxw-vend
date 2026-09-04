/**
 * Building an object out of keys that came from a request.
 *
 * Three places do it: the theme customization endpoint, which copies colour,
 * font and settings-group keys out of a PATCH body, and the translation
 * service, which turns dotted keys from the database into a nested message
 * tree. All three checked the key against `__proto__`, `constructor` and
 * `prototype` first, and all three then wrote into a plain `{}` - an object
 * that has a prototype to reach in the first place.
 *
 * The check is the first lock and stays. This is the second: an accumulator
 * made with `Object.create(null)` has no prototype chain, so a key the check
 * ever fails to catch lands as an ordinary own property and nothing further
 * up is touched. `JSON.stringify` and `Object.entries` treat these the same
 * as any other object, which is all either caller does with them.
 */

/** A key that would reach the prototype chain rather than the object. */
export function isUnsafeKey(key: string): boolean {
    return key === "__proto__" || key === "constructor" || key === "prototype";
}

/** A fresh accumulator with no prototype to pollute. */
export function emptyRecord<T = unknown>(): Record<string, T> {
    return Object.create(null) as Record<string, T>;
}
