import { applyFiltersAsync, doActionAsync } from "./hooks";

/**
 * Convention helpers for CRUD lifecycle hooks.
 *
 * Each resource emits a consistent set of hooks so cross-module listeners
 * have a predictable vocabulary:
 *
 *   <module>.<resource>.beforeCreate — filter, transforms input data
 *   <module>.<resource>.created      — action, fires after persist
 *   <module>.<resource>.beforeUpdate — filter, transforms input data
 *   <module>.<resource>.updated      — action, fires after persist
 *   <module>.<resource>.beforeDelete — action, fires before delete (can throw to cancel)
 *   <module>.<resource>.deleted      — action, fires after delete
 *
 * Example: `store.product.created` → analytics, discord-integration, etc.
 */

export async function fireCreate<T extends object>(
    resource: string,
    data: T,
    persist: (data: T) => Promise<T & { id: string }>
): Promise<T & { id: string }> {
    const filtered = await applyFiltersAsync<T>(`${resource}.beforeCreate`, data);
    const persisted = await persist(filtered);
    await doActionAsync(`${resource}.created`, persisted);
    return persisted;
}

export async function fireUpdate<T extends object>(
    resource: string,
    id: string,
    patch: Partial<T>,
    persist: (id: string, data: Partial<T>) => Promise<T & { id: string }>
): Promise<T & { id: string }> {
    const filtered = await applyFiltersAsync<Partial<T>>(`${resource}.beforeUpdate`, patch, { id });
    const persisted = await persist(id, filtered);
    await doActionAsync(`${resource}.updated`, persisted);
    return persisted;
}

export async function fireDelete<T extends { id: string }>(
    resource: string,
    entity: T,
    persist: (id: string) => Promise<void>
): Promise<void> {
    await doActionAsync(`${resource}.beforeDelete`, entity);
    await persist(entity.id);
    await doActionAsync(`${resource}.deleted`, entity);
}
