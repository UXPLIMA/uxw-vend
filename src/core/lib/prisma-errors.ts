import { NextResponse } from "next/server";

/**
 * Prisma errors that describe the caller's mistake, not the server's.
 *
 * Prisma throws for a row that is not there, a unique column that already
 * holds the value, and a foreign key that points at nothing. A route handler
 * that does not catch it hands the throw to the module API dispatcher, which
 * answers a flat 500 - so deleting an id that was already deleted, or saving
 * a slug someone else just took, both read to the caller as "the server
 * broke". Twenty-eight mutating handlers were in exactly that shape.
 *
 * These map to the status the situation deserves. Anything Prisma does not
 * name is left alone: an unrecognised failure really is a 500, and turning it
 * into a 4xx would hide it from the error log.
 */

/** A status and a message for a Prisma error, or null to leave it a 500. */
export interface PrismaErrorResponse {
    status: number;
    error: string;
    code: string;
}

/**
 * The codes worth translating. Every other `P####` stays a 500 on purpose.
 *
 * https://www.prisma.io/docs/orm/reference/error-reference
 */
const BY_CODE: Record<string, { status: number; error: string }> = {
    // An operation depended on a record that does not exist. Prisma raises it
    // for update and delete by id, and for a required relation that is missing.
    P2025: { status: 404, error: "Not found" },
    // Unique constraint failed.
    P2002: { status: 409, error: "Already exists" },
    // Foreign key constraint failed: the row this points at is not there.
    P2003: { status: 400, error: "Referenced record does not exist" },
    // A value is longer than the column allows.
    P2000: { status: 400, error: "Value too long for one of the fields" },
    // The query names a column the database does not have. This is a schema
    // drift symptom rather than a caller mistake, so it stays a 500.
};

/**
 * Duck-typed on purpose: `PrismaClientKnownRequestError` is a class from the
 * generated client, and an error crossing a dynamic `import()` boundary can
 * fail an `instanceof` against a differently-resolved copy of it. The shape
 * is stable and documented: a `code` of `P` followed by four digits.
 */
export function prismaErrorResponse(error: unknown): PrismaErrorResponse | null {
    if (!error || typeof error !== "object") return null;
    const code = (error as { code?: unknown }).code;
    if (typeof code !== "string" || !/^P\d{4}$/.test(code)) return null;
    const mapped = BY_CODE[code];
    if (!mapped) return null;
    return { ...mapped, code };
}

/**
 * Turns a caught Prisma error into the response it deserves, and rethrows
 * anything else so a genuine fault still reaches the error log as a 500.
 *
 * Module routes do not need this: their dispatcher applies the same mapping
 * to whatever a handler throws. Core's own routes have no dispatcher.
 *
 *   try {
 *       return NextResponse.json(await prisma.thing.update({ where: { id }, data }));
 *   } catch (err) {
 *       return prismaErrorOrThrow(err);
 *   }
 */
export function prismaErrorOrThrow(error: unknown): NextResponse {
    const known = prismaErrorResponse(error);
    if (!known) throw error;
    return NextResponse.json({ error: known.error }, { status: known.status });
}
