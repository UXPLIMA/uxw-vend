/**
 * Payload contract for the hooks this module fires. See blog/hooks.d.ts for
 * why the emitter owns these shapes and what widening/narrowing means.
 */
declare global {
    interface BlysisHookPayloads {
        "forum.topic.created": ForumTopicHookPayload;
        "forum.topic.updated": ForumTopicHookPayload;
        "forum.topic.deleted": { id: string };
        "forum.post.created": ForumPostCreatedHookPayload;
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
    // Nullable for the same reason as `author` below: `onDelete: SetNull`.
    authorId: string | null;
    // A post can be held for moderation, in which case nobody can read it yet.
    moderationState: string;
    author?: { username: string } | null;
}

/**
 * A new reply carries the topic it landed on as well. A listener with
 * something to tell the person who started that topic would otherwise have to
 * read the forum's own tables to find out who they are, which is a dependency
 * on this module rather than on its hook. An edit carries no such thing:
 * nobody is told about one.
 */
interface ForumPostCreatedHookPayload extends ForumPostHookPayload {
    topicAuthorId: string | null;
    topicTitle: string;
    topicSlug: string | null;
}

export {};
