/**
 * Localize an activity feed entry title.
 *
 * Activity titles are written to the DB as English-formatted strings
 * like "Replied to: How to start" or "Suggested: Dark mode". To keep
 * older entries readable on non-English locales without a schema
 * change, we pattern-match the known prefixes (which line up with the
 * `type` field) and replace just the prefix with a translated version,
 * keeping the entity name (the dynamic part) intact.
 *
 * Pass `t` from `useTranslations("activity")` (client) or
 * `getTranslations("activity")` (server). Falls back to the raw title
 * for any type/prefix combination we don't recognize.
 */
type Translator = ((key: string) => string) & { has?: (key: string) => boolean };

const PREFIXES: Record<string, { prefix: string; key: string }> = {
    "forum.topic.created":          { prefix: "New topic: ",       key: "forumTopicCreated" },
    "forum.post.created":           { prefix: "Replied to: ",      key: "forumPostCreated" },
    "suggestions.suggestion.created": { prefix: "Suggested: ",     key: "suggestionCreated" },
    "tickets.ticket.created":       { prefix: "Opened ticket: ",   key: "ticketCreated" },
    "tickets.reply.created":        { prefix: "Replied to ticket: ", key: "ticketReplyCreated" },
    "blog.article.published":       { prefix: "Published: ",       key: "blogArticlePublished" },
    "user.registered":              { prefix: "",                  key: "userRegistered" },
    "store.order.completed":        { prefix: "Purchased: ",       key: "storeOrderCompleted" },
};

export function localizeActivityTitle(type: string, title: string, t: Translator): string {
    const cfg = PREFIXES[type];
    if (!cfg) return title;
    // For prefixed entries, strip the English prefix and substitute.
    if (cfg.prefix && title.startsWith(cfg.prefix)) {
        const entity = title.slice(cfg.prefix.length);
        return t.has?.(cfg.key) === false ? title : `${t(cfg.key)} ${entity}`.trim();
    }
    // For prefix-free entries (e.g. user.registered), title is the whole
    // English sentence — return our translation as-is.
    return t.has?.(cfg.key) === false ? title : t(cfg.key);
}
