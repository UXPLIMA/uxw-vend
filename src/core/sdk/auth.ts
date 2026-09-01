/**
 * uxwVend module SDK — session access.
 *
 * Its own entry point because importing it pulls the whole Auth.js
 * configuration (providers, adapter, callbacks). A module file that only needs
 * `prisma` should not pay for that.
 */
export { auth } from "@/core/lib/auth";
