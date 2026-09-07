/**
 * What the panel is allowed to believe about available versions.
 *
 * The feed is fetched over the network from a place the operator can
 * repoint, so everything it says is external input: a version that is not a
 * version, a tag with a shell metacharacter in it, an entry that is not an
 * object at all. The parser is the boundary, and what survives it is a list
 * the update button can be driven from - which is why the tag is checked
 * against a shape a tag can actually have rather than passed on as text.
 *
 * The comparison is the other half. `0.10.0` is newer than `0.9.0`, and a
 * string compare says the opposite; a feed that lists an older version than
 * the one running must not offer an update at all.
 */
import { describe, it, expect } from "vitest";
import {
    isNewerVersion,
    parseReleases,
    latestRelease,
    blockedBy,
    nextInstallable,
    type CoreRelease,
} from "@/core/lib/core-releases";

const release = (over: Partial<CoreRelease> = {}): CoreRelease => ({
    version: "0.3.0",
    tag: "0.3.0",
    publishedAt: "2026-09-01T00:00:00Z",
    notes: "Faster product list.",
    security: false,
    channel: "stable",
    minVersion: null,
    ...over,
});

describe("comparing two versions", () => {
    it("knows ten comes after nine", () => {
        expect(isNewerVersion("0.9.0", "0.10.0")).toBe(true);
        expect(isNewerVersion("0.10.0", "0.9.0")).toBe(false);
    });

    it("ignores a leading v, because tags carry one and versions do not", () => {
        expect(isNewerVersion("0.2.1", "v0.2.2")).toBe(true);
        expect(isNewerVersion("v0.2.2", "0.2.1")).toBe(false);
    });

    it("treats a missing part as zero", () => {
        expect(isNewerVersion("1.2", "1.2.1")).toBe(true);
        expect(isNewerVersion("1.2.0", "1.2")).toBe(false);
    });

    it("says no to the same version, so a reinstall is not offered as an update", () => {
        expect(isNewerVersion("0.2.1", "0.2.1")).toBe(false);
    });

    it("says no to anything it cannot read as a version", () => {
        for (const junk of ["", "latest", "../../etc", "0.2.1; rm -rf /"]) {
            expect(isNewerVersion("0.2.1", junk), junk).toBe(false);
        }
    });
});

describe("reading the feed", () => {
    it("keeps the entries it understands", () => {
        const parsed = parseReleases({ releases: [release(), release({ version: "0.4.0", tag: "0.4.0" })] });
        expect(parsed.map((r) => r.version)).toEqual(["0.3.0", "0.4.0"]);
    });

    it("drops an entry whose tag could not be a tag", () => {
        // The tag reaches a process that pulls an image by name. Anything
        // outside the alphabet a tag may use is refused here, once, rather
        // than escaped by every reader.
        const parsed = parseReleases({
            releases: [
                release({ version: "0.4.0", tag: "0.4.0; docker rm -f app" }),
                release({ version: "0.5.0", tag: "0.5.0 && curl evil" }),
                release({ version: "0.6.0", tag: "../../latest" }),
                release({ version: "0.7.0", tag: "0.7.0" }),
            ],
        });
        expect(parsed.map((r) => r.tag)).toEqual(["0.7.0"]);
    });

    it("survives a feed that is not what it should be", () => {
        for (const junk of [null, undefined, 42, "text", {}, { releases: "no" }, { releases: [1, 2] }]) {
            expect(parseReleases(junk), JSON.stringify(junk) ?? "undefined").toEqual([]);
        }
    });

    it("does not let a missing field become an empty release", () => {
        expect(parseReleases({ releases: [{ version: "0.4.0" }] })).toEqual([]);
    });
});

describe("what to offer the operator", () => {
    const feed = [
        release({ version: "0.2.2", tag: "0.2.2" }),
        release({ version: "0.4.0", tag: "0.4.0" }),
        release({ version: "0.3.0", tag: "0.3.0" }),
        release({ version: "0.5.0", tag: "0.5.0", channel: "beta" }),
    ];

    it("offers the newest stable one", () => {
        expect(latestRelease(feed, "0.2.1", "stable")?.version).toBe("0.4.0");
    });

    it("offers a beta only to somebody who asked for betas", () => {
        expect(latestRelease(feed, "0.2.1", "beta")?.version).toBe("0.5.0");
    });

    it("offers nothing when the newest release is the one running", () => {
        expect(latestRelease(feed, "0.4.0", "stable")).toBeNull();
    });

    it("offers nothing when the feed is behind the install, which is a mirror problem", () => {
        expect(latestRelease(feed, "9.9.9", "stable")).toBeNull();
    });

    it("refuses a jump the release says cannot be made directly", () => {
        // A release that needs an intermediate one says so, and the panel has
        // to send the operator through the step rather than skipping it.
        const twoSteps = [
            release({ version: "0.3.0", tag: "0.3.0" }),
            release({ version: "0.9.0", tag: "0.9.0", minVersion: "0.3.0" }),
        ];
        expect(blockedBy(twoSteps[1], "0.2.1")?.version).toBe("0.3.0");
        expect(blockedBy(twoSteps[1], "0.3.0")).toBeNull();
        expect(blockedBy(twoSteps[1], "0.4.0")).toBeNull();
    });

    it("does not block a release that asks for nothing", () => {
        expect(blockedBy(release(), "0.0.1")).toBeNull();
    });
});

describe("what to offer when the newest one is out of reach", () => {
    const feed = [
        release({ version: "0.3.0", tag: "0.3.0" }),
        release({ version: "0.9.0", tag: "0.9.0", minVersion: "0.3.0" }),
    ];

    it("offers the step, and still says what is waiting after it", () => {
        const step = nextInstallable(feed, "0.2.1", "stable");
        expect(step.target?.version).toBe("0.3.0");
        expect(step.newest?.version).toBe("0.9.0");
    });

    it("offers the newest once the step has been taken", () => {
        const step = nextInstallable(feed, "0.3.0", "stable");
        expect(step.target?.version).toBe("0.9.0");
    });

    it("offers nothing when the feed names a step it does not carry", () => {
        const broken = [release({ version: "0.9.0", tag: "0.9.0", minVersion: "0.5.0" })];
        const step = nextInstallable(broken, "0.2.1", "stable");
        expect(step.target).toBeNull();
        expect(step.newest?.version).toBe("0.9.0");
    });

    it("offers nothing at all when there is nothing newer", () => {
        expect(nextInstallable(feed, "9.9.9", "stable")).toEqual({ target: null, newest: null });
    });
});
