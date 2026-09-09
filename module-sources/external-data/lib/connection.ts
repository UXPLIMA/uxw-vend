/**
 * Where the connection lives.
 *
 * A source names which stored connection it reads through, so a site can have
 * more than one. Almost none will, so there is a default, and it is this name
 * - the same one the settings screen writes to. Without a default an operator
 * fills the connection in, makes a source, and nothing joins the two: the
 * field saves and changes nothing, which is worse than no field.
 */
export const DEFAULT_CONNECTION_KEY = "external_data_connection";
