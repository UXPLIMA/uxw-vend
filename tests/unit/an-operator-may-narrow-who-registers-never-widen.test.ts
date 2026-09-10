/**
 * The two controls an operator has over who gets an account, and the rule both
 * of them obey.
 *
 * The password minimum in `security-settings.ts` set the precedent and wrote
 * down why: an admin may require longer passwords than the built-in policy,
 * never shorter, because a control that could silently weaken every password
 * check is worse than no control. The same reasoning applies to a username
 * rule. A site that lets an operator hand-write the pattern is a site where
 * one bad character class opens `admin` up to a lookalike with a Cyrillic `a`,
 * or where a badly written regex hangs the registration route on a crafted
 * name. So the choice is between named rules that each narrow what core
 * already allows, and the test that matters is that none of them widens it.
 *
 * The caps are the other control: a ceiling on new accounts, per day or in
 * total, for a site being flooded or one that is meant to stay small. Zero is
 * off, because "no cap" and "a cap of nothing" are opposite instructions and a
 * blank field means the first one. The daily cap is reported before the total
 * one: a site that will accept more accounts tomorrow should say so rather
 * than say it is full.
 */
import { describe, it, expect } from "vitest";
import {
    DEFAULT_USERNAME_RULE,
    USERNAME_RULES,
    checkUsername,
    isUsernameRule,
    registrationRefusal,
} from "@/core/lib/registration-rules";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/core/lib/constants";

const MIN = USERNAME_MIN_LENGTH;

describe("the rules on offer", () => {
    it("starts where core already stood", () => {
        expect(DEFAULT_USERNAME_RULE).toBe("default");
        expect(USERNAME_RULES[0]).toBe("default");
    });

    it("refuses a rule that is not one of them", () => {
        expect(isUsernameRule("default")).toBe(true);
        expect(isUsernameRule("anything")).toBe(false);
        expect(isUsernameRule(undefined)).toBe(false);
    });
});

describe("what the default rule accepts", () => {
    it("is what core accepted before there was a setting", () => {
        expect(checkUsername("valid_name9", "default", MIN).ok).toBe(true);
        expect(checkUsername("Mixed_Case", "default", MIN).ok).toBe(true);
    });

    it("still refuses a name outside letters, numbers and underscore", () => {
        expect(checkUsername("has space", "default", MIN)).toEqual({ ok: false, reason: "charset" });
        expect(checkUsername("has-dash", "default", MIN)).toEqual({ ok: false, reason: "charset" });
        expect(checkUsername("аdmin", "default", MIN)).toEqual({ ok: false, reason: "charset" });
    });

    it("still refuses a name that is too short or too long", () => {
        expect(checkUsername("a".repeat(MIN - 1), "default", MIN).ok).toBe(false);
        expect(checkUsername("a".repeat(USERNAME_MAX_LENGTH + 1), "default", MIN)).toEqual({
            ok: false,
            reason: "too_long",
        });
    });
});

describe("no rule an operator picks widens what core allows", () => {
    const names = [
        "abc", "ABC", "abc123", "a_b_c", "___", "999",
        "has space", "has-dash", "has.dot", "a", "аdmin", "emoji\u{1F600}",
        "a".repeat(USERNAME_MAX_LENGTH), "a".repeat(USERNAME_MAX_LENGTH + 1),
    ];

    for (const rule of USERNAME_RULES) {
        it(`accepts nothing under "${rule}" that the default refuses`, () => {
            for (const name of names) {
                if (checkUsername(name, rule, MIN).ok) {
                    expect(
                        checkUsername(name, "default", MIN).ok,
                        `"${name}" passed ${rule} and failed default`,
                    ).toBe(true);
                }
            }
        });
    }

    it("cannot be told to allow a shorter name than core does", () => {
        expect(checkUsername("ab", "default", 1).ok).toBe(false);
        expect(checkUsername("a".repeat(MIN), "default", 1).ok).toBe(true);
    });

    it("can be told to require a longer one", () => {
        expect(checkUsername("abcde", "default", 8)).toEqual({ ok: false, reason: "too_short" });
        expect(checkUsername("abcdefgh", "default", 8).ok).toBe(true);
    });
});

describe("the narrower rules", () => {
    it("drops the underscore when the operator asks for letters and numbers", () => {
        expect(checkUsername("plain9", "letters_numbers", MIN).ok).toBe(true);
        expect(checkUsername("with_underscore", "letters_numbers", MIN)).toEqual({
            ok: false,
            reason: "charset",
        });
    });

    it("drops capitals too when the operator asks for lowercase", () => {
        expect(checkUsername("plain9", "lowercase", MIN).ok).toBe(true);
        expect(checkUsername("Plain9", "lowercase", MIN)).toEqual({ ok: false, reason: "charset" });
    });
});

describe("the caps on new accounts", () => {
    const off = { daily: 0, total: 0 };

    it("lets everybody in when both are zero", () => {
        expect(registrationRefusal(off, { today: 9999, total: 9999 })).toBeNull();
    });

    it("refuses once as many have signed up today as the cap allows", () => {
        expect(registrationRefusal({ daily: 5, total: 0 }, { today: 4, total: 100 })).toBeNull();
        expect(registrationRefusal({ daily: 5, total: 0 }, { today: 5, total: 100 })).toBe("daily_cap");
    });

    it("refuses once the site holds as many accounts as it is meant to", () => {
        expect(registrationRefusal({ daily: 0, total: 50 }, { today: 1, total: 49 })).toBeNull();
        expect(registrationRefusal({ daily: 0, total: 50 }, { today: 1, total: 50 })).toBe("total_cap");
    });

    it("says the daily one first, because tomorrow is a different answer", () => {
        expect(registrationRefusal({ daily: 5, total: 50 }, { today: 5, total: 50 })).toBe("daily_cap");
    });

    it("ignores a cap that is not a usable number", () => {
        expect(registrationRefusal({ daily: -1, total: Number.NaN }, { today: 10, total: 10 })).toBeNull();
    });
});
