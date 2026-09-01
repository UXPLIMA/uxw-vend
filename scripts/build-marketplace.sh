#!/bin/bash
# Build marketplace ZIPs from module-sources/ and regenerate index.json.
# Usage: bash scripts/build-marketplace.sh

set -e

SOURCES_DIR="module-sources"
OUTPUT_DIR="module-marketplace"

if [ ! -d "$SOURCES_DIR" ]; then
    echo "Error: $SOURCES_DIR directory not found"
    exit 1
fi

count=0
for mod in "$SOURCES_DIR"/*/; do
    name=$(basename "$mod")
    if [ ! -f "$mod/module.json" ]; then
        echo "  Skip: $name (no module.json)"
        continue
    fi

    (cd "$mod" && zip -r - . -x "*.DS_Store" -x "__MACOSX/*") > "$OUTPUT_DIR/${name}.zip" 2>/dev/null
    count=$((count + 1))
done

# Regenerate index.json from module.json files, preserving runtime metadata.
UPDATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - <<PYEOF
import json, os, re, sys, datetime

SOURCES_DIR = "$SOURCES_DIR"
OUTPUT_DIR = "$OUTPUT_DIR"
UPDATED_AT = "$UPDATED_AT"

# Category and tags come from each module.json. There is deliberately no
# category table here: a hardcoded module list in build tooling was the last
# place in the repo where adding a module meant editing a shared file.
FALLBACK_CATEGORY = "content"

# The SDK boundary, scanned as text so a violation can't reach a ZIP. The
# authoritative check with explanations is scripts/validate-module.ts; this is
# the same rule applied to every module at once.
DEEP_IMPORT = re.compile(r'["\']@/core/(?:lib|components)/[^"\']*["\']')

# Hook names core itself emits or declares. A module may legitimately listen to
# any of these, so they count as known even though no module declares them.
CORE_HOOK_SOURCES = ["src/core/lib/hooks.ts", "src/core/types/hook-payloads.d.ts"]
EMIT_CALL = re.compile(r'\b(?:doAction|doActionAsync|applyFilters|applyFiltersAsync)\(\s*"([^"]+)"')

core_hooks = set()
for root, _, files in os.walk("src"):
    for fn in files:
        if fn.endswith((".ts", ".tsx")):
            with open(os.path.join(root, fn), encoding="utf-8", errors="ignore") as f:
                core_hooks.update(EMIT_CALL.findall(f.read()))
for path in CORE_HOOK_SOURCES:
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            text = f.read()
        # HookNames constants and the payload-registry keys are both quoted
        # dotted names on their own line; either form declares a core hook.
        core_hooks.update(re.findall(r'"([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)"\s*[,:]', text))

modules = []
violations = []
emitted_by = {}    # hook name -> module id that declares it
listened_by = []   # (module id, hook name)

for name in sorted(os.listdir(SOURCES_DIR)):
    module_dir = os.path.join(SOURCES_DIR, name)
    manifest_path = os.path.join(module_dir, "module.json")
    if not os.path.isfile(manifest_path):
        continue
    with open(manifest_path, encoding="utf-8") as f:
        m = json.load(f)

    for root, _, files in os.walk(module_dir):
        for fn in files:
            if not fn.endswith((".ts", ".tsx")):
                continue
            fp = os.path.join(root, fn)
            with open(fp, encoding="utf-8", errors="ignore") as f:
                for lineno, line in enumerate(f, 1):
                    if DEEP_IMPORT.search(line):
                        violations.append(f"{os.path.relpath(fp)}:{lineno}")

    for h in m.get("hooksEmitted", []) or []:
        emitted_by[h["hook"]] = m["id"]
    for h in m.get("hookListeners", []) or []:
        listened_by.append((m["id"], h["hook"]))

    cat = m.get("category") or FALLBACK_CATEGORY
    manifest_tags = m.get("tags")
    tags = [str(t) for t in manifest_tags] if isinstance(manifest_tags, list) and manifest_tags else [cat]

    # Screenshots are curated content, not generated — carry them across rebuilds.
    screenshots = []
    existing_path = os.path.join(OUTPUT_DIR, "index.json")
    if os.path.isfile(existing_path):
        try:
            with open(existing_path, encoding="utf-8") as f:
                for em in json.load(f).get("modules", []):
                    if em["id"] == m["id"]:
                        screenshots = em.get("screenshots", []) or []
                        break
        except Exception:
            pass

    modules.append({
        "id": m["id"],
        "name": m["name"],
        "description": m.get("description", ""),
        "version": m.get("version", "1.0.0"),
        "coreVersion": m.get("coreVersion"),
        "author": m.get("author", "uxwVend"),
        "icon": m.get("icon", "Package"),
        "category": cat,
        "verified": True,
        "updatedAt": UPDATED_AT,
        "screenshots": screenshots,
        "tags": tags,
        "zip": f"{name}.zip",
        "dependencies": m.get("dependencies", []),
        "conflicts": m.get("conflicts", []),
        "hooks": {
            "emits": [h["hook"] for h in m.get("hooksEmitted", []) or []],
            "listens": [h["hook"] for h in m.get("hookListeners", []) or []],
        },
        "stats": {
            "publicRoutes": len(m.get("routes", [])),
            "adminRoutes": len(m.get("adminRoutes", [])),
            "apiRoutes": len(m.get("api", [])),
            "widgets": len(m.get("widgets", [])),
        },
    })

# A listener on a hook nothing emits never fires, and nothing reports it — not
# at build time, not at runtime, not in a log. Checking the whole catalog at
# once is the only place where both halves of the contract are visible.
unknown_hooks = [
    (mod, hook) for mod, hook in listened_by
    if hook not in emitted_by and hook not in core_hooks
]
if unknown_hooks:
    print(f"ERROR: {len(unknown_hooks)} hook listener(s) subscribe to a hook nothing emits.", file=sys.stderr)
    print("A listener on an unknown hook silently never runs. Check the spelling, or", file=sys.stderr)
    print("declare the hook in the emitting module's hooksEmitted array.", file=sys.stderr)
    for mod, hook in unknown_hooks:
        print(f"  {mod}: {hook}", file=sys.stderr)
    sys.exit(1)

if violations:
    print(f"ERROR: {len(violations)} module file(s) reach into core internals (@/core/lib, @/core/components).", file=sys.stderr)
    print("Modules must use the SDK (@/core/sdk*). Run:", file=sys.stderr)
    print("  npx tsx scripts/migrate-module-imports.ts module-sources", file=sys.stderr)
    for v in violations[:10]:
        print(f"  {v}", file=sys.stderr)
    if len(violations) > 10:
        print(f"  ... and {len(violations) - 10} more", file=sys.stderr)
    sys.exit(1)

index = {
    "version": "1.0.0",
    "updated": datetime.date.today().isoformat(),
    "updatedAt": UPDATED_AT,
    "modules": modules,
}
with open(os.path.join(OUTPUT_DIR, "index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, indent=2, ensure_ascii=False)
print(f"Index: {len(modules)} modules, {len(emitted_by)} hooks emitted, {len(listened_by)} listener(s)")
PYEOF

echo "Built $count ZIPs"
