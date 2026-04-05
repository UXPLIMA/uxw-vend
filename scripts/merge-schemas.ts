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

  // 1. Scan module-sources/ (reference schemas for built-in modules)
  if (fs.existsSync(MODULE_SOURCES_DIR)) {
    const dirs = fs.readdirSync(MODULE_SOURCES_DIR, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const schemaPath = path.join(MODULE_SOURCES_DIR, dir.name, "schema.prisma");
      if (!fs.existsSync(schemaPath)) continue;

      const content = fs.readFileSync(schemaPath, "utf-8");
      const { relations, cleanContent } = extractUserRelations(content);
      schemas.push({
        name: dir.name,
        source: "module-sources",
        content: cleanContent,
        userRelations: relations,
      });
      seen.add(dir.name);
    }
  }

  // 2. Scan src/modules/ (installed modules — may override module-sources)
  if (fs.existsSync(INSTALLED_MODULES_DIR)) {
    const dirs = fs.readdirSync(INSTALLED_MODULES_DIR, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const schemaPath = path.join(INSTALLED_MODULES_DIR, dir.name, "schema.prisma");
      if (!fs.existsSync(schemaPath)) continue;

      const content = fs.readFileSync(schemaPath, "utf-8");
      const { relations, cleanContent } = extractUserRelations(content);

      if (seen.has(dir.name)) {
        // Override module-sources version with installed version
        const idx = schemas.findIndex((s) => s.name === dir.name);
        if (idx !== -1) {
          schemas[idx] = {
            name: dir.name,
            source: "installed",
            content: cleanContent,
            userRelations: relations,
          };
        }
      } else {
        schemas.push({
          name: dir.name,
          source: "installed",
          content: cleanContent,
          userRelations: relations,
        });
      }
      seen.add(dir.name);
    }
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
