/**
 * Minimal semver range matcher for the module compatibility contract.
 *
 * Deliberately not the `semver` npm package: it exists in `node_modules` only
 * as a transitive dependency of build tooling. Importing a transitive dep into
 * runtime code is how a production install breaks the day a build tool drops
 * it. The grammar the manifest contract needs is small enough to own.
 *
 * Supported: `*` / `x`, exact (`1.2.3`), partial (`1`, `1.2`, `1.2.x`),
 * caret (`^1.2.3`), tilde (`~1.2.3`), comparators (`>=`, `>`, `<=`, `<`, `=`),
 * space-separated AND, and `||` alternation.
 *
 * Prerelease handling follows semver ordering: `1.0.0-beta` sorts below
 * `1.0.0`. Build metadata (`+sha`) is ignored, as the spec requires.
 */

export type Version = [major: number, minor: number, patch: number];

interface ParsedVersion {
    triple: Version;
    /** Dot-separated identifiers, or null for a release version. */
    prerelease: string[] | null;
}

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

const COMPARATOR_RE =
    /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseFull(raw: string): ParsedVersion | null {
    if (typeof raw !== "string") return null;
    const m = VERSION_RE.exec(raw.trim());
    if (!m) return null;
    return {
        triple: [Number(m[1]), Number(m[2]), Number(m[3])],
        prerelease: m[4] ? m[4].split(".") : null,
    };
}

/** Parses a strict `x.y.z` version. Returns null when the input is not one. */
export function parseVersion(raw: string): Version | null {
    return parseFull(raw)?.triple ?? null;
}

function compareTriple(a: Version, b: Version): number {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    }
    return 0;
}

function comparePrerelease(a: string[] | null, b: string[] | null): number {
    // A release version outranks any prerelease of the same triple.
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;

    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const x = a[i];
        const y = b[i];
        if (x === undefined) return -1;
        if (y === undefined) return 1;
        const xNum = /^\d+$/.test(x);
        const yNum = /^\d+$/.test(y);
        if (xNum && yNum) {
            const nx = Number(x);
            const ny = Number(y);
            if (nx !== ny) return nx < ny ? -1 : 1;
        } else if (xNum !== yNum) {
            // Numeric identifiers always have lower precedence than alphanumeric.
            return xNum ? -1 : 1;
        } else if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return 0;
}

function compareParsed(a: ParsedVersion, b: ParsedVersion): number {
    const t = compareTriple(a.triple, b.triple);
    return t !== 0 ? t : comparePrerelease(a.prerelease, b.prerelease);
}

interface Bound {
    version: ParsedVersion;
    inclusive: boolean;
}

interface Constraint {
    lo?: Bound;
    /** Exclusive unless `inclusive` is set. */
    hi?: Bound;
}

const WILDCARD = new Set(["x", "X", "*"]);

function release(triple: Version): ParsedVersion {
    return { triple, prerelease: null };
}

/**
 * Turns one comparator token into a bounded interval. Returns null when the
 * token is not valid syntax - callers must treat that as "reject", never as
 * "matches".
 */
