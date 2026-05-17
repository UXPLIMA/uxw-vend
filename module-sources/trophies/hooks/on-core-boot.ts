import { registerTrophyListeners } from "../lib/trophy-engine";

export default async function onCoreBoot() {
    await registerTrophyListeners();
}
