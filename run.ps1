<#
  PharmaFlow launcher (Windows PowerShell 5.1 or newer). Keep this file ASCII-only.

  .\run.ps1               start the app in the background and open it in your browser
  .\run.ps1 -Foreground   run the dev server in this window (Ctrl+C to stop)
  .\run.ps1 -Stop         stop the background app
  .\run.ps1 -Status       say whether the app is running
  .\run.ps1 -Test         run the tests
  .\run.ps1 -Db           build the sample SQLite database and print its tables
  .\run.ps1 -Build        typecheck and create a production build
  Add -NoBrowser to any start command to skip opening the browser.

  The same options are available from anywhere through the "pharmaflow" command
  (see pharmaflow.cmd): pharmaflow, pharmaflow dev, pharmaflow stop, pharmaflow status,
  pharmaflow test, pharmaflow db, pharmaflow build.

  If PowerShell blocks scripts, use pharmaflow.cmd or run:
    powershell -ExecutionPolicy Bypass -File .\run.ps1
#>
param(
  [switch]$Foreground,
  [switch]$Stop,
  [switch]$Status,
  [switch]$Test,
  [switch]$Db,
  [switch]$Build,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$Port = 5173
$Url = "http://localhost:$Port/presenter"
$LogDir = Join-Path $PSScriptRoot 'data'
$LogFile = Join-Path $LogDir 'dev-server.log'

# True when something on the port answers with the PharmaFlow page. This is an HTTP check on purpose:
# Vite may listen on IPv6 only ([::1]), and netstat / Get-NetTCPConnection report that unreliably.
function Test-PharmaFlowUp {
  try {
    $r = Invoke-WebRequest -UseBasicParsing "http://localhost:$Port/" -TimeoutSec 2
    return ($r.StatusCode -eq 200 -and $r.Content -match 'PharmaFlow')
  } catch {
    return $false
  }
}

# The dev server processes that were started from THIS folder (never anything else).
function Get-OurServerProcesses {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -like "*$PSScriptRoot*" -and
      $_.CommandLine -like '*vite*' -and
      $_.CommandLine -like "*--port $Port*" -and
      $_.CommandLine -notlike '* preview *'
    }
}

if ($Stop) {
  $procs = @(Get-OurServerProcesses)
  if ($procs.Count -gt 0) {
    foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host 'PharmaFlow stopped.' -ForegroundColor Green
    exit 0
  }
  if (Test-PharmaFlowUp) {
    Write-Host "A PharmaFlow server is answering on port $Port but it was not started from this folder, so it was left alone." -ForegroundColor Yellow
    exit 1
  }
  Write-Host 'PharmaFlow is not running.'
  exit 0
}

if ($Status) {
  if (Test-PharmaFlowUp) { Write-Host "PharmaFlow is running at $Url" -ForegroundColor Green; exit 0 }
  Write-Host 'PharmaFlow is not running.  Start it with: pharmaflow'
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is not installed. Get it from https://nodejs.org (version 22 or newer), then run this again.'
}

if (-not (Test-Path -LiteralPath 'node_modules')) {
  Write-Host 'Installing dependencies (first run only, this can take a minute)...' -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
}

if ($Test)  { npm test;          exit $LASTEXITCODE }
if ($Db)    { npm run db:sample; exit $LASTEXITCODE }
if ($Build) { npm run build;     exit $LASTEXITCODE }

# Already running? Just open it.
if (Test-PharmaFlowUp) {
  Write-Host "PharmaFlow is already running at $Url" -ForegroundColor Green
  if (-not $NoBrowser) { Start-Process $Url }
  exit 0
}

if ($Foreground) {
  Write-Host "Starting PharmaFlow in this window. Opening $Url" -ForegroundColor Green
  Write-Host 'Tabs: /customer  /chemist  /rider  /admin  /presenter   (Ctrl+C to stop)' -ForegroundColor DarkGray
  if (-not $NoBrowser) {
    Start-Job -ScriptBlock {
      param($u, $port)
      for ($i = 0; $i -lt 120; $i++) {
        try {
          $r = Invoke-WebRequest -UseBasicParsing "http://localhost:$port/" -TimeoutSec 2
          if ($r.StatusCode -eq 200) { break }
        } catch {
          Start-Sleep -Milliseconds 500
        }
      }
      Start-Process $u
    } -ArgumentList $Url, $Port | Out-Null
  }
  npm run dev -- --port $Port --strictPort
  exit $LASTEXITCODE
}

# Default: run the dev server hidden in the background and give the terminal back.
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$node = (Get-Command node).Source
$vite = Join-Path $PSScriptRoot 'node_modules\vite\bin\vite.js'
Write-Host 'Starting PharmaFlow...' -ForegroundColor Cyan
# The log redirect lives inside the cmd command line (not Start-Process -Redirect*), so the hidden
# server inherits none of this window's handles and the terminal is freed as soon as we exit.
$inner = "`"`"$node`" `"$vite`" --port $Port --strictPort > `"$LogFile`" 2>&1`""
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList "/c $inner" `
  -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru

$ready = $false
for ($i = 0; $i -lt 90; $i++) {
  if ($proc.HasExited) { break }
  if (Test-PharmaFlowUp) { $ready = $true; break }
  Start-Sleep -Milliseconds 400
}

if (-not $ready) {
  Write-Host 'PharmaFlow did not start. Last lines of the log:' -ForegroundColor Red
  if (Test-Path $LogFile) { Get-Content $LogFile -Tail 20 }
  exit 1
}

Write-Host "PharmaFlow is running at $Url" -ForegroundColor Green
Write-Host 'Tabs: /customer  /chemist  /rider  /admin  /presenter' -ForegroundColor DarkGray
Write-Host 'Stop it with: pharmaflow stop' -ForegroundColor DarkGray
if (-not $NoBrowser) { Start-Process $Url }
