import { registerTrophyListeners, seedDefaultTrophies } from "../lib/trophy-engine";

export default async function onCoreBoot() {
    // Seed the starter trophies on the first boot after install (no-op once
    // any trophy exists), then wire up the auto-award listeners for whatever
    // rules are currently active.
    await seedDefaultTrophies();
    await registerTrophyListeners();
}
