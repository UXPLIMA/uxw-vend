// `next dev` writes an agent-rules block into AGENTS.md on every start, from a
// template string baked into the `next` package. That template contains em
// dashes, so without this the file is re-dirtied after every dev boot and the
// no-em-dash gate fails on a tree nobody edited.
//
// Rewriting the vendored template is the only hook available: the block is not
// configurable and Next offers no opt-out. The patch is idempotent, touches one
// character class in one file, and re-applies on `npm install` because
// node_modules is not committed.

import fs from "fs";
import path from "path";

const TARGET = path.join(process.cwd(), "node_modules", "next", "dist", "server", "lib", "generate-agent-files.js");
// Built from its code point so this file does not trip its own gate.
const EM_DASH = String.fromCharCode(0x2014);

if (!fs.existsSync(TARGET)) {
    // Next is not installed yet, or moved the file in an upgrade. Not fatal:
    // the gate will flag the AGENTS.md drift if the block comes back.
    process.exit(0);
}

const before = fs.readFileSync(TARGET, "utf-8");
if (!before.includes(EM_DASH)) {
    process.exit(0);
}

fs.writeFileSync(TARGET, before.split(` ${EM_DASH} `).join(" - ").split(EM_DASH).join("-"), "utf-8");
console.log("[patch-next] rewrote em dashes in generate-agent-files.js");
