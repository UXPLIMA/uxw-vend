/**
 * The names of the password hashing algorithms, and nothing that hashes.
 *
 * Split from `password-hash.ts` because the settings screen has to list them
 * and that screen runs in a browser. `password-hash.ts` imports bcryptjs, and
 * one import of this list from a client component put the whole library in a
 * browser bundle - which `client-bundle-safety.test.ts` caught in a second
 * rather than three minutes into a build.
 *
 * The list is short on purpose: bcrypt, which every account on every existing
 * install is already hashed with, and scrypt, which is memory-hard and comes
 * with Node rather than with a dependency. Nothing weaker belongs on it,
 * because a dropdown is an endorsement.
 */

export const HASH_ALGORITHMS = ["bcrypt", "scrypt"] as const;
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

/** What every account on every existing install is already hashed with. */
export const DEFAULT_ALGORITHM: HashAlgorithm = "bcrypt";

export function isHashAlgorithm(value: unknown): value is HashAlgorithm {
    return typeof value === "string" && (HASH_ALGORITHMS as readonly string[]).includes(value);
}
