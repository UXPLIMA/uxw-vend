/**
 * The events an operator can hang a message on.
 *
 * Named here rather than read from the manifest so each one can say what it
 * supplies: a screen that offers `{player}` without saying which events have a
 * player is a screen that produces messages with gaps in them.
 *
 * This is the list this module listens for. Adding one means a listener as
 * well as a line here, which is the point: an event nobody listens for would
 * be a message nobody sends.
 */
export interface KnownEvent {
    /** The hook, as the manifest declares it. */
    event: string;
    /** What an operator reads. */
    labelKey: string;
    /** The names they may write in a message, and what each one is. */
    placeholders: string[];
}

export const KNOWN_EVENTS: KnownEvent[] = [
    { event: "user.registered", labelKey: "event_user_registered", placeholders: ["username", "email"] },
    { event: "blog.article.created", labelKey: "event_blog_article", placeholders: ["title", "author", "url"] },
    { event: "forum.topic.created", labelKey: "event_forum_topic", placeholders: ["title", "author", "url"] },
    { event: "tickets.ticket.opened", labelKey: "event_ticket_opened", placeholders: ["subject", "username", "department"] },
    { event: "store.order.created", labelKey: "event_order_created", placeholders: ["orderNumber", "username", "total", "currency"] },
    { event: "store.order.completed", labelKey: "event_order_completed", placeholders: ["orderNumber", "username", "total", "currency"] },
];

/** Whether this is an event this module actually listens for. */
export function isKnownEvent(event: string): boolean {
    return KNOWN_EVENTS.some((known) => known.event === event);
}
