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
 * 1.27.0 - `buttonClassName` joins `@/core/sdk/ui`, beside `Button` the way
 * `badgeClassName` sits beside `Badge`. A control that navigates has to be an
 * anchor, and forty module call sites were wrapping a `<Button>` in a `<Link>`
 * instead, which renders `<a><button>`: forbidden by the HTML spec, two tab
 * stops for one control, and the accessible name on the inner element where a
 * screen reader announces the outer one. Core fixed its own with this function
 * and a module could not reach it.
 *
 * 1.26.0 - `sharedJson`, `peekShared` and `invalidateShared` join
 * `@/core/sdk`. A widget that fetches in an effect gets its own request, and
 * four store widgets wanting the same totals made fifteen of them on one
 * homepage. Deduplicating in a module-level variable does not survive code
 * splitting, which had already put two copies of the settings hook on the
 * same page; the shared store lives on `globalThis` instead. Addition.
 *
 * 1.25.0 - `errorMessage` joins `@/core/sdk`, beside `writeError`. A handler
 * that needs the body on success cannot hand the response to `writeError`
 * afterwards, so thirty-three screens had settled on `data.error ||
 * t("saveFailed")` instead: a shape that reads as a translated fallback and
 * is the reverse of one, since `error` is the English the route wrote and is
 * almost never absent. `errorMessage` answers the same question for a body
 * the caller already read. Addition.
 *
 * 1.24.0 - `pageParams` joins `@/core/sdk/server`, with `MAX_PAGE`,
 * `MAX_PAGE_SIZE` and `DEFAULT_PAGE_SIZE` beside it. Sixteen list endpoints
 * had hand-rolled the same page and limit parse in six wordings, and all of
 * them clamped the page from below only: a large enough `?page=` reached an
 * OFFSET past what a 32-bit integer holds, and the driver threw where the
 * handler had nothing to say - a 500 for a number in a query string. A module
 * that pages a list needs the fix as much as core does. Addition.
 *
 * 1.23.0 - A `number` module setting may declare `step`. A number input's
 * default step is 1, so a manifest could declare a setting whose real values
 * are fractional - a price of 0.013 a credit - and the browser marked every
 * usable value invalid. The setting existed and could not be set. Optional
 * addition to the manifest.
 *
 * 1.22.0 - `shouldNotify` joins `@/core/sdk/server`. The notification
 * preferences grid in /profile wrote a row for every toggle and nothing ever
 * read one: the check that consults it sat in core, unexported, and its own
 * doc comment described a caller that did not exist. A module that sends
 * something to a person is the caller, so it has to be able to ask.
 * Addition.
 *
 * 1.21.0 - `RichContent` joins `@/core/sdk/ui`. Author-written HTML was
 * rendered by seven module screens, each importing its own DOMPurify and each
 * styling the result with `prose dark:prose-invert` - class names that match
 * nothing here, since the typography plugin was never installed. One
 * component now sanitises and styles it, in the theme's colours, and works on
 * the server as well as in the browser.
 *
 * 1.20.0 - `useSettingsLoad` and `readJson` join `@/core/sdk/admin`. A module
 * settings screen that read `/api/v1/settings` with a bare `.then((r) =>
 * r.json())` could not tell a 500 from an empty answer, so it rendered its
 * defaults and its save button wrote them back over the site's real
 * settings. Core had the same hole in six screens; the fix has to be
 * reachable from a module or the gate that enforces it is a rule a module
 * cannot follow. Additions.
 *
 * 1.19.0 - `Radio` and `RadioField` join `@/core/sdk/ui`. The one-of-several
 * to `Checkbox`'s any-of-several, and bare for the same reason the
 * checkboxes were. Additions.
 *
 * 1.18.0 - `Slider` joins `@/core/sdk/ui`. The two range inputs in the panel
 * were bare, so both were drawn in the operating system's blue beside
 * controls painted in the theme's own primary. An addition.
 *
 * 1.17.0 - `AdminPageHeader` joins `@/core/sdk/admin`. Eighty admin screens
 * had written their own title row, between them using twelve heading sizes
 * and six different layouts, so moving from one screen to the next changed
 * the size of the title and the height of the button beside it. One header,
 * one set of choices. An addition.
 *
 * 1.16.0 - `Checkbox` and `CheckboxField` join `@/core/sdk/ui`. There were
 * twenty-nine bare `<input type="checkbox">` between core and the modules,
 * wearing ten different class strings, all of them painted by the operating
 * system rather than by the theme - the system's blue on a light box, and a
 * white box with a black hairline on a dark panel. Same treatment
 * `NativeSelect` got: the real element, with its appearance taken off.
 * Additions.
 *
 * 1.15.0 - `copyText` joins `@/core/sdk`. `navigator.clipboard` only exists
 * in a secure context, so on a self-hosted site reached by IP over http://
 * every "Copy" button on the site threw `TypeError` and did nothing. The
 * helper uses the real API where there is one, falls back to an offscreen
 * textarea where there is not, and returns whether the text landed. An
 * addition.
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
export const CORE_API_VERSION = "1.27.0";
