import { CredentialsSignin } from "next-auth";

/**
 * A refused sign in, thrown so the reason survives the trip to the browser.
 *
 * `@auth/core` rethrows an `AuthError` as it is and copies the `code` of a
 * `CredentialsSignin` into the redirect URL. Anything else it wraps in a
 * `CallbackRouteError`, and the message stays in the server log. `authorize`
 * used to throw plain errors, so a locked account, a suspended account and an
 * account waiting on its second factor all arrived at the sign in screen as
 * the same nameless failure and were all reported as a wrong password.
 *
 * The codes live in `login-refusal.ts`, which the screen reads them with and
 * which imports nothing, because it is read in a browser bundle too.
 */
export class SignInRefusal extends CredentialsSignin {
    constructor(code: string) {
        super(code);
        this.code = code;
    }
}
