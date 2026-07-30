#!/usr/bin/env bash
set -euo pipefail
rm -rf dist
mkdir -p dist
base64 -d site.tar.gz.b64 | tar -xzf - -C dist
# Fail the build if critical files are missing.
test -f dist/index.html
test -f dist/assets/config.js
test -f dist/assets/api.js
test -f dist/_headers
grep -q '2026-07-30-v6-final' dist/assets/config.js
grep -q 'AKfycbzWYTf9K_XyEfo1CD4Pshg18ANH5_zhOsTnyiFhKTwbDgs17ZOXqLgAxKrvO7TA3wYr0w/exec' dist/assets/config.js
printf 'Akiya Rescue static build completed.\n'
