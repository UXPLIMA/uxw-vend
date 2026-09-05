import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A handler that answers with a row does not answer with its secrets.
 *
 * Prisma returns every column when a query names no `select`, so a route that
 * writes a row and responds with what it got back ships the columns the schema
 * keeps for itself. `POST /api/v1/servers` and `PATCH /api/v1/servers/[id]`
 * returned the encrypted RCON password an admin had just typed, and
 * `GET /api/v1/sessions` returned `tokenId`, the claim a JWT carries and the
 * key that table is looked up by when a session is checked for revocation.
 * None of it was read by the screens that asked.
 *
 * The secret column list is read out of the schemas rather than written here,
 * so a model added later is covered on the day it lands.
 */

const ROOT = process.cwd();

/** Column names that are a secret by their name alone. */
const SECRET_NAME = /(password|secret|token|apikey|privatekey|backupcodes)/i;

/**
 * Columns a name-based rule would take for secrets and which are not.
 *
 * `token_type` is the OAuth grant type, a constant like "bearer".
 */
const NOT_SECRET = new Set(["token_type", "tokenExpiresAt", "twoFactorEnabled", "passwordChangedAt"]);

export function secretColumnsByModel(schemas: string[]): Map<string, string[]> {
    const byModel = new Map<string, string[]>();
    for (const source of schemas) {
        for (const model of source.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
            const [, name, body] = model;
            const columns: string[] = [];
            for (const line of body.split("\n")) {
                const field = line.match(/^\s*(\w+)\s+\S/);
                if (!field) continue;
                const column = field[1];
                if (NOT_SECRET.has(column)) continue;
                if (SECRET_NAME.test(column)) columns.push(column);
            }
            if (columns.length > 0) {
                const key = name.charAt(0).toLowerCase() + name.slice(1);
                byModel.set(key, [...(byModel.get(key) ?? []), ...columns]);
            }
        }
    }
    return byModel;
}

/** The argument block of the call that starts at `open`, brace-matched. */
function callArgs(source: string, open: number): string {
    let depth = 0;
    for (let i = open; i < source.length; i++) {
        if (source[i] === "(") depth++;
        else if (source[i] === ")") {
            depth--;
            if (depth === 0) return source.slice(open, i + 1);
        }
    }
    return "";
}

/** Split a route file into its exported handlers, so one verb cannot vouch for another. */
export function handlers(source: string): string[] {
    const starts = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\b/g)].map(
        (m) => m.index ?? 0,
    );
    return starts.map((start, i) => source.slice(start, starts[i + 1] ?? source.length));
}

/**
 * Rows a handler reads from a model with secret columns, returns in its
 * response, and does not narrow with `select` or `omit`.
 */
export function unselectedRowsInResponses(handler: string, secretModels: Set<string>): string[] {
    const queries = [...handler.matchAll(
        /(?:const|let)\s+(\w+)\s*=\s*await\s+prisma\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|create|update|upsert)\s*\(/g,
    )].map((query) => ({
        binding: query[1],
        model: query[2],
        at: query.index ?? 0,
        args: callArgs(handler, (query.index ?? 0) + query[0].length - 1),
    }));
    if (queries.length === 0) return [];

    const offenders: string[] = [];
    for (const response of handler.matchAll(/NextResponse\.json\s*\(/g)) {
        const at = response.index ?? 0;
        const payload = callArgs(handler, at + response[0].length - 1);
        for (const { binding, model, args, at: declaredAt } of queries) {
            if (!secretModels.has(model)) continue;
            // `row.id` in a payload is one field; a bare `row` is the whole row.
            const bare = new RegExp(`(^|[^.\\w])${binding}\\s*(?![.\\w(])`);
            if (!bare.test(payload)) continue;
            // A name can be declared more than once in a handler, in branches
            // that never meet. Only the last declaration before the response
            // can be the one it answers with.
            const nearest = queries
                .filter((q) => q.binding === binding && q.at < at)
                .sort((a, b) => b.at - a.at)[0];
            if (!nearest || nearest.at !== declaredAt) continue;
            if (/\bselect\s*:/.test(args) || /\bomit\s*:/.test(args)) continue;
            offenders.push(`${model} as ${binding}`);
        }
    }
    return offenders;
}

function routeFiles(): string[] {
    const found: string[] = [];
    const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules") continue;
                walk(full);
            } else if (entry.name === "route.ts") {
                found.push(full);
            }
        }
    };
    walk(path.join(ROOT, "src/app/api"));
    walk(path.join(ROOT, "module-sources"));
    return found.sort();
}

