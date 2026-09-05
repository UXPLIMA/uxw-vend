/**
 * Version of the module-facing contract - NOT the product version in
 * package.json.
 *
 * These are deliberately separate. The product version moves for reasons that
 * do not affect modules (UI work, dependency bumps, releases), and coupling
 * the two would force every module to widen its `coreVersion` range for
 * changes that cannot possibly break it.
 *
 * Bump the minor when the SDK gains a symbol, or when the manifest gains an
 * optional capability a module might need to require. Bump the major when a
 * symbol changes shape or is removed - that is the signal a module's declared
 * range is meant to catch.
 *
 * 1.8.0 - `useSiteCurrency` joins `@/core/sdk/ui`, and core mounts the
 * provider behind it. A module that shows a price no longer has to guess the
 * currency: the base is the setting the payment gateways charge in, the
 * formatting follows the reader's locale, and a module that knows exchange
 * rates can put every price on the site into another currency with
 * `setDisplay({ code, rate })`.
 *
 * 1.7.0 - `writeError` and the `Translator` type join `@/core/sdk`. A handler
 * that sends a POST and then shows a green toast without reading the response
 * reports success for a 403, a 429 and a 500 alike; the helper is the check,
 * in one line, in the reader's language.
 *
 * 1.6.0 - `useModalDialog` and `ModalDialogOptions` join `@/core/sdk/ui`. A
 * module that draws its own `role="dialog"` gets Escape, a Tab trap and focus
 * returned to whatever opened it, instead of hand-rolling a keydown listener
 * that covers a third of the problem.
 *
 * 1.5.0 - `readJsonBody` and `INVALID_JSON_BODY` join `@/core/sdk/server`.
 * A route that calls `request.json()` directly answers a malformed body with
 * a 500; the helper answers it with the 400 it deserves, in one wording.
 *
 * 1.4.0 - `authProviders[].standardCallback` lets a module that builds its own
 * provider say the provider still returns through Auth.js's own callback, so
 * the admin panel can show the redirect URL to register. Nothing else needs
 * it: a built-in provider always has that URL, and a module running its own
 * flow documents its own.
 *
 * 1.3.0 - `FilterContext`, and the typed context registry
 * `UxwVendFilterContexts` behind it. A filter that declares a context now has
 * both halves of its contract checked, at the call site and in every listener;
 * a filter that declares none behaves exactly as it did, so this is an
 * addition rather than a break.
 *
 * 1.2.0 - `authProviders[].factory` lets a module ship its own sign-in
 * provider instead of naming one Auth.js already has, `oauthButtons[].href`
 * lets that provider's button start a flow Auth.js does not know how to
 * start, and `resolveAppUrl` joins `@/core/sdk/server`. All three are
 * additions: a manifest written against 1.1.0 is unaffected.
 *
 * 1.1.0 - `searchProviders[].indexes` lets a module ask core to create its
 * full-text indexes. Requiring `coreVersion` in the manifest landed in the
 * same release but is not a major bump: a module that declared a range still
 * installs, and a module that declared none had no range for a major to
 * protect.
 */
export const CORE_API_VERSION = "1.8.0";
