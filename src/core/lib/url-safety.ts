/**
 * Hostname allowlist matching that is NOT vulnerable to the classic
 * `hostname.endsWith("discord.com")` suffix bypass — that check also accepts
 * "evildiscord.com" and "discord.com.attacker.test". A hostname matches only
 * when it equals an allowed domain exactly or is a true subdomain of it.
 */
export function hostnameMatchesAllowlist(hostname: string, domains: string[]): boolean {
    const h = hostname.toLowerCase().replace(/\.$/, "");
    return domains.some((d) => {
        const dom = d.toLowerCase();
        return h === dom || h.endsWith("." + dom);
    });
}
