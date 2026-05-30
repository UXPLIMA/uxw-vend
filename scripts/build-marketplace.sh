#!/bin/bash
# Build marketplace ZIPs from module-sources/
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

# Regenerate index.json from module.json files, preserving runtime metadata
UPDATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - <<PYEOF
import json, os, datetime

SOURCES_DIR = "$SOURCES_DIR"
OUTPUT_DIR = "$OUTPUT_DIR"
UPDATED_AT = "$UPDATED_AT"

# Categories mirror the README module table. Keys are real module ids
# (= module-sources/<id> directory names). Anything not listed falls back
# to "content".
CATEGORY_MAP = {
    # Commerce
    "store": "commerce", "stripe-gateway": "commerce", "paypal-gateway": "commerce",
    "credits": "commerce", "currency": "commerce", "vote": "commerce",
    "wheel": "commerce", "leaderboard": "commerce",
    # Community
    "blog": "community", "forum": "community", "suggestions": "community",
    "changelog": "community", "in-app-notifications": "community",
    "referral": "community", "trophies": "community",
    # Gaming
    "servers": "gaming", "player-profiles": "gaming",
    "punishments": "gaming", "downloads": "gaming",
    # Management
    "tickets": "management", "help-center": "management", "staff": "management",
    "announcements": "management", "popups": "management",
    "login-protection": "management", "two-factor-auth": "management",
    # Content
    "slider": "content", "custom-pages": "content", "custom-forms": "content",
    "email-templates": "content", "cookie-consent": "content", "seo": "content",
    # Integration
    "discord-auth": "integration", "discord-integration": "integration",
    "discord-widget": "integration", "google-auth": "integration",
    "google-analytics": "integration", "cloudflare-r2": "integration",
    "cloudflare-turnstile": "integration", "resend-provider": "integration",
    "csv-import-export": "integration", "webhook-logs": "integration",
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

    # Load existing screenshots (non-generated content) to preserve across rebuilds
    existing_path = os.path.join(OUTPUT_DIR, "index.json")
    screenshots = []
    if os.path.isfile(existing_path):
        try:
            with open(existing_path) as f:
                existing = json.load(f)
                for em in existing.get("modules", []):
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
        "author": m.get("author", "uxwVend"),
        "icon": m.get("icon", "Package"),
        "category": cat,
        "verified": True,
        "updatedAt": UPDATED_AT,
        "screenshots": screenshots,
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
