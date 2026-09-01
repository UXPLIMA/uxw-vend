/**
 * Payload contract for the hooks this module fires.
 *
 * This is a promise to other modules, not a mirror of the Prisma row: only the
 * fields listed here are guaranteed, and the emitter is free to pass a wider
 * object. Widening this is safe; narrowing or renaming a field breaks every
 * listener and is a breaking change for the module.
 *
 * Declared here rather than in a listener because the EMITTER owns the shape.
 * Every name below also appears in this module's `hooksEmitted` manifest field.
 */
declare global {
    interface UxwVendHookPayloads {
        "blog.article.created": BlogArticleHookPayload;
        "blog.article.updated": BlogArticleHookPayload;
        "blog.article.deleted": { id: string; slug: string };
        "blog.category.created": BlogCategoryHookPayload;
        "blog.category.updated": BlogCategoryHookPayload;
        "blog.category.deleted": { id: string; slug: string };
    }
}

interface BlogArticleHookPayload {
    id: string;
    authorId: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    status: string;
    author?: { username: string } | null;
    category?: { name: string } | null;
}

interface BlogCategoryHookPayload {
    id: string;
    name: string;
    slug: string;
}

export {};
