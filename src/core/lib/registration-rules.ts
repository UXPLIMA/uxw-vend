/**
 * Who may take an account, and the one rule both controls obey.
 *
 * The password minimum in `security-settings.ts` set the precedent and wrote
 * down the reasoning: an admin may require longer passwords than the built-in
 * policy, never shorter, because a control that could silently weaken every
 * password check is worse than no control. A username rule is the same shape.
 *
 * So the rule is a choice between named ones rather than a pattern an operator
 * types. Two reasons, and the second is the sharper one. A hand-written
 * character class is one paste away from admitting a lookalike - `аdmin` with
 * a Cyrillic first letter is not `admin`, and on a site where the moderator
 * list is read by eye that is the whole attack. And a hand-written regex on
 * the registration route is a denial of service waiting for a name built to
 * make it backtrack. Every rule here is a fixed class that narrows what core
 * already allowed, and the gate beside this file proves none of them widens
 * it.
 *
 * The caps are the other control: a ceiling on new accounts, per day or in
 * total. Zero is off, because "no cap" and "a cap of nothing" are opposite
 * instructions and an empty field means the first.
 */

import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/core/lib/constants";

export const USERNAME_RULES = ["default", "letters_numbers", "lowercase"] as const;
export type UsernameRule = (typeof USERNAME_RULES)[number];

/** What core accepted before there was a setting. */
export const DEFAULT_USERNAME_RULE: UsernameRule = "default";

/**
 * Each is a subset of the one above it, which is what makes the "cannot widen"
 * gate provable rather than a promise. Anchored and without a quantifier that
 * can nest, so none of them can be made to backtrack.
 */
const CHARSET: Record<UsernameRule, RegExp> = {
    default: /^[a-zA-Z0-9_]+$/,
    letters_numbers: /^[a-zA-Z0-9]+$/,
    lowercase: /^[a-z0-9]+$/,
};

export function isUsernameRule(value: unknown): value is UsernameRule {
    return typeof value === "string" && (USERNAME_RULES as readonly string[]).includes(value);
}

export type UsernameRefusal = "too_short" | "too_long" | "charset";

export function checkUsername(
    name: string,
    rule: UsernameRule,
    minLength: number,
): { ok: true } | { ok: false; reason: UsernameRefusal } {
    // The operator's minimum may raise core's and never lower it, so a stored
    // row holding 1 is read as the built-in 3.
    const floor = Math.max(USERNAME_MIN_LENGTH, Number.isFinite(minLength) ? Math.floor(minLength) : 0);

    if (name.length < floor) return { ok: false, reason: "too_short" };
    if (name.length > USERNAME_MAX_LENGTH) return { ok: false, reason: "too_long" };
    if (!(CHARSET[rule] ?? CHARSET.default).test(name)) return { ok: false, reason: "charset" };
    return { ok: true };
}

export interface RegistrationCaps {
    /** New accounts allowed today. Zero is no cap. */
    daily: number;
    /** Accounts the site is meant to hold. Zero is no cap. */
    total: number;
}

export interface RegistrationCounts {
    today: number;
    total: number;
}

export type CapRefusal = "daily_cap" | "total_cap";

function cap(value: number): number | null {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.floor(value);
}

/**
 * Null when the registration may proceed.
 *
 * The daily cap is reported first: a site that will take more accounts
 * tomorrow should say so rather than say it is full for good.
 */
export function registrationRefusal(
    caps: RegistrationCaps,
    counts: RegistrationCounts,
): CapRefusal | null {
    const daily = cap(caps.daily);
    if (daily !== null && counts.today >= daily) return "daily_cap";
    const total = cap(caps.total);
    if (total !== null && counts.total >= total) return "total_cap";
    return null;
}
