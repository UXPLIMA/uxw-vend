/**
 * Publish the manifest grammar as JSON Schema.
 *
 * The schema in `module-manifest-schema.ts` is the only description of what a
 * manifest may say, and until now it was readable only by this repository.
 * Anything else that accepts a module from an author - the marketplace that
 * sells one, an editor, somebody else's linter - had to guess, and the first
 * package that passes one guess and fails another is a support ticket nobody
 * can answer.
 *
 * `unrepresentable: "any"` because Zod's `.refine()` rules have no JSON Schema
 * equivalent: a custom check on a string becomes an unconstrained string here.
 * Whoever reads this has to own those rules themselves, and the ones that
 * matter are the id matching its directory, an admin path not repeating the
 * prefix core adds, and a version range actually being one.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { moduleManifestSchema } from "../src/core/lib/module-manifest-schema";

const OUTPUT = path.join(process.cwd(), "module-marketplace/manifest-schema.json");

const schema = z.toJSONSchema(moduleManifestSchema, { io: "input", unrepresentable: "any" });

fs.writeFileSync(OUTPUT, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`Manifest schema: ${Object.keys(schema.properties ?? {}).length} properties`);
