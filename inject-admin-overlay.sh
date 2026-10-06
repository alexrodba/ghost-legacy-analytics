#!/usr/bin/env bash
#
# Injects (or refreshes) the legacy-analytics admin overlay <script> in Ghost's
# admin index.html. The overlay logic lives at (and is served from)
# /assets/js/legacy-admin-analytics.js in your active theme.
#
# The tag gets a ?v=<hash> cache-buster derived from the JS file, so re-running
# this after you change the JS forces browsers/Cloudflare to fetch the new file.
#
# A `ghost update` rebuilds the admin and wipes the tag, so RE-RUN this after
# every Ghost upgrade too. Safe to run repeatedly — it removes any prior tag
# first and backs up index.html.
#
# Usage (on the server):
#   bash inject-admin-overlay.sh [ADMIN_INDEX_HTML] [THEME_JS_FILE]
#
# Defaults assume a standard Ghost-CLI install with the active theme folder
# literally named "theme". Adjust the two paths for your setup.
#
set -euo pipefail

INDEX="${1:-/var/www/ghost/current/core/built/admin/index.html}"
ASSET="${2:-/var/www/ghost/content/themes/theme/assets/js/legacy-admin-analytics.js}"

if [ ! -f "$INDEX" ]; then
    echo "error: admin index.html not found at $INDEX" >&2
    exit 1
fi

VER="1"
if [ -f "$ASSET" ]; then
    VER=$(md5sum "$ASSET" | cut -c1-10)
fi

# data-cfasync="false" keeps Cloudflare Rocket Loader from rewriting the tag.
TAG="<script src=\"/assets/js/legacy-admin-analytics.js?v=$VER\" data-cfasync=\"false\" defer></script>"

cp -a "$INDEX" "$INDEX.bak-$(date +%Y%m%d-%H%M%S)"

# Drop any previous injection, then insert the current one before </body>.
perl -0pi -e 's#\s*<script src="/assets/js/legacy-admin-analytics\.js[^"]*"[^>]*></script>##g' "$INDEX"
perl -0pi -e "s#</body>#  $TAG\n  </body>#" "$INDEX"

echo "injected into $INDEX"
echo "  $TAG"
