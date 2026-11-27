#!/usr/bin/env bash
# Visual diff of every Storybook story against a base ref (default: main).
#
#   npm run test:visual [-- --base <ref>] [--fresh] [--open] [--allow-removed]
#
# Exit codes: 0 no changed or removed stories (new is allowed),
#             1 changed or removed stories, 2 infrastructure error.
# See DEVELOPMENT.md ("Visual diff") for what it does and what it cannot see.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_REF="main"
FRESH=0
OPEN=0
ALLOW_REMOVED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE_REF="${2:-}"; shift 2 ;;
    --fresh) FRESH=1; shift ;;
    --open) OPEN=1; shift ;;
    --allow-removed) ALLOW_REMOVED=1; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

CACHE_ROOT="$ROOT/.visual-cache"
TMP_DIRS=()
WORKTREES=()
SAVED_CODE=""
START_TIME=$(date +%s)

die() { echo "test:visual: $*" >&2; exit 2; }
log() { echo "[test:visual] $*"; }

cleanup() {
  local wt dir
  for wt in ${WORKTREES[@]+"${WORKTREES[@]}"}; do
    git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || true
  done
  for dir in ${TMP_DIRS[@]+"${TMP_DIRS[@]}"}; do
    rm -rf "$dir"
  done
  git -C "$ROOT" worktree prune >/dev/null 2>&1 || true
}
# Ctrl-C while the report is open (the code is already saved) returns that code.
on_signal() { cleanup; exit "${SAVED_CODE:-130}"; }
trap cleanup EXIT
trap on_signal INT TERM

# ---------------------------------------------------------------- 1. preflight
docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop and run again."

BASE_SHA="$(git rev-parse --verify --quiet "${BASE_REF}^{commit}")" \
  || die "Base ref '$BASE_REF' does not resolve. Pass an existing branch, tag or SHA with --base."
BRANCH_SHA="$(git rev-parse HEAD)"

[ -d node_modules/@playwright/test ] || die "@playwright/test is not installed. Run npm ci."
PW_VERSION="$(node -p "require('./node_modules/@playwright/test/package.json').version")"
PW_PINNED="$(node -p "require('./package.json').devDependencies['@playwright/test']")"
[ "$PW_VERSION" = "$PW_PINNED" ] \
  || die "Installed @playwright/test ($PW_VERSION) differs from the pinned version ($PW_PINNED). Run npm ci."

if [ -n "$(git status --porcelain)" ]; then DIRTY="dirty (uncommitted changes are included)"; else DIRTY="clean"; fi
ARCH="$(uname -m)"
log "base    $BASE_REF @ ${BASE_SHA:0:10}"
log "branch  $(git rev-parse --abbrev-ref HEAD) @ ${BRANCH_SHA:0:10} ($DIRTY)"
log "playwright $PW_VERSION on $ARCH"
if [ "$BASE_REF" = "main" ] && git rev-parse --verify --quiet origin/main >/dev/null; then
  BEHIND="$(git rev-list --count main..origin/main)"
  if [ "$BEHIND" -gt 0 ]; then
    echo "WARNING: local main is $BEHIND commit(s) behind origin/main. Update it, or use --base origin/main."
  fi
fi

# --------------------------------------------------------------- 2. cache key
hash_stdin() { shasum -a 256 | cut -c1-16; }
LOCK_HASH="$(git show "${BASE_SHA}:package-lock.json" | hash_stdin)"
VISUAL_HASH="$(find visual -type f | sort | xargs shasum -a 256 | hash_stdin)"
KEY="$(printf '%s %s %s %s %s' "$BASE_SHA" "$PW_VERSION" "$ARCH" "$LOCK_HASH" "$VISUAL_HASH" | hash_stdin)"
CACHE="$CACHE_ROOT/$KEY"
mkdir -p "$CACHE_ROOT" visual-report

export PLAYWRIGHT_VERSION="$PW_VERSION"
export HOST_UID="$(id -u)" HOST_GID="$(id -g)"
export VISUAL_WORK="$CACHE_ROOT/work"
mkdir -p "$VISUAL_WORK"

run_pass() { # run_pass <base|branch> <snapshots dir> <extra playwright args>
  VISUAL_PASS="$1" VISUAL_SNAPSHOTS="$2" PLAYWRIGHT_ARGS="$3" \
    VISUAL_BASE_BUILD="$BASE_BUILD" VISUAL_BRANCH_BUILD="$BRANCH_BUILD" \
    docker compose -f docker-compose.visual.yml run --rm playwright \
    >"$CACHE_ROOT/pass-$1.log" 2>&1
}

# Prints a summary file's errors and returns 1 if there are any.
has_errors() {
  node -e '
    const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    for (const e of s.errors) console.error("  " + e.id + " (" + e.viewport + "): " + e.message);
    process.exit(s.errors.length ? 0 : 1);
  ' "$1"
}

export STORYBOOK_DISABLE_TELEMETRY=1

