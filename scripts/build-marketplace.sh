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

# Regenerate index.json from module.json files
python3 -c "
import json, os

modules = []
for name in sorted(os.listdir('$SOURCES_DIR')):
    manifest_path = os.path.join('$SOURCES_DIR', name, 'module.json')
    if not os.path.isfile(manifest_path):
        continue
    with open(manifest_path) as f:
        m = json.load(f)

    cat = 'content'
    if name in ['store','stripe-gateway','paypal-gateway','credits','currency','leaderboard','vote','wheel','discord-widget']:
        cat = 'commerce'
    elif name in ['forum','blog','changelog','suggestions']:
        cat = 'community'
    elif name in ['analytics','announcements','cookie-consent','custom-forms','custom-pages','data-tools','discord-auth','discord-integration','email-system','google-auth','help-center','notifications','popups','resend-provider','security','tickets','webhook-logs','two-factor-auth']:
        cat = 'management'
    elif name in ['servers','player-profiles','punishments','downloads']:
        cat = 'gaming'

    modules.append({
        'id': m['id'],
        'name': m['name'],
        'description': m.get('description', ''),
        'version': m.get('version', '1.0.0'),
        'author': m.get('author', 'uxwVend'),
        'icon': m.get('icon', 'Package'),
        'category': cat,
        'verified': True,
        'downloads': 0,
        'zip': f'{name}.zip',
        'dependencies': m.get('dependencies', []),
        'stats': {
            'publicRoutes': len(m.get('routes', [])),
            'adminRoutes': len(m.get('adminRoutes', [])),
            'apiRoutes': len(m.get('api', [])),
            'widgets': len(m.get('widgets', []))
        }
    })

index = {'version': '1.0.0', 'updated': '$(date +%Y-%m-%d)', 'modules': modules}
with open('$OUTPUT_DIR/index.json', 'w') as f:
    json.dump(index, f, indent=2)
print(f'Index: {len(modules)} modules')
"

echo "Built $count ZIPs"
