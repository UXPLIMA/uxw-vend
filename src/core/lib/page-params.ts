/**
 * Where a page of results starts, and how big it is.
 *
 * Sixteen list endpoints had written the same two lines - a `page` with a
 * floor of one, a `limit` clamped between one and a hundred - in six
 * wordings, and every one of them stopped in the same place. `page` had a
 * floor and no ceiling.
 *
 * `?page=99999999999999999999` parses to 1e20, survives `Math.max(1, ...)`,
 * and reaches `skip: (page - 1) * limit`, which is past what the 32-bit
 * integer Postgres takes for OFFSET can hold. The driver refused it and threw
 * where the handler had nothing to say, so a number in a query string was a
 * 500: `/api/v1/punishments?page=99999999999999999999` and
 * `/api/v1/store/products?...` were two of sixteen.
 *
 * A ceiling rather than a 400, because that is what the floor already does
 * with `?page=-3`, and because a page past the end of a table is an empty
 * list rather than a mistake. `MAX_PAGE` pages of `MAX_LIMIT` rows is ten
 * million rows in - past any list a person is reading and far inside what an
 * OFFSET holds.
 */

/**
 * The furthest into a table paging will go.
 *
 * The note above justifies it by what an OFFSET can hold, which is about the
 * type. What it costs is a separate question and was measured in Postgres on
 * a 500k-row table, indexed on both the filter and the sort:
 *
 *     offset          0     1.2 ms
 *     offset     12,000     3.4 ms
 *     offset    499,988   141.2 ms   (the whole table)
 *     offset  9,999,900   117.9 ms   (this ceiling; the table ran out first)
 *
 * A deep page costs a walk of the table rather than of its own number,
 * because a database cannot skip rows that are not there. So this bounds the
 * damage only while the table is smaller than it, and the number that decides
 * the worst case is this one times `MAX_PAGE_SIZE`, which nobody declares.
 * `how-deep-a-page-may-go-is-a-number-somebody-chose.test.ts` holds the
 * product, so raising either constant has to be argued rather than assumed.
 */
export const MAX_PAGE = 100_000;

/** How many rows a list gives back when the caller does not say. */
export const DEFAULT_PAGE_SIZE = 20;

/** The most a caller may ask for in one page. */
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
    page: number;
    limit: number;
    /** Rows to skip. Always inside what an OFFSET can hold. */
    skip: number;
    /** Rows to take. The same number as `limit`, named as Prisma wants it. */
    take: number;
}

export interface PageParamsOptions {
    /**
     * The query parameter the page number is read from. A screen that pages
     * two lists at once names its second one something else - the forum's
     * topic view pages its posts with `postsPage` - and that one needs the
     * ceiling as much as the first.
     */
    pageParam?: string;
    /** The query parameter the page size is read from. */
    limitParam?: string;
    /** Page size when the caller does not ask for one. */
    defaultLimit?: number;
    /** The largest page a caller may ask for. */
    maxLimit?: number;
    /**
     * A page size the caller cannot change. For a screen whose page size is
     * the screen's own decision rather than the caller's.
     */
    fixedLimit?: number;
}

/** A positive integer, or null when the text is not one. */
function positiveInteger(raw: string | null): number | null {
    if (!raw) return null;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
}

export function pageParams(params: URLSearchParams, options: PageParamsOptions = {}): PageParams {
    const page = Math.min(MAX_PAGE, positiveInteger(params.get(options.pageParam ?? "page")) ?? 1);

    const limit =
        options.fixedLimit ??
        Math.min(
            options.maxLimit ?? MAX_PAGE_SIZE,
            positiveInteger(params.get(options.limitParam ?? "limit")) ?? options.defaultLimit ?? DEFAULT_PAGE_SIZE,
        );

    return { page, limit, skip: (page - 1) * limit, take: limit };
}
