/**
 * What a stored notification says to this reader.
 *
 * A row keeps both: the English sentence written when the event happened, and
 * the key plus parameters that let it be said in another language. The key
 * wins when the reader's locale has it, and the sentence is what is left when
 * it does not - a row filed before the translation existed, or by a module
 * that ships none, still says something rather than showing a bare
 * `notif_orderCompleteTitle` to somebody.
 */
export interface StoredNotification {
    title: string;
    message: string;
    titleKey?: string | null;
    messageKey?: string | null;
    params?: Record<string, string | number> | null;
}

type Translate = ((key: string, values?: Record<string, string | number>) => string) & {
    has: (key: string) => boolean;
};

export function notificationText(
    item: StoredNotification,
    t: Translate,
): { title: string; message: string } {
    const say = (key: string | null | undefined, fallback: string) =>
        key && t.has(key) ? t(key, item.params ?? {}) : fallback;
    return {
        title: say(item.titleKey, item.title),
        message: say(item.messageKey, item.message),
    };
}
