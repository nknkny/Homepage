#!/usr/bin/env bash
set -euo pipefail

B64_FILE="$(mktemp)"
TAR_FILE="$(mktemp)"
trap 'rm -f "$B64_FILE" "$TAR_FILE"' EXIT

cat site.tar.gz.b64.part-* | tr -d '[:space:]' > "$B64_FILE"
printf '%s  %s\n' '8060787d61de8f6a7261eec49befa81e8c668b610a84a979c1d871cafab3a308' "$B64_FILE" | sha256sum -c -
base64 -d "$B64_FILE" > "$TAR_FILE"
printf '%s  %s\n' '37d3b64277b57b7584657b6200193a03d422559353fe6a0bd766d5e572b5a7c6' "$TAR_FILE" | sha256sum -c -

tar -tzf "$TAR_FILE" >/dev/null
rm -rf dist
mkdir -p dist
tar -xzf "$TAR_FILE" -C dist

# Critical deployment files and production connection.
test -f dist/index.html
test -f dist/register.html
test -f dist/member-login.html
test -f dist/member.html
test -f dist/request.html
test -f dist/assets/config.js
test -f dist/assets/api.js
test -f dist/assets/site.js
test -f dist/_headers
test -f dist/robots.txt
test -f dist/sitemap.xml
grep -q '2026-07-30-v6-final' dist/assets/config.js
grep -q 'AKfycbzWYTf9K_XyEfo1CD4Pshg18ANH5_zhOsTnyiFhKTwbDgs17ZOXqLgAxKrvO7TA3wYr0w/exec' dist/assets/config.js

printf 'Akiya Rescue static build completed and checksums verified.\n'
