#!/bin/bash
# Build marketplace ZIPs from module-sources/
# Usage: bash scripts/build-marketplace.sh
#
# Preserves runtime metadata (downloads, rating, ratingCount) across rebuilds
# by reading the existing index.json first and merging.

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

# Regenerate index.json from module.json files, preserving runtime metadata
UPDATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - <<PYEOF
import json, os, datetime

SOURCES_DIR = "$SOURCES_DIR"
OUTPUT_DIR = "$OUTPUT_DIR"
UPDATED_AT = "$UPDATED_AT"

# Load existing index.json (if any) to preserve downloads / ratings
existing_by_id = {}
existing_path = os.path.join(OUTPUT_DIR, "index.json")
if os.path.isfile(existing_path):
    try:
        with open(existing_path) as f:
            existing = json.load(f)
            for m in existing.get("modules", []):
                existing_by_id[m["id"]] = m
    except Exception:
        existing_by_id = {}

CATEGORY_MAP = {
    "store": "commerce", "stripe-gateway": "commerce", "paypal-gateway": "commerce",
    "credits": "commerce", "currency": "commerce", "leaderboard": "commerce",
    "vote": "commerce", "wheel": "commerce", "discord-widget": "commerce",
    "forum": "community", "blog": "community", "changelog": "community",
    "suggestions": "community",
    "analytics": "management", "announcements": "management",
    "cookie-consent": "management", "custom-forms": "management",
    "custom-pages": "management", "data-tools": "management",
    "discord-auth": "management", "discord-integration": "management",
    "email-system": "management", "google-auth": "management",
    "help-center": "management", "notifications": "management",
    "popups": "management", "resend-provider": "management",
    "security": "management", "tickets": "management",
    "webhook-logs": "management", "two-factor-auth": "management",
    "servers": "gaming", "player-profiles": "gaming",
    "punishments": "gaming", "downloads": "gaming",
}

modules = []
for name in sorted(os.listdir(SOURCES_DIR)):
    manifest_path = os.path.join(SOURCES_DIR, name, "module.json")
    if not os.path.isfile(manifest_path):
        continue
    with open(manifest_path) as f:
        m = json.load(f)

    cat = CATEGORY_MAP.get(name, "content")

    # Derive tags from manifest (tags field or category fallback)
    manifest_tags = m.get("tags")
    if isinstance(manifest_tags, list) and manifest_tags:
        tags = [str(t) for t in manifest_tags]
    else:
        tags = [cat] if cat else ["uncategorized"]

    # Preserve runtime metadata across rebuilds
    prev = existing_by_id.get(m["id"], {})

    modules.append({
        "id": m["id"],
        "name": m["name"],
        "description": m.get("description", ""),
        "version": m.get("version", "1.0.0"),
        "author": m.get("author", "uxwVend"),
        "icon": m.get("icon", "Package"),
        "category": cat,
        "verified": True,
        "downloads": int(prev.get("downloads", 0) or 0),
        "rating": prev.get("rating") if prev.get("rating") is not None else None,
        "ratingCount": int(prev.get("ratingCount", 0) or 0),
        "updatedAt": UPDATED_AT,
        "screenshots": prev.get("screenshots", []) or [],
        "tags": tags,
        "zip": f"{name}.zip",
        "dependencies": m.get("dependencies", []),
        "stats": {
            "publicRoutes": len(m.get("routes", [])),
            "adminRoutes": len(m.get("adminRoutes", [])),
            "apiRoutes": len(m.get("api", [])),
            "widgets": len(m.get("widgets", [])),
        },
    })

index = {
    "version": "1.0.0",
    "updated": datetime.date.today().isoformat(),
    "updatedAt": UPDATED_AT,
    "modules": modules,
}
with open(os.path.join(OUTPUT_DIR, "index.json"), "w") as f:
    json.dump(index, f, indent=2)
print(f"Index: {len(modules)} modules")
PYEOF

echo "Built $count ZIPs"
