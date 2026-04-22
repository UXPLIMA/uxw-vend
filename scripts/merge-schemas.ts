// Merge Prisma Schemas
//
// Reads prisma/schema.core.prisma (base) + all module-sources/[name]/schema.prisma
// and src/modules/[name]/schema.prisma, merges them into prisma/schema.prisma.
//
// Module schemas can declare User relation fields via a special comment block:
//   // @@user-relations-start
//   //   fieldName Type[] @relation("Name")
//   // @@user-relations-end
//
// The core schema has a marker: // @@MODULE_RELATIONS
// which is replaced with all collected user relations.
//
// Usage: npx tsx scripts/merge-schemas.ts

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = process.cwd();
const CORE_SCHEMA = path.join(ROOT, "prisma/schema.core.prisma");
const OUTPUT_SCHEMA = path.join(ROOT, "prisma/schema.prisma");
const MODULE_SOURCES_DIR = path.join(ROOT, "module-sources");
const INSTALLED_MODULES_DIR = path.join(ROOT, "src/modules");

interface ModuleSchema {
  name: string;
  source: "module-sources" | "installed";
  content: string;
  userRelations: string[];
}

function extractUserRelations(content: string): { relations: string[]; cleanContent: string } {
  const relations: string[] = [];
  const lines = content.split("\n");
  let inBlock = false;
  const cleanLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === "// @@user-relations-start") {
      inBlock = true;
      continue;
    }
    if (line.trim() === "// @@user-relations-end") {
      inBlock = false;
      continue;
    }
    if (inBlock) {
      // Strip leading "// " prefix to get the actual relation line
      const rel = line.replace(/^\/\/\s*/, "").trim();
      if (rel) {
        relations.push("  " + rel);
      }
      continue;
    }
    cleanLines.push(line);
  }

  return { relations, cleanContent: cleanLines.join("\n") };
}

function stripCommentHeader(content: string): string {
  // Remove leading comment lines at the top of module schemas
  const lines = content.split("\n");
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("//")) {
      startIdx = i + 1;
    } else {
      break;
    }
  }
  return lines.slice(startIdx).join("\n");
}

function discoverModuleSchemas(): ModuleSchema[] {
  const schemas: ModuleSchema[] = [];
  const seen = new Set<string>();

  // Only include schemas for modules that are actually installed (exist in src/modules/)
  const installedModules = new Set<string>();
  if (fs.existsSync(INSTALLED_MODULES_DIR)) {
    const dirs = fs.readdirSync(INSTALLED_MODULES_DIR, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) installedModules.add(dir.name);
    }
  }

  // For each installed module, prefer src/modules/[name]/schema.prisma,
  // fall back to module-sources/[name]/schema.prisma
  for (const moduleName of installedModules) {
    const installedSchema = path.join(INSTALLED_MODULES_DIR, moduleName, "schema.prisma");
    const sourceSchema = path.join(MODULE_SOURCES_DIR, moduleName, "schema.prisma");

    let schemaPath: string | null = null;
    let source: "installed" | "module-sources" = "installed";

    if (fs.existsSync(installedSchema)) {
      schemaPath = installedSchema;
      source = "installed";
    } else if (fs.existsSync(sourceSchema)) {
      schemaPath = sourceSchema;
      source = "module-sources";
    }

    if (!schemaPath) continue;

    const content = fs.readFileSync(schemaPath, "utf-8");
    const { relations, cleanContent } = extractUserRelations(content);
    schemas.push({
      name: moduleName,
      source,
      content: cleanContent,
      userRelations: relations,
    });
    seen.add(moduleName);
  }

  return schemas;
}

function mergeSchemas(): string {
  // Read core schema
  if (!fs.existsSync(CORE_SCHEMA)) {
    console.error("ERROR: prisma/schema.core.prisma not found");
    process.exit(1);
  }

  const core = fs.readFileSync(CORE_SCHEMA, "utf-8");
  const modules = discoverModuleSchemas();

  // Check for duplicate model names across modules
  const coreModelNames = new Set<string>();
  const coreModelMatches = core.matchAll(/^model\s+(\w+)\s*\{/gm);
  for (const match of coreModelMatches) {
    coreModelNames.add(match[1]);
  }

  const modelOwners = new Map<string, string>();
  for (const mod of modules) {
    const modelMatches = mod.content.matchAll(/^model\s+(\w+)\s*\{/gm);
    for (const match of modelMatches) {
      const modelName = match[1];
      if (coreModelNames.has(modelName)) {
        // A module tried to redeclare a core model (e.g. User). The merger
        // keeps the core definition and silently drops the module's copy,
        // which means any fields the module tried to add are LOST — a
        // subtle source of "my migration doesn't include my column"
        // confusion. Warn loudly so the author knows to use the
        // // @@user-relations-start / // @@user-relations-end block
        // (or a separate model) instead.
        console.warn(
          `[merge-schemas] WARNING: module '${mod.name}' redeclares core model '${modelName}'. ` +
          `The module's definition is IGNORED — only the core schema version ships. ` +
          `If you need to add fields/relations to a core model, use the ` +
          `// @@user-relations-start ... // @@user-relations-end block.`
        );
        continue;
      }
      const existingOwner = modelOwners.get(modelName);
      if (existingOwner && existingOwner !== mod.name) {
        throw new Error(
          `Model name collision: '${modelName}' is defined in both '${existingOwner}' and '${mod.name}' modules. ` +
          `Rename one of the models to resolve the conflict.`
        );
      }
      modelOwners.set(modelName, mod.name);
    }
  }

  // Collect all user relations
  const allUserRelations: string[] = [];
  for (const mod of modules) {
    if (mod.userRelations.length > 0) {
      allUserRelations.push(`  // ${mod.name} module`);
      allUserRelations.push(...mod.userRelations);
      allUserRelations.push("");
    }
  }

  // Replace @@MODULE_RELATIONS marker in core schema
  let merged = core;
  if (allUserRelations.length > 0) {
    const relationsBlock = allUserRelations.join("\n");
    merged = merged.replace(
      /\s*\/\/\s*@@MODULE_RELATIONS/,
      "\n\n" + relationsBlock
    );
  } else {
    merged = merged.replace(/\s*\/\/\s*@@MODULE_RELATIONS/, "");
  }

  // Append module model definitions
  for (const mod of modules) {
    const stripped = stripCommentHeader(mod.content).trim();
    if (stripped) {
      merged += "\n\n// ==================== MODULE: " + mod.name + " ====================\n\n";
      merged += stripped;
    }
  }

  merged += "\n";

  return merged;
}

// Main
try {
  console.log("Merging Prisma schemas...");
  const result = mergeSchemas();
  fs.writeFileSync(OUTPUT_SCHEMA, result, "utf-8");
  console.log(`Written merged schema to ${OUTPUT_SCHEMA}`);

  // Count models
  const modelCount = (result.match(/^model\s+/gm) || []).length;
  const enumCount = (result.match(/^enum\s+/gm) || []).length;
  console.log(`Total: ${modelCount} models, ${enumCount} enums`);

  // Run prisma generate
  console.log("Running prisma generate...");
  execFileSync("npx", ["prisma", "generate"], {
    cwd: ROOT,
    timeout: 30000,
    stdio: "inherit",
  });
  console.log("Prisma client generated successfully.");
} catch (err) {
  console.error("Schema merge failed:", err);
  process.exit(1);
}
