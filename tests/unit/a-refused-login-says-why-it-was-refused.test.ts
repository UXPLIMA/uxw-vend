/**
 * A refused sign in says what was refused.
 *
 * The login screen decided what to tell a reader by matching on the text of
 * the error Auth.js handed back: `result.error.includes("BANNED")`,
 * `includes("ACCOUNT_LOCKED")`, `includes("2FA_REQUIRED")` and two more.
 * Auth.js never sends any of those. A plain error thrown inside `authorize`
 * is not an `AuthError`, so `@auth/core` wraps it in a `CallbackRouteError`
 * and the browser is handed the wrapper's type name; the message stays on
 * the server. Every one of those five branches was unreachable and every
 * refusal fell through to the last one, which says the password was wrong.
 *
 * So a locked account read as a wrong password for the fifteen minutes of
 * the lockout, a suspended account read as a wrong password, and an account
 * with a second factor could not sign in at all, because the screen never
 * learned it had to ask for the code.
 *
 * Auth.js carries a refusal in the `code` query parameter of a
 * `CredentialsSignin`, which is the one error it passes through untouched.
 * These are the shapes it actually produces.
 */
import { describe, it, expect } from 'vitest';
import { readRefusal } from '@/core/lib/login-refusal';

describe('a refused sign in', () => {
    it('reports a wrong password as a wrong password', () => {
        expect(readRefusal({ error: 'CredentialsSignin', code: 'credentials' }))
            .toEqual({ kind: 'bad-credentials' });
    });

    it('does not blame the password when the account is locked', () => {
        expect(readRefusal({ error: 'CredentialsSignin', code: 'account_locked' }))
            .toEqual({ kind: 'account-locked' });
    });

    it('does not blame the password when the account is suspended', () => {
        expect(readRefusal({ error: 'CredentialsSignin', code: 'banned' }))
            .toEqual({ kind: 'banned' });
    });

    it('is recognisable when a second factor is what is missing', () => {
        expect(readRefusal({ error: 'CredentialsSignin', code: 'two_factor_required' }))
            .toEqual({ kind: 'two-factor-required' });
    });

    it('tells a wrong second factor apart from a wrong password', () => {
        expect(readRefusal({ error: 'CredentialsSignin', code: 'invalid_two_factor' }))
            .toEqual({ kind: 'invalid-two-factor' });
    });

    it('carries the code the challenge module named', () => {
        expect(readRefusal({ error: 'CredentialsSignin', code: 'challenge_failed:captcha_missing' }))
            .toEqual({ kind: 'challenge-failed', code: 'captcha_missing' });
    });

    it('survives a challenge that named no code of its own', () => {
        expect(readRefusal({ error: 'CredentialsSignin', code: 'challenge_failed' }))
            .toEqual({ kind: 'challenge-failed', code: '' });
    });

    it('does not blame the password for a failure inside the server', () => {
        // What `@auth/core` sends when anything at all throws in authorize.
        expect(readRefusal({ error: 'CallbackRouteError' })).toEqual({ kind: 'unknown' });
    });

    it('does not blame the password for a code this build has never heard of', () => {
        expect(readRefusal({ error: 'CredentialsSignin', code: 'something_new' }))
            .toEqual({ kind: 'unknown' });
    });

    it('treats a missing error as no refusal at all', () => {
        expect(readRefusal({})).toEqual({ kind: 'unknown' });
    });
});
