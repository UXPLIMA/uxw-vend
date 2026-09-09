/**
 * Turning a user agent into something an operator can read.
 *
 * A login history that prints the whole string tells them nothing they can act
 * on. What they are looking for is "was this me": a browser, a system, a phone
 * or a desktop, next to a time and an address.
 *
 * The string is a rumour. Every browser has spent thirty years claiming to be
 * the others - Chrome says Safari, Edge says Chrome, Android says Linux, and
 * all of them say Mozilla - so this is a guess with a known shape, and the
 * order below is the whole of it: the most specific claim is checked first,
 * because every one of these strings contains the vaguer ones too.
 *
 * A string that fits nothing keeps what it was. An operator looking for "was
 * this me" is better served by an unfamiliar string than by a confident wrong
 * answer.
 */

/** As much of somebody else's text as a screen can use. */
const MAX_RAW = 400;

export interface ReadAgent {
    browser: string | null;
    os: string | null;
    mobile: boolean;
    /** What arrived, in case the reading below is wrong about it. */
    raw: string;
}

/** Most specific first: every one of these strings contains the vaguer ones. */
const BROWSERS: [RegExp, string][] = [
    [/\bEdg(?:e|A|iOS)?\//i, "Edge"],
    [/\bOPR\/|\bOpera\b/i, "Opera"],
    [/\bSamsungBrowser\//i, "Samsung Internet"],
    [/\bFirefox\/|\bFxiOS\//i, "Firefox"],
    [/\bChrome\/|\bCriOS\//i, "Chrome"],
    [/\bSafari\//i, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
    [/\bAndroid\b/i, "Android"],
    [/\b(iPhone|iPad|iPod|iOS)\b/i, "iOS"],
    [/\bWindows NT\b|\bWindows\b/i, "Windows"],
    [/\bMac OS X\b|\bMacintosh\b/i, "macOS"],
    [/\bCrOS\b/i, "ChromeOS"],
    [/\bLinux\b|\bX11\b/i, "Linux"],
];

function firstMatch(agent: string, table: [RegExp, string][]): string | null {
    for (const [pattern, name] of table) {
        if (pattern.test(agent)) return name;
    }
    return null;
}

export function readUserAgent(agent: string | null | undefined): ReadAgent {
    const raw = (agent ?? "").slice(0, MAX_RAW);
    if (raw.trim() === "") return { browser: null, os: null, mobile: false, raw };

    return {
        browser: firstMatch(raw, BROWSERS),
        os: firstMatch(raw, SYSTEMS),
        mobile: /\bMobi|\bMobile\b|\biPhone\b|\biPod\b|\bAndroid\b/i.test(raw),
        raw,
    };
}
