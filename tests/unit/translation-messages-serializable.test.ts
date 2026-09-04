// @vitest-environment node
/**
 * The message tree crosses into a client component.
 *
 * `getMessages()` builds the nested tree next-intl hands to its client
 * provider. It accumulates into `Object.create(null)` records, which is a
 * deliberate second lock against a dotted key like `a.__proto__.b` reaching
 * the prototype chain - but React refuses to serialize an object with a null
 * prototype from a Server Component to a Client one, and throws
 * "Only plain objects, and a few built-ins, can be passed to Client
 * Components" for the whole request.
 *
 * The bug only showed on a cold cache: a cache hit returned `JSON.parse` of
 * the stored string, which is plain, so the same page was a 200 for two
 * minutes and a 500 for the first request after every invalidation. On the
 * demo `/en` was warm and `/tr` was not.
 *
 * So both paths must return the same shape. These tests pin that, and pin
 * that the pollution guard the null prototype backs up is still doing its
 * own job.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyTranslation = vi.fn();
const findManyModuleConfig = vi.fn();
const cacheGet = vi.fn();
const cacheSet = vi.fn();

vi.mock("@/core/lib/db", () => ({
    prisma: {
        translation: { findMany: (...a: unknown[]) => findManyTranslation(...a) },
        moduleConfig: { findMany: (...a: unknown[]) => findManyModuleConfig(...a) },
    },
}));

vi.mock("@/core/lib/redis", () => ({
    cacheGet: (...a: unknown[]) => cacheGet(...a),
    cacheSet: (...a: unknown[]) => cacheSet(...a),
    cacheDel: vi.fn(),
}));

const row = (namespace: string, key: string, value: string) => ({
    namespace,
    key,
    value,
    module: "core",
    isCustom: false,
});

/** Every object in the tree, the root included. */
function allObjects(value: unknown, out: object[] = []): object[] {
    if (typeof value !== "object" || value === null) return out;
    out.push(value);
    for (const v of Object.values(value)) allObjects(v, out);
    return out;
}

beforeEach(() => {
    vi.clearAllMocks();
    findManyModuleConfig.mockResolvedValue([]);
    cacheGet.mockResolvedValue(null);
    cacheSet.mockResolvedValue(undefined);
});

describe("getMessages", () => {
    it("returns a tree React can pass to a client component on a cold cache", async () => {
        findManyTranslation.mockResolvedValue([
            row("auth", "login.title", "Sign in"),
            row("auth", "login.submit", "Go"),
            row("common", "save", "Save"),
        ]);
        const { getMessages } = await import("@/core/lib/i18n/translation-service");
        const messages = await getMessages("tr");

        expect(cacheGet).toHaveBeenCalled();
        const objects = allObjects(messages);
        expect(objects.length).toBeGreaterThan(3);
        const nullProto = objects.filter((o) => Object.getPrototypeOf(o) === null);
        expect(
            nullProto.length,
            "a null-prototype object here throws 'Only plain objects ... can be passed to Client Components'",
        ).toBe(0);
    });

    it("returns the same shape whether the cache was warm or cold", async () => {
        findManyTranslation.mockResolvedValue([row("auth", "login.title", "Sign in")]);
        const { getMessages } = await import("@/core/lib/i18n/translation-service");

        const cold = await getMessages("tr");
        const stored = cacheSet.mock.calls[0][1] as string;

        cacheGet.mockResolvedValue(stored);
        const warm = await getMessages("tr");

        expect(warm).toEqual(cold);
        expect(allObjects(warm).map((o) => Object.getPrototypeOf(o) === null)).toEqual(
            allObjects(cold).map((o) => Object.getPrototypeOf(o) === null),
        );
    });

    it("still drops a key that would reach the prototype chain", async () => {
        findManyTranslation.mockResolvedValue([
            row("auth", "__proto__.polluted", "yes"),
            row("auth", "nested.constructor.x", "yes"),
            row("auth", "login.title", "Sign in"),
        ]);
        const { getMessages } = await import("@/core/lib/i18n/translation-service");
        const messages = (await getMessages("tr")) as Record<string, Record<string, unknown>>;

        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.keys(messages.auth)).toEqual(["login"]);
    });
});