# ----------------------------------------------- 3. base build (on a cache miss)
if [ "$FRESH" -eq 0 ] && [ -f "$CACHE/.complete" ]; then
  log "cache hit ($KEY): reusing the base build and base images"
  BASE_BUILD="$CACHE/build"
  SNAPSHOTS="$CACHE/snapshots"
else
  [ "$FRESH" -eq 1 ] && log "--fresh: ignoring the cache"
  rm -rf "$CACHE" "$CACHE.partial"
  mkdir -p "$CACHE.partial/snapshots"
  TMP_DIRS+=("$CACHE.partial")

  WT_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/visual-base.XXXXXX")"
  TMP_DIRS+=("$WT_PARENT")
  WT="$WT_PARENT/base"
  git worktree add --detach "$WT" "$BASE_SHA" >/dev/null 2>&1 || die "Could not create a worktree for $BASE_REF."
  WORKTREES+=("$WT")

  log "installing the base dependencies (npm ci) and building its Storybook"
  # The base uses its own lockfile (a refactor that changes dependencies must
  # not change the baseline) and its own .storybook config.
  (cd "$WT" && npm ci --ignore-scripts --no-audit --no-fund >/dev/null 2>&1) \
    || die "npm ci failed in the base worktree."
  (cd "$WT" && npx storybook build --output-dir "$CACHE.partial/build" --quiet >/dev/null 2>&1) \
    || die "Storybook build failed for the base ref $BASE_REF."
  git worktree remove --force "$WT" >/dev/null 2>&1 || true

  BASE_BUILD="$CACHE.partial/build"
  SNAPSHOTS="$CACHE.partial/snapshots"
fi

# ----------------------------------------------------------- 4. branch build
BRANCH_BUILD="$CACHE_ROOT/branch-build"
rm -rf "$BRANCH_BUILD"
log "building the working tree's Storybook"
npx storybook build --output-dir "$BRANCH_BUILD" --quiet >/dev/null 2>&1 \
  || die "Storybook build failed for the working tree."

# ------------------------------------------------- 5/6. shoot (two passes)
rm -rf visual-report
mkdir -p visual-report

if [ -d "$CACHE.partial" ]; then
  log "pass 1: shooting the base build (each story twice)"
  run_pass base "$SNAPSHOTS" "--update-snapshots"
  if [ ! -f visual-report/summary-base.json ]; then
    { tail -n 20 "$CACHE_ROOT/pass-base.log" >&2; die "Pass 1 wrote no summary-base.json (log: .visual-cache/pass-base.log)."; }
  fi
  if has_errors visual-report/summary-base.json; then
    die "Pass 1 had errors (above). Fix the base stories first."
  fi
  rm -f visual-report/summary-base.json
  mv "$CACHE.partial" "$CACHE" && touch "$CACHE/.complete"
  BASE_BUILD="$CACHE/build"
  SNAPSHOTS="$CACHE/snapshots"
  rm -rf "$CACHE_ROOT/work/test-results"
fi

log "pass 2: shooting the working tree and comparing"
run_pass branch "$SNAPSHOTS" ""

# ------------------------------------------------------------------ 7. result
SUMMARY="visual-report/summary.json"
[ -f "$SUMMARY" ] || { tail -n 20 "$CACHE_ROOT/pass-branch.log" >&2; die "Playwright wrote no $SUMMARY (log: .visual-cache/pass-branch.log)."; }
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$SUMMARY" 2>/dev/null \
  || die "$SUMMARY is not valid JSON."

ELAPSED=$(( $(date +%s) - START_TIME ))
node -e '
  const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const list = (title, items, fmt) => {
    if (items.length) console.log(title + "\n" + items.map(i => "  " + fmt(i)).join("\n"));
  };
  console.log("");
  console.log("Visual diff: " + s.stories + " stories, " + s.compared + " shots compared");
  console.log("  changed " + s.changed.length + ", new " + s.added.length +
    ", removed " + s.removed.length + ", unstable " + s.unstable.length +
    ", errors " + s.errors.length);
  list("Changed:", s.changed, i => i.id + " (" + i.viewport + ")");
  list("Removed:", s.removed, i => i);
  list("New:", s.added, i => i);
  list("Unstable (two base shots differed, not counted as changed):", s.unstable, i => i.id + " (" + i.viewport + ")");
  list("Errors:", s.errors, i => i.id + " (" + i.viewport + "): " + i.message);
' "$SUMMARY"
echo "  base ${BASE_SHA:0:10}, ${ELAPSED}s"

CODE="$(node -e '
  const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const allowRemoved = process.argv[2] === "1";
  if (s.errors.length) console.log(2);
  else if (s.changed.length || (!allowRemoved && s.removed.length)) console.log(1);
  else console.log(0);
' "$SUMMARY" "$ALLOW_REMOVED")"
SAVED_CODE="$CODE"

# The report server needs a host browser, so it runs here, not in the container.
if { [ "$CODE" -ne 0 ] && [ -t 1 ]; } || [ "$OPEN" -eq 1 ]; then
  if [ -f visual-report/index.html ]; then
    log "opening the report (Ctrl-C closes it)"
    npx playwright show-report visual-report || true
  fi
fi
exit "$SAVED_CODE"
