/**
 * Simple in-process pub/sub event emitter for real-time events
 *
 * Modules can emit events, and other parts of the system can subscribe.
 * This is a lightweight foundation -- full WebSocket support (e.g. Socket.io)
 * can be layered on top later by bridging these events to connected clients.
 *
 * Usage:
 *   import { emit, subscribe } from "@/core/lib/realtime";
 *
 *   // Subscribe to events
 *   const unsubscribe = subscribe("order.completed", (data) => { ... });
 *
 *   // Emit events
 *   emit("order.completed", { orderId: "123", userId: "456" });
 *
 *   // Cleanup
 *   unsubscribe();
 */

type EventHandler = (data: unknown) => void;

const listeners = new Map<string, Set<EventHandler>>();

/**
 * Emit an event to all subscribers
 */
export function emit(event: string, data: unknown): void {
    const handlers = listeners.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
        try {
            handler(data);
        } catch (err) {
            console.error(`[realtime] Error in handler for "${event}":`, err);
        }
    }
}

/**
 * Subscribe to an event
 * Returns an unsubscribe function
 */
export function subscribe(event: string, handler: EventHandler): () => void {
    if (!listeners.has(event)) {
        listeners.set(event, new Set());
    }
    listeners.get(event)!.add(handler);

    return () => {
        listeners.get(event)?.delete(handler);
        // Clean up empty sets
        if (listeners.get(event)?.size === 0) {
            listeners.delete(event);
        }
    };
}

/**
 * Subscribe to an event, but only fire once
 */
export function once(event: string, handler: EventHandler): () => void {
    const wrappedHandler: EventHandler = (data) => {
        unsubscribe();
        handler(data);
    };
    const unsubscribe = subscribe(event, wrappedHandler);
    return unsubscribe;
}

/**
 * Get the number of listeners for an event (useful for debugging)
 */
export function listenerCount(event: string): number {
    return listeners.get(event)?.size ?? 0;
}

/**
 * Remove all listeners (useful for testing)
 */
export function removeAllListeners(event?: string): void {
    if (event) {
        listeners.delete(event);
    } else {
        listeners.clear();
    }
}
