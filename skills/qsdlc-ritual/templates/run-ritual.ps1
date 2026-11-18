<#
.SYNOPSIS
  Scheduler wrapper for one QSDLC ritual. Runs `claude -p` in an isolated worktree, autonomous mode.
.DESCRIPTION
  Exit code follows the run.json terminal-status contract: 0 for done or needs-review, 1 for everything else
  (blocked, declined, failed, partial, or no run.json). Diagnostics go to stderr.
#>
param(
  [Parameter(Mandatory = $true)][string]$Ritual,
  [Parameter(Mandatory = $true)][string]$Root,
  [string]$Worktree = '',
  [string]$QsdlcHome = ''
)

$ErrorActionPreference = 'Stop'

function Write-Log([string]$Message) {
  [Console]::Error.WriteLine("[run-ritual $Ritual] $Message")
}

if ($Ritual -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { Write-Log 'invalid ritual name'; exit 1 }
$Root = (Resolve-Path -LiteralPath $Root).Path
$ritualFile = Join-Path $Root ".qsdlc\rituals\$Ritual.md"
if (-not (Test-Path -LiteralPath $ritualFile)) { Write-Log "missing $ritualFile"; exit 1 }
if (-not (Test-Path -LiteralPath (Join-Path $Root '.qsdlc\factory\policy.md'))) { Write-Log 'missing .qsdlc/factory/policy.md (fail closed)'; exit 1 }

if (-not $QsdlcHome) { $QsdlcHome = $env:QSDLC_HOME }
if (-not $QsdlcHome) { $QsdlcHome = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..')).Path }
$logScript = Join-Path $QsdlcHome 'skills\_shared\scripts\qsdlc-log.mjs'
if (-not (Test-Path -LiteralPath $logScript)) { Write-Log "missing $logScript"; exit 1 }

$date = Get-Date -Format 'yyyy-MM-dd'
$runsDir = Join-Path $Root '.qsdlc\factory\runs'
New-Item -ItemType Directory -Force -Path $runsDir | Out-Null
$seq = (Get-ChildItem -LiteralPath $runsDir -Filter "$date-$Ritual-*.tsv" -ErrorAction SilentlyContinue | Measure-Object).Count + 1
$runId = '{0}-{1}-{2:000}' -f $date, $Ritual, $seq

Push-Location $Root
try {
  $baseSha = (& git rev-parse HEAD).Trim()
  if (-not $Worktree) { $Worktree = Join-Path $Root ".worktrees\$runId" }
  $branch = "qsdlc/auto/$Ritual-$date-{0:000}" -f $seq
  if (-not (Test-Path -LiteralPath $Worktree)) {
    & git worktree add -b $branch $Worktree $baseSha | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Log 'git worktree add failed'; exit 1 }
  }

  $env:QSDLC_MODE = 'autonomous'
  $env:QSDLC_RUN_ID = $runId
  $env:QSDLC_WORKTREE = $Worktree
  $env:QSDLC_BASE_SHA = $baseSha

  & node $logScript start --root $Root --loop $Ritual --run-id $runId
  if ($LASTEXITCODE -ne 0) { Write-Log 'warning: could not write start row' }

  $prompt = "Run QSDLC ritual '$Ritual' in autonomous mode. Run id: $runId. Worktree: $Worktree. " +
    "Read .qsdlc/rituals/$Ritual.md and follow its targetPattern. Obey .qsdlc/factory/policy.md. " +
    "Never merge, never push to the default branch, never ask a question. " +
    "Finish by writing .qsdlc/factory/runs/$runId/run.json with a terminal status."

  Write-Log "starting $runId in $Worktree"
  Push-Location $Worktree
  try { & claude -p $prompt } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { Write-Log "claude exited $LASTEXITCODE" }

  $candidates = @(
    (Join-Path $Worktree ".qsdlc\factory\runs\$runId\run.json"),
    (Join-Path $Root ".qsdlc\factory\runs\$runId\run.json")
  )
  $runJson = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $runJson) { Write-Log 'no run.json written: treating as failed'; exit 1 }
  $status = (Get-Content -LiteralPath $runJson -Raw | ConvertFrom-Json).status
  Write-Log "terminal status: $status"
  if ($status -eq 'done' -or $status -eq 'needs-review') { exit 0 }
  exit 1
} finally {
  Pop-Location
}
