import { z } from "zod";

/**
 * The six-digit code from the authenticator app. It used to reach
 * `verifyToken` as whatever JSON carried, and that function hashes what it is
 * given - a non-string was a 500 on an endpoint whose whole job is to answer
 * a wrong code with a 400.
 */
export const verifyTokenSchema = z.object({
    token: z.string().trim().min(1, "Token is required").max(16),
});

/**
 * Disabling 2FA, or minting fresh backup codes. Either the account password
 * or a current TOTP code authorises it, so both are optional here and the
 * route refuses a body carrying neither.
 */
export const twoFactorChallengeSchema = z.object({
    token: z.string().trim().max(16).optional(),
    password: z.string().max(200).optional(),
});
