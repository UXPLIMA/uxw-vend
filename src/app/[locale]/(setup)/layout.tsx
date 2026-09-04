import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * The locale layout drops the setup namespace from what it sends to the
 * browser, since the wizard is reachable only on a fresh install and no
 * public page renders a key from it. This is where it comes back, for the
 * one tree that does. See core/lib/i18n/message-scopes.ts.
 */
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
    const messages = await getMessages();
    return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
