#!/usr/bin/env bash
# Builds every v* tag into dist/v/<tag>/ and writes an index of them.
# Each tag is built from its own commit, with its own catalogue, so an old
# iteration keeps showing what it actually looked like.
set -euo pipefail
REPO="${1:?repository name required}"
ROOT="$PWD"
TAGS=$(git tag -l 'v*' --sort=-creatordate)
[ -z "$TAGS" ] && { echo "no v* tags yet"; exit 0; }

mkdir -p dist/v
ROWS=""
for TAG in $TAGS; do
  echo "── building $TAG"
  WORK="/tmp/version-$TAG"
  rm -rf "$WORK"
  git worktree add --force --detach "$WORK" "$TAG" >/dev/null
  ln -s "$ROOT/node_modules" "$WORK/node_modules"
  ( cd "$WORK" && VITE_STATIC=1 VITE_BASE="/$REPO/v/$TAG/" VITE_VERSION="$TAG" npx vite build --outDir dist >/dev/null )
  mkdir -p "dist/v/$TAG"
  cp -r "$WORK/dist/." "dist/v/$TAG/"
  cp "$WORK/content/catalogue.json" "dist/v/$TAG/catalogue.json"
  # deep links fall back to the repository-root 404, which routes back into this version
  DATE=$(git log -1 --format=%ad --date=format:'%d %b %Y' "$TAG")
  SUBJECT=$(git tag -l --format='%(contents:subject)' "$TAG")
  [ -z "$SUBJECT" ] && SUBJECT=$(git log -1 --format=%s "$TAG")
  ROWS="$ROWS<li><a href=\"./$TAG/\">$TAG</a><span>$DATE — $SUBJECT</span></li>"
  git worktree remove --force "$WORK" >/dev/null
done

cat > dist/v/index.html <<HTML
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AIIS Activation Hub — versions</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
 body{font-family:'IBM Plex Sans',sans-serif;margin:0;background:#fff;color:#161616}
 main{max-width:40rem;margin:0 auto;padding:4rem 1rem}
 h1{font-size:1.75rem;font-weight:400;margin:0 0 .5rem}
 p{color:#525252;margin:0 0 2rem}
 ul{list-style:none;padding:0;margin:0;border-top:1px solid #e0e0e0}
 li{display:flex;flex-wrap:wrap;gap:.25rem 1rem;align-items:baseline;padding:1rem 0;border-bottom:1px solid #e0e0e0}
 a{color:#0f62fe;font-weight:600;text-decoration:none}a:hover{text-decoration:underline}
 span{color:#525252;font-size:.875rem}
</style></head>
<body><main>
<h1>AIIS Activation Hub — versions</h1>
<p>Each iteration stays available at its own address. <a href="../">Open the current version</a>.</p>
<ul>$ROWS</ul>
</main></body></html>
HTML
echo "built $(echo "$TAGS" | wc -w | tr -d ' ') version(s)"
