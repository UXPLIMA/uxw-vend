/**
 * The two URLs both ends of the flow have to agree on, in one place: the
 * callback Steam returns to, and the page that redeems the ticket.
 */

/** Where Steam sends the browser back. Signed by Steam, re-checked on arrival. */
export function steamReturnTo(appUrl: string): string {
    return `${appUrl}/api/v1/steam-auth/callback`;
}

/** The page that trades a ticket for a session. */
export function steamSignInPath(ticket: string): string {
    return `/auth/steam?ticket=${encodeURIComponent(ticket)}`;
}

/** Where the browser lands when the assertion does not check out. */
export function steamFailurePath(reason: string): string {
    return `/auth/login?error=${encodeURIComponent(reason)}`;
}
