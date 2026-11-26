#!/bin/sh
# Refresh the repo from the workspace: copy the skill and the demo film into the repo.
# usage: sh build_site.sh   then commit and push. Vercel deploys site/ on every push to main
# and builds the skill zip there (tools/build_zip.cjs, run by site/vercel.json).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIVE="$HERE/../.claude/skills/animation-explainer-creator"   # the copy Claude Code uses in this workspace
SKILL="$HERE/skill/animation-explainer-creator"               # the copy published in the repo
SITE="$HERE/site"
DEMO="$HERE/demo-pendulum"                                    # local demo source (not in the repo)

# 1. skill: the workspace copy is the source of truth when it is present
# (copy over, never delete: a file removed from the skill is reported here and removed by hand)
if [ -d "$LIVE" ]; then
  mkdir -p "$SKILL"
  cp -R "$LIVE/." "$SKILL/"
  STALE=$(diff -rq "$LIVE" "$SKILL" 2>/dev/null | grep "^Only in $SKILL" | grep -v -e __pycache__ -e '.DS_Store' -e '.tools' || true)
  [ -n "$STALE" ] && printf 'files in the repo copy that the skill no longer has (remove them):\n%s\n' "$STALE"
fi

# 2. demo film (without work files) and its MP4, when the local demo source is present
if [ -d "$DEMO" ]; then
  mkdir -p "$SITE/demo/audio"
  cp "$DEMO/index.html" "$DEMO/film.js" "$DEMO/film.css" "$DEMO/scenes.js" "$DEMO/narration.js" "$SITE/demo/"
  cp "$DEMO"/audio/*.mp3 "$SITE/demo/audio/"
  cp "$DEMO/export/pendulum.mp4" "$DEMO/export/pendulum.srt" "$SITE/demo/"
fi
echo "repo refreshed: skill $(du -sh "$SKILL" | cut -f1), site $(du -sh "$SITE" | cut -f1). Next: git add -A, commit, push."
