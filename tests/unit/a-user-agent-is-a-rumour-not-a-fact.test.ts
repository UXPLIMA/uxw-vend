/**
 * Turning a user agent into something an operator can read.
 *
 * A login history that says
 * `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like
 * Gecko) Chrome/120.0.0.0 Safari/537.36` tells an operator nothing they can
 * act on. What they are looking for is "was this me": a browser, a system, a
 * phone or a desktop, next to a time and an address.
 *
 * The string is a rumour, though. Every browser has spent thirty years
 * claiming to be the others - Chrome says Safari, Edge says Chrome, and all of
 * them say Mozilla - so the reading is a guess with a known shape, and the
 * only honest thing to do with a string that does not fit is to say so rather
 * than pick the nearest name.
 *
 * It is also somebody else's text. It arrives on a request, from whoever made
 * it, and it ends up on a screen an administrator is reading.
 */
import { describe, it, expect } from "vitest";
import { readUserAgent } from "@/core/lib/user-agent";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
const EDGE_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("which browser it says it is", () => {
    it("reads the common ones", () => {
        expect(readUserAgent(CHROME_WIN).browser).toBe("Chrome");
        expect(readUserAgent(SAFARI_MAC).browser).toBe("Safari");
        expect(readUserAgent(FIREFOX_LINUX).browser).toBe("Firefox");
    });

    it("believes the one that names itself last", () => {
        // Edge says Chrome and Safari before it says Edge, because thirty
        // years ago that was how you were allowed in.
        expect(readUserAgent(EDGE_WIN).browser).toBe("Edge");
    });

    it("does not call Chrome Safari", () => {
        // Chrome claims Safari too. Order is the whole of this.
        expect(readUserAgent(CHROME_WIN).browser).not.toBe("Safari");
        expect(readUserAgent(CHROME_ANDROID).browser).toBe("Chrome");
    });
});

describe("which system it says it is on", () => {
    it("reads the common ones", () => {
        expect(readUserAgent(CHROME_WIN).os).toBe("Windows");
        expect(readUserAgent(SAFARI_MAC).os).toBe("macOS");
        expect(readUserAgent(FIREFOX_LINUX).os).toBe("Linux");
        expect(readUserAgent(SAFARI_IPHONE).os).toBe("iOS");
        expect(readUserAgent(CHROME_ANDROID).os).toBe("Android");
    });

    it("does not call Android Linux", () => {
        // Android says Linux first. Same trap, other end.
        expect(readUserAgent(CHROME_ANDROID).os).not.toBe("Linux");
    });
});

describe("whether it is a phone", () => {
    it("says so when it says so", () => {
        expect(readUserAgent(SAFARI_IPHONE).mobile).toBe(true);
        expect(readUserAgent(CHROME_ANDROID).mobile).toBe(true);
    });

    it("says otherwise for the rest", () => {
        expect(readUserAgent(CHROME_WIN).mobile).toBe(false);
        expect(readUserAgent(SAFARI_MAC).mobile).toBe(false);
    });
});

describe("a string that fits nothing", () => {
    it("keeps what it was rather than picking the nearest name", () => {
        // An operator looking for "was this me" is better served by an
        // unfamiliar string than by a confident wrong answer.
        const odd = readUserAgent("some-crawler/1.0 (+https://example.com/bot)");
        expect(odd.browser).toBeNull();
        expect(odd.os).toBeNull();
        expect(odd.raw).toBe("some-crawler/1.0 (+https://example.com/bot)");
    });

    it("copes with nothing at all", () => {
        expect(readUserAgent("")).toEqual({ browser: null, os: null, mobile: false, raw: "" });
        expect(readUserAgent(null)).toEqual({ browser: null, os: null, mobile: false, raw: "" });
    });

    it("keeps only as much of somebody else's text as a screen can use", () => {
        // It arrives on a request, from whoever made it, and it ends up on an
        // administrator's screen.
        const long = readUserAgent("x".repeat(5000));
        expect(long.raw.length).toBeLessThanOrEqual(400);
    });
});
