import { installationId } from "@/core/lib/installation-id";

/**
 * Every request this installation makes to its marketplace.
 *
 * A key is a deployment value, read at request time like the base URL beside
 * it and never inlined at build time. An installation with no key sends no
 * headers and gets exactly what it got before: nothing about the free
 * catalogue is behind any of this.
 *
 * Server only, and separate from `marketplace-source.ts` on purpose. An admin
 * component reads the base URL from that file in the browser, and a database
 * call in that graph is a client bundle failure rather than a runtime one.
 */
export async function marketplaceFetch(url: string, init?: RequestInit): Promise<Response> {
    const key = process.env.BLYSIS_LICENCE_KEY?.trim();
    if (!key) return fetch(url, init);

    const headers = new Headers(init?.headers);
    headers.set("x-blysis-licence", key);
    headers.set("x-blysis-installation", await installationId());
    return fetch(url, { ...init, headers });
}
