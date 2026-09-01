/**
 * Version of the module-facing contract — NOT the product version in
 * package.json.
 *
 * These are deliberately separate. The product version moves for reasons that
 * do not affect modules (UI work, dependency bumps, releases), and coupling
 * the two would force every module to widen its `coreVersion` range for
 * changes that cannot possibly break it.
 *
 * Bump the minor when the SDK gains a symbol. Bump the major when a symbol
 * changes shape or is removed — that is the signal a module's declared range
 * is meant to catch.
 */
export const CORE_API_VERSION = "1.0.0";