function schemaSources(): string[] {
    const sources = [fs.readFileSync(path.join(ROOT, "prisma/schema.core.prisma"), "utf8")];
    const modules = path.join(ROOT, "module-sources");
    for (const entry of fs.readdirSync(modules)) {
        const schema = path.join(modules, entry, "schema.prisma");
        if (fs.existsSync(schema)) sources.push(fs.readFileSync(schema, "utf8"));
    }
    return sources;
}

describe("secret columns are selected around", () => {
    const secrets = secretColumnsByModel(schemaSources());
    const secretModels = new Set(secrets.keys());

    it("finds the models it is meant to guard", () => {
        expect(secretModels.has("user")).toBe(true);
        expect(secretModels.has("gameServer")).toBe(true);
        expect(secretModels.has("userSession")).toBe(true);
        expect(secrets.get("gameServer")).toContain("rconPassword");
    });

    it("no handler answers with a row it did not narrow", () => {
        const offenders: string[] = [];
        for (const file of routeFiles()) {
            const source = fs.readFileSync(file, "utf8");
            if (!source.includes("prisma.")) continue;
            for (const handler of handlers(source)) {
                for (const offender of unselectedRowsInResponses(handler, secretModels)) {
                    offenders.push(`${path.relative(ROOT, file)}: ${offender}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it("the three that shipped this way stay narrowed", () => {
        const servers = fs.readFileSync(path.join(ROOT, "module-sources/servers/api/route.ts"), "utf8");
        const server = fs.readFileSync(path.join(ROOT, "module-sources/servers/api/[id]/route.ts"), "utf8");
        const sessions = fs.readFileSync(path.join(ROOT, "src/app/api/v1/sessions/route.ts"), "utf8");
        expect(servers).toContain("SERVER_PUBLIC_FIELDS");
        expect(server).toContain("SERVER_PUBLIC_FIELDS");
        expect(sessions.slice(sessions.indexOf("select: {"))).not.toMatch(/tokenId/);
        const fields = fs.readFileSync(path.join(ROOT, "module-sources/servers/lib/server-fields.ts"), "utf8");
        expect(fields).not.toMatch(/rconPassword:\s*true/);
        expect(fields).not.toMatch(/rconPort:\s*true/);
    });

    // Self-tests: the checks above are worth their runtime only if they fail
    // on the shapes they exist to catch.
    it("secretColumnsByModel reads a schema and skips the false friends", () => {
        const found = secretColumnsByModel([
            "model Thing {\n  id String @id\n  apiKey String\n  token_type String?\n  name String\n}",
        ]);
        expect(found.get("thing")).toEqual(["apiKey"]);
    });

    it("unselectedRowsInResponses reads the declaration nearest the response", () => {
        const models = new Set(["user"]);
        const shadowed = `const user = await prisma.user.findUnique({ where });
            if (x) { return NextResponse.json({ ok: true }); }
            const user = await prisma.user.update({ where, data, select: { id: true } });
            return NextResponse.json({ user });`;
        expect(unselectedRowsInResponses(shadowed, models)).toEqual([]);
    });

    it("unselectedRowsInResponses catches a whole row and lets a field through", () => {
        const models = new Set(["gameServer"]);
        const bad = `const server = await prisma.gameServer.create({ data });
            return NextResponse.json({ server });`;
        const narrowed = `const server = await prisma.gameServer.create({ data, select: FIELDS });
            return NextResponse.json({ server });`;
        const fieldOnly = `const server = await prisma.gameServer.create({ data });
            return NextResponse.json({ id: server.id });`;
        expect(unselectedRowsInResponses(bad, models)).toHaveLength(1);
        expect(unselectedRowsInResponses(narrowed, models)).toEqual([]);
        expect(unselectedRowsInResponses(fieldOnly, models)).toEqual([]);
    });

    it("handlers keeps one verb from vouching for another", () => {
        const source = `export async function GET() {
            const user = await prisma.user.findUnique({ where, select: { id: true } });
            return NextResponse.json({ user });
        }
        export async function PATCH() {
            const user = await prisma.user.findUnique({ where });
            return NextResponse.json({ ok: true });
        }`;
        const parts = handlers(source);
        expect(parts).toHaveLength(2);
        expect(parts.flatMap((h) => unselectedRowsInResponses(h, new Set(["user"])))).toEqual([]);
    });
});
