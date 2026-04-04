/**
 * Scheduled tasks - call from a cron job or admin API
 * Example: curl -X POST http://localhost:3000/api/v1/admin/cron -H "x-api-key: YOUR_KEY"
 *
 * Module-specific tasks (coupon expiry, ticket auto-close, order cancellation, gift code expiry)
 * have been moved to their respective modules. This function remains as a hook point
 * for future core-level scheduled tasks.
 */

export async function runScheduledTasks() {
    const results: string[] = [];

    // No core-level scheduled tasks at this time.
    // Module-specific tasks should be registered via module manifests or module APIs.

    return results;
}
