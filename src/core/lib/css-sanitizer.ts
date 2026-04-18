/**
 * Sanitize admin-supplied custom CSS so it can safely be rendered into a
 * `<style>` tag that every visitor loads. Admin is trusted, but the admin
 * account can be compromised and custom CSS is persisted in the public
 * settings blob — so we still have to defend downstream visitors from
 * XSS / clickjacking injected through this field.
 *
 * The aggressive rule: CSS has no legitimate need for `<` or `>` in the
 * payload, so we strip them outright. That closes the classic
 * `</style><script>alert()</script>` break-out vector regardless of how
 * the markup is later rendered. Additional allowlist cleanups cover
 * legacy IE/Firefox vectors (expression, behavior, -moz-binding) and
 * cross-origin fetches (`@import`, `url(javascript:...)`).
 *
 * Apply this BOTH server-side (when the setting is saved) and
 * client-side (before injection) as defense-in-depth.
 */
export function sanitizeCustomCss(input: unknown): string {
    if (typeof input !== "string") return "";

    return input
        // Angle brackets have no legitimate CSS use and are the primary
        // break-out vector — drop them entirely.
        .replace(/[<>]/g, "")
        // Block `javascript:` URIs in any context (url(), cursor, etc.)
        .replace(/javascript\s*:/gi, "")
        // Legacy IE/Firefox script gadgets.
        .replace(/expression\s*\(/gi, "")
        .replace(/behavior\s*:/gi, "")
        .replace(/-moz-binding\s*:/gi, "")
        // Cross-origin CSS fetch (attackers can host their own CSS).
        .replace(/@import\b/gi, "")
        .replace(/@charset\b/gi, "")
        // url() with javascript: after the opening paren and quotes.
        .replace(/url\s*\(\s*['"]?\s*javascript/gi, "url(blocked");
}

/**
 * Setting keys whose string values admins can set through the public
 * settings editor but which still ship verbatim to untrusted visitors.
 * These go through sanitizeCustomCss on write so a compromised or
 * careless admin cannot persist a break-out payload.
 */
export const CSS_SANITIZED_SETTING_KEYS = new Set<string>([
    "custom_css",
]);
