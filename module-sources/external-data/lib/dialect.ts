/**
 * Which database a connection string names.
 *
 * Two are read: Postgres, because this site already speaks it, and MySQL,
 * because most of the servers this module gets pointed at run one. Nothing
 * else, and a string naming nothing else is refused rather than defaulted -
 * opening a Postgres socket to whatever host a `mongodb://` string names is a
 * connection attempt somebody did not ask for, made with their credentials.
 *
 * Read from the scheme rather than sniffed from the port or the shape. An
 * operator who typed the wrong scheme should be told, not quietly connected
 * to something else.
 */

export type Dialect = "postgres" | "mysql";

const SCHEMES: Record<string, Dialect> = {
    "postgres:": "postgres",
    "postgresql:": "postgres",
    "mysql:": "mysql",
    // The same wire protocol and the same driver. An operator who copied a
    // connection string out of their panel should not have to edit it.
    "mariadb:": "mysql",
};

export function dialectOf(connectionString: string): Dialect | null {
    const trimmed = connectionString.trim();
    if (trimmed === "") return null;
    // Read as a URL rather than by prefix: `mysqlish://` starts with `mysql`
    // and is not one.
    try {
        return SCHEMES[new URL(trimmed).protocol] ?? null;
    } catch {
        return null;
    }
}