function parseComparator(token: string): Constraint | null {
    const trimmed = token.trim();
    if (trimmed === "") return null;
    if (WILDCARD.has(trimmed)) return {};

    const m = COMPARATOR_RE.exec(trimmed);
    if (!m) return null;

    const op = m[1] ?? "=";
    const rawMajor = m[2];
    const rawMinor = m[3];
    const rawPatch = m[4];
    const pre = m[5] ? m[5].split(".") : null;

    if (WILDCARD.has(rawMajor)) {
        // `x`, `x.y.z` - unbounded regardless of operator.
        return {};
    }

    const major = Number(rawMajor);
    const minorGiven = rawMinor !== undefined && !WILDCARD.has(rawMinor);
    const patchGiven = rawPatch !== undefined && !WILDCARD.has(rawPatch);
    const minor = minorGiven ? Number(rawMinor) : 0;
    const patch = patchGiven ? Number(rawPatch) : 0;
    const base: ParsedVersion = { triple: [major, minor, patch], prerelease: pre };

    switch (op) {
        case ">":
            return { lo: { version: base, inclusive: false } };
        case ">=":
            return { lo: { version: base, inclusive: true } };
        case "<":
            return { hi: { version: base, inclusive: false } };
        case "<=":
            return { hi: { version: base, inclusive: true } };
        case "^": {
            // Caret allows changes that do not modify the left-most non-zero
            // element - npm semantics, including the 0.x special cases.
            let hi: Version;
            if (major !== 0) hi = [major + 1, 0, 0];
            else if (minorGiven && minor !== 0) hi = [0, minor + 1, 0];
            else if (minorGiven && patchGiven) hi = [0, 0, patch + 1];
            else if (minorGiven) hi = [0, minor + 1, 0];
            else hi = [1, 0, 0];
            return {
                lo: { version: base, inclusive: true },
                hi: { version: release(hi), inclusive: false },
            };
        }
        case "~": {
            // Tilde allows patch-level changes when a minor is specified,
            // minor-level changes when it is not.
            const hi: Version = minorGiven ? [major, minor + 1, 0] : [major + 1, 0, 0];
            return {
                lo: { version: base, inclusive: true },
                hi: { version: release(hi), inclusive: false },
            };
        }
        default: {
            // `=` / bare. A fully-specified version pins exactly; a partial one
            // behaves as an X-range (`1.2` === `>=1.2.0 <1.3.0`).
            if (minorGiven && patchGiven) {
                return {
                    lo: { version: base, inclusive: true },
                    hi: { version: base, inclusive: true },
                };
            }
            const hi: Version = minorGiven ? [major, minor + 1, 0] : [major + 1, 0, 0];
            return {
                lo: { version: base, inclusive: true },
                hi: { version: release(hi), inclusive: false },
            };
        }
    }
}

/** Parses one `||`-free clause: comparators joined by whitespace (AND). */
function parseClause(clause: string): Constraint[] | null {
    const tokens = clause
        // `>= 1.2.3` with a space is common in hand-written manifests.
        .replace(/(\^|~|>=|<=|>|<|=)\s+/g, "$1")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (tokens.length === 0) return null;

    const parsed: Constraint[] = [];
    for (const token of tokens) {
        const c = parseComparator(token);
        if (!c) return null;
        parsed.push(c);
    }
    return parsed;
}

/**
 * True when `range` is syntactically valid. The manifest schema uses this so
 * an unparseable range is rejected at validation time rather than silently
 * failing every comparison later.
 */
export function isValidRange(range: string): boolean {
    if (typeof range !== "string" || range.trim() === "") return false;
    return range.split("||").every((clause) => parseClause(clause) !== null);
}

function satisfiesConstraint(v: ParsedVersion, c: Constraint): boolean {
    if (c.lo) {
        const cmp = compareParsed(v, c.lo.version);
        if (cmp < 0 || (cmp === 0 && !c.lo.inclusive)) return false;
    }
    if (c.hi) {
        const cmp = compareParsed(v, c.hi.version);
        if (cmp > 0 || (cmp === 0 && !c.hi.inclusive)) return false;
    }
    return true;
}

/**
 * True when `version` satisfies `range`.
 *
 * Fails closed: an unparseable version or range returns false. A caller that
 * needs to distinguish "incompatible" from "malformed" must call
 * `isValidRange` first - which is exactly what manifest validation does.
 */
export function satisfiesRange(version: string, range: string): boolean {
    const v = parseFull(version);
    if (!v) return false;
    if (typeof range !== "string" || range.trim() === "") return false;

    return range.split("||").some((clause) => {
        const constraints = parseClause(clause);
        if (!constraints) return false;
        return constraints.every((c) => satisfiesConstraint(v, c));
    });
}
