#!/usr/bin/env bash
# Scheduler wrapper for one QSDLC ritual (cron, launchd, CI). Autonomous mode, isolated worktree.
# Usage: run-ritual.sh <ritual-name> <project-root> [worktree] [qsdlc-home]
# Exit code: 0 for run.json status done or needs-review, 1 for everything else. Diagnostics go to stderr.
set -u

ritual="${1:-}"
root="${2:-}"
worktree="${3:-}"
qsdlc_home="${4:-${QSDLC_HOME:-$(cd "$(dirname "$0")/../../.." && pwd)}}"

log() { printf '[run-ritual %s] %s\n' "$ritual" "$*" >&2; }

case "$ritual" in
  ''|*[!a-z0-9-]*) log 'invalid ritual name'; exit 1 ;;
esac
[ -d "$root" ] || { log "no such project root: $root"; exit 1; }
root="$(cd "$root" && pwd)"
[ -f "$root/.qsdlc/rituals/$ritual.md" ] || { log "missing .qsdlc/rituals/$ritual.md"; exit 1; }
[ -f "$root/.qsdlc/factory/policy.md" ] || { log 'missing .qsdlc/factory/policy.md (fail closed)'; exit 1; }
log_script="$qsdlc_home/skills/_shared/scripts/qsdlc-log.mjs"
[ -f "$log_script" ] || { log "missing $log_script"; exit 1; }

date_str="$(date +%Y-%m-%d)"
runs_dir="$root/.qsdlc/factory/runs"
mkdir -p "$runs_dir"
seq=$(( $(ls "$runs_dir" 2>/dev/null | grep -c "^$date_str-$ritual-.*\.tsv$") + 1 ))
seq_pad="$(printf '%03d' "$seq")"
run_id="$date_str-$ritual-$seq_pad"

cd "$root" || exit 1
base_sha="$(git rev-parse HEAD)" || { log 'not a git repo'; exit 1; }
[ -n "$worktree" ] || worktree="$root/.worktrees/$run_id"
branch="qsdlc/auto/$ritual-$date_str-$seq_pad"
if [ ! -d "$worktree" ]; then
  git worktree add -b "$branch" "$worktree" "$base_sha" >/dev/null || { log 'git worktree add failed'; exit 1; }
fi

export QSDLC_MODE=autonomous QSDLC_RUN_ID="$run_id" QSDLC_WORKTREE="$worktree" QSDLC_BASE_SHA="$base_sha"

node "$log_script" start --root "$root" --loop "$ritual" --run-id "$run_id" || log 'warning: could not write start row'

prompt="Run QSDLC ritual '$ritual' in autonomous mode. Run id: $run_id. Worktree: $worktree. Read .qsdlc/rituals/$ritual.md and follow its targetPattern. Obey .qsdlc/factory/policy.md. Never merge, never push to the default branch, never ask a question. Finish by writing .qsdlc/factory/runs/$run_id/run.json with a terminal status."

log "starting $run_id in $worktree"
(cd "$worktree" && claude -p "$prompt") || log "claude exited nonzero"

run_json=""
for c in "$worktree/.qsdlc/factory/runs/$run_id/run.json" "$root/.qsdlc/factory/runs/$run_id/run.json"; do
  [ -f "$c" ] && { run_json="$c"; break; }
done
[ -n "$run_json" ] || { log 'no run.json written: treating as failed'; exit 1; }

status="$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).status))" "$run_json")"
log "terminal status: $status"
case "$status" in done|needs-review) exit 0 ;; *) exit 1 ;; esac
