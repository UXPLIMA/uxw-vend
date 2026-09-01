/**
 * Payload contract for the hooks this module fires. See blog/hooks.d.ts for
 * why the emitter owns these shapes and what widening/narrowing means.
 */
declare global {
    interface UxwVendHookPayloads {
        "forum.topic.created": ForumTopicHookPayload;
        "forum.topic.updated": ForumTopicHookPayload;
        "forum.topic.deleted": { id: string };
        "forum.post.created": ForumPostHookPayload;
        "forum.post.updated": ForumPostHookPayload;
        "forum.post.deleted": { id: string };
    }
}

interface ForumTopicHookPayload {
    id: string;
    title: string;
    author?: { username: string } | null;
    category?: { name: string } | null;
}

interface ForumPostHookPayload {
    id: string;
    topicId: string;
    author?: { username: string } | null;
}

export {};
