import { getMessages } from "./i18n/translation-service";

/**
 * A module's own words, on the server, outside a page.
 *
 * `getTranslations` from next-intl resolves a locale from the route segment,
 * and an API route has none: asked from `/api/v1/...` it hands back the key
 * path rather than the word. Measured - an admin panel came out reading
 * `store.adm_customerPanel`.
 *
 * So the catalogue is read directly and the namespace picked out. The read is
 * cached by the translation service, which is what makes this cheap enough to
 * call from a hook that runs per request.
 *
 * A key with nothing behind it comes back as itself. That is what a missing
 * translation looks like everywhere else here, and inventing a word would hide
 * the gap from whoever has to fill it.
 */
export async function moduleTranslator(
    namespace: string,
    locale: string,
): Promise<(key: string) => string> {
    const messages = await getMessages(locale);
    const own = messages[namespace];
    const words = typeof own === "object" && own !== null ? (own as Record<string, unknown>) : {};

    return (key: string) => {
        const word = words[key];
        return typeof word === "string" ? word : key;
    };
}
