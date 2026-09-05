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

# ZIPs and index.json are both written by the pass below: an archive is a
# published artifact, so it is written only after the catalog validates, and it
# is written deterministically (see write_zip).
UPDATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - <<PYEOF
import json, os, re, sys, datetime, zipfile

SOURCES_DIR = "$SOURCES_DIR"
OUTPUT_DIR = "$OUTPUT_DIR"
UPDATED_AT = "$UPDATED_AT"

SKIP_FILES = {".DS_Store"}
SKIP_DIRS = {"__MACOSX", "node_modules"}

# The ZIP epoch. 'zip -r' stored each file's mtime and atime, so the bytes of a
# published archive depended on when someone last read the file rather than on
# what the file said: a rebuild after merely opening a module.json produced a
# different artifact, git showed unrelated .zip files as modified in a commit,
# and a fresh clone (where every mtime is checkout time) could not reproduce
# any of them. Traversal order came from readdir, which is not stable either.
ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)
ZIP_MODE = 0o644 << 16
UNIX_CREATOR = 3


def module_files(module_dir):
    """Every packable file, as (absolute path, archive name), sorted by name."""
    out = []
    for root, dirs, files in os.walk(module_dir):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for fn in sorted(files):
            if fn in SKIP_FILES:
                continue
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, module_dir).replace(os.sep, "/")
            out.append((full, rel))
    return sorted(out, key=lambda pair: pair[1])


def write_zip(module_dir, zip_path):
    """Same content, same bytes, on any machine and at any time."""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for full, rel in module_files(module_dir):
            info = zipfile.ZipInfo(rel, date_time=ZIP_EPOCH)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = ZIP_MODE
            info.create_system = UNIX_CREATOR
            with open(full, "rb") as f:
                archive.writestr(info, f.read())


# Read once. Screenshots are curated content and updatedAt is history: both are
# carried across rebuilds rather than regenerated.
previous = {}
previous_index = {}
_existing_path = os.path.join(OUTPUT_DIR, "index.json")
if os.path.isfile(_existing_path):
    try:
        with open(_existing_path, encoding="utf-8") as f:
            previous_index = json.load(f)
        previous = {em["id"]: em for em in previous_index.get("modules", [])}
    except Exception:
        previous = {}

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

    prior = previous.get(m["id"], {})
    screenshots = prior.get("screenshots", []) or []
    version = m.get("version", "1.0.0")

    # updatedAt is shown on the admin modules screen and sorts it. Stamping
    # every module with the build time said all seventy-eight were updated
    # today, every build, and rewrote all seventy-eight lines of index.json
    # whenever any one module changed. A module is updated when its published
    # version changes; otherwise it keeps the date it already had.
    updated_at = prior.get("updatedAt") if prior.get("version") == version else None

    modules.append({
        "id": m["id"],
        "name": m["name"],
        "description": m.get("description", ""),
        "version": version,
        "coreVersion": m.get("coreVersion"),
        "author": m.get("author", "uxwVend"),
        "icon": m.get("icon", "Package"),
        "category": cat,
        "verified": True,
        "updatedAt": updated_at or UPDATED_AT,
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

# A listener on a hook nothing emits never fires, and nothing reports it - not
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

# Only now, with the catalog validated: a module that breaks the SDK boundary
# or listens to a hook nothing emits gets no published archive.
for entry in modules:
    write_zip(os.path.join(SOURCES_DIR, entry["id"]), os.path.join(OUTPUT_DIR, entry["zip"]))

# The catalog was updated when its newest module was, not when the build ran.
catalog_stamp = max((entry["updatedAt"] for entry in modules), default=UPDATED_AT)

index = {
    "version": "1.0.0",
    "updated": catalog_stamp[:10],
    "updatedAt": catalog_stamp,
    "modules": modules,
}
with open(os.path.join(OUTPUT_DIR, "index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, indent=2, ensure_ascii=False)
print(f"Index: {len(modules)} modules, {len(emitted_by)} hooks emitted, {len(listened_by)} listener(s)")
print(f"Built {len(modules)} ZIPs")
PYEOF

