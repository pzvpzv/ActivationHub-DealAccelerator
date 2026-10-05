#!/usr/bin/env bash
# Publishes the static site to IBM Enterprise GitHub Pages.
#
#   npm run publish:ibm
#
# Enterprise Pages serves a branch rather than a build artifact, so this builds
# locally (current version at the root, each v* tag under /v/<tag>/) and force-pushes
# the result to the gh-pages branch. Nothing but built output goes on that branch.
set -euo pipefail

REMOTE="${PAGES_REMOTE:-ibm}"
BRANCH="${PAGES_BRANCH:-gh-pages}"
OUT="$(mktemp -d)/site"
ROOT="$PWD"

git remote get-url "$REMOTE" >/dev/null || { echo "No '$REMOTE' remote. Add it with: git remote add $REMOTE <url>"; exit 1; }
# Enterprise Pages serves every user from one domain, so the site lives under /<owner>/<repo>/.
OWNER_REPO=$(git remote get-url "$REMOTE" | sed -E 's#.*[:/]([^/]+/[^/]+?)(\.git)?$#\1#')
BASE="${PAGES_BASE:-/$OWNER_REPO/}"
echo "── publishing $OWNER_REPO at $BASE"
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean — commit or stash first so the published site matches a commit."
  exit 1
fi

echo "── building the current version"
VITE_STATIC=1 VITE_BASE="$BASE" VITE_VERSION=latest npx vite build --outDir "$OUT" --emptyOutDir >/dev/null
cp content/catalogue.json "$OUT/catalogue.json"
sed "s#__BASE__#$BASE#" scripts/404.html > "$OUT/404.html"
touch "$OUT/.nojekyll"   # keep Pages from running Jekyll over the build

echo "── building tagged versions"
( cd "$ROOT" && bash scripts/build-versions.sh "$BASE" >/dev/null && cp -r dist/v "$OUT/v" && rm -rf dist )

echo "── publishing to $REMOTE/$BRANCH"
cd "$OUT"
git init -q
git checkout -q -b "$BRANCH"
git add -A
git -c user.email="$(cd "$ROOT" && git config user.email)" -c user.name="$(cd "$ROOT" && git config user.name)" \
    commit -qm "Publish site from $(cd "$ROOT" && git describe --always --dirty) ($(date -u +%Y-%m-%dT%H:%MZ))"
git push -q --force "$(cd "$ROOT" && git remote get-url "$REMOTE")" "$BRANCH:$BRANCH"
echo "published $(find "$OUT/v" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d " ") tagged version(s) plus the current build"
