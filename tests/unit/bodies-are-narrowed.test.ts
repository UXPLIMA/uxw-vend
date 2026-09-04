import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A request body is `unknown` until a schema says otherwise.
 *
 * `readJsonBody` used to be typed `Promise<any>`, on the reasoning that every
 * call site validated what it got. Sixty-two write handlers did not. They read
 * a field off the body and handed it to Prisma, where a string in a number's
 * column is a 500 rather than a 400, a string with no declared bound is
 * whatever fits under the body cap, and an object in a `where` clause is not
 * a value at all but a filter operator.
 *
 * Typing the return `unknown` turns that omission into a compile error, which
 * is the real enforcement. This gate holds the two things the compiler cannot:
 * that the declared return type stays `unknown`, and that nobody buys their
 * way past it with a cast.
 */

const ROOT = path.resolve(__dirname, "../..");
const HANDLER = /export (?:async function|const) (GET|POST|PATCH|PUT|DELETE)\b/g;
const BODY_BINDING = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:readJsonBody|request\.json|req\.json)\b/g;
const GUARD = /\.(safeParse|parse)\(/;

type Handler = { verb: string; body: string };

function splitHandlers(source: string): Handler[] {
    const starts: { at: number; verb: string }[] = [];
    for (const m of source.matchAll(HANDLER)) starts.push({ at: m.index, verb: m[1] });
    return starts.map((s, i) => ({
        verb: s.verb,
        body: source.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : source.length),
    }));
}

/** Names bound to a raw JSON body inside one handler. */
function bodyNames(handler: string): string[] {
    return [...handler.matchAll(BODY_BINDING)].map((m) => m[1]);
}

/** Reaching into a value: a property read, a destructure, or a spread. */
function reachesInto(handler: string, name: string): boolean {
    return (
        new RegExp(`\\b${name}\\.\\w`).test(handler) ||
        new RegExp(`}\\s*=\\s*${name}\\b`).test(handler) ||
        new RegExp(`\\.\\.\\.\\s*${name}\\b`).test(handler)
    );
}

/** Casting the body is how a `unknown` return gets defeated without a schema. */
function castsBody(handler: string, name: string): boolean {
    return new RegExp(`\\b${name}\\s+as\\s+(?!NextResponse\\b)`).test(handler);
}

export function unnarrowedBodies(file: string, source: string): string[] {
    const found: string[] = [];
    for (const handler of splitHandlers(source)) {
        for (const name of bodyNames(handler.body)) {
            if (castsBody(handler.body, name)) {
                found.push(`${file} ${handler.verb}: casts \`${name}\` instead of parsing it`);
                continue;
            }
            if (reachesInto(handler.body, name) && !GUARD.test(handler.body)) {
                found.push(`${file} ${handler.verb}: reads \`${name}\` with no schema`);
            }
        }
    }
    return found;
}

function routeFiles(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            if (entry.name === "node_modules") continue;
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name === "route.ts") out.push(full);
        }
    };
    if (fs.existsSync(dir)) walk(dir);
    return out;
}

describe("readJsonBody hands back something nobody can read by accident", () => {
    it("declares its return type as unknown, not any", () => {
        const source = fs.readFileSync(path.join(ROOT, "src/core/lib/api-body.ts"), "utf8");
        expect(source).toContain("): Promise<unknown> {");
        expect(source).not.toMatch(/readJsonBody\([^)]*\): Promise<any>/);
    });

    it("has no handler reading a raw body without a schema", () => {
        const offences: string[] = [];
        for (const base of ["module-sources", "src/app/api"]) {
            for (const file of routeFiles(path.join(ROOT, base))) {
                const rel = path.relative(ROOT, file);
                offences.push(...unnarrowedBodies(rel, fs.readFileSync(file, "utf8")));
            }
        }
        expect(offences.join("\n")).toBe("");
    });

    it("finds handlers to check at all", () => {
        const files = routeFiles(path.join(ROOT, "module-sources"));
        const withBodies = files.filter((f) => BODY_BINDING.test(fs.readFileSync(f, "utf8")));
        expect(withBodies.length).toBeGreaterThan(30);
    });
});

describe("the check itself", () => {
    const raw = `
export async function POST(request: NextRequest) {
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    await prisma.thing.create({ data: { name: body.name } });
}
`;
    const parsed = `
export async function POST(request: NextRequest) {
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    const fields = thingSchema.safeParse(body);
    await prisma.thing.create({ data: { name: fields.data.name } });
}
`;
    const cast = `
export async function POST(request: NextRequest) {
    const body = await readJsonBody(request);
    const fields = thingSchema.safeParse(body);
    await prisma.thing.create({ data: (body as { name: string }) });
}
`;
    const untouched = `
export async function POST(request: NextRequest) {
    const body = await readJsonBody(request);
    if (body instanceof NextResponse) return body;
    await prisma.thing.update({ where: { id }, data: { votes: { increment: 1 } } });
}
`;

    it("catches a body read with no schema", () => {
        expect(unnarrowedBodies("a.ts", raw)).toEqual(["a.ts POST: reads `body` with no schema"]);
    });

    it("accepts a body a schema narrows", () => {
        expect(unnarrowedBodies("a.ts", parsed)).toEqual([]);
    });

    it("catches a cast even when a schema is present", () => {
        expect(unnarrowedBodies("a.ts", cast)).toEqual(["a.ts POST: casts `body` instead of parsing it"]);
    });

    it("leaves the sentinel guard alone", () => {
        expect(unnarrowedBodies("a.ts", untouched)).toEqual([]);
    });
});
