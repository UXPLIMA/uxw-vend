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
 * 1.14.0 - `Badge` joins `@/core/sdk/ui`. Every screen had hand-rolled its
 * own status pill out of `bg-green-100 text-green-700` and friends, so a
 * badge was a fixed light chip whatever the theme said, unreadable on a dark
 * panel, and no two of them agreed on radius, padding or shade. The component
 * has five tones drawn from the theme's own colour tokens, which dark mode
 * and every theme already redefine. An addition.
 *
 * 1.13.0 - `useFormRoute` joins `@/core/sdk/ui`. A create or edit form used
 * to unfold as a card above the list it belonged to, which on a screen with
 * two hundred rows pushes the row you came to edit off the bottom, gives the
 * back button nothing to close, and leaves a half-filled form that cannot be
 * reloaded or linked because nothing about it is in the URL. The hook reads
 * `?form=new` or `?form=<id>` off the current path; the screen renders the
 * form and returns early. Core's own screens use route segments instead - a
 * module's field definitions live in its one page file, and a child route
 * would need them copied into two more files per module.
 *
 * 1.12.0 - `Pagination` and `usePagedRows` join `@/core/sdk/ui`, and the
 * manifest gains `dashboardSections`. Eight admin screens had written the same
 * two chevrons and a "Page 2 / 9" caption, and nine lists that grow had no
 * pager at all; with only previous and next, reaching page forty takes
 * thirty-nine clicks. Numbered pages, first and last, and a box to type a page
 * number into. `dashboardSections` lets a module declare the panels its
 * `statsApi` returns so the dashboard customizer can offer them. Both
 * additions.
 *
 * 1.11.0 - `NativeSelect` joins `@/core/sdk/ui`. The panel had a themed
 * `Input` and no themed dropdown, so every "pick one of these strings"
 * control was a bare `<select>` wearing the browser's own chrome next to it.
 * This is the same element with the appearance taken off. An addition.
 *
 * 1.10.0 - `usePrompt` joins `@/core/sdk/ui`. It opens the same dialog
 * `useConfirm` does, with a field in it, so a module can ask for a line of
 * text without falling back to the browser's `prompt()`. An addition.
 *
 * 1.9.0 - `LoadFailed` joins `@/core/sdk/ui`. A module that fetches its own
 * content has the same two ways of being empty core does, and had the same
 * one way of saying so; this is the panel for the other one. An addition, so
 * a module written against 1.8.0 is unaffected.
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
export const CORE_API_VERSION = "1.14.0";
