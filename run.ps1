<#
  PharmaFlow launcher for Windows PowerShell.

  .\run.ps1            install (first time) and start the dev server, then open the presenter view
  .\run.ps1 -Test      run the domain rule tests
  .\run.ps1 -Db        build the sample SQLite database and print its tables
  .\run.ps1 -Build     create a production build

  If scripts are blocked, run once:
    powershell -ExecutionPolicy Bypass -File .\run.ps1
#>
param(
  [switch]$Test,
  [switch]$Db,
  [switch]$Build
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is not installed. Get it from https://nodejs.org (version 22 or newer), then run this again.'
}

if (-not (Test-Path -LiteralPath 'node_modules')) {
  Write-Host 'Installing dependencies (first run only)...' -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
}

if ($Test)  { npm test;             exit $LASTEXITCODE }
if ($Db)    { npm run db:sample;    exit $LASTEXITCODE }
if ($Build) { npm run build;        exit $LASTEXITCODE }

$url = 'http://localhost:5173/presenter'
Write-Host "Starting PharmaFlow. Opening $url" -ForegroundColor Green
Write-Host 'Tabs: /customer  /chemist  /rider  /admin  /presenter   (Ctrl+C to stop)' -ForegroundColor DarkGray

Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 3; Start-Process $u } -ArgumentList $url | Out-Null
npm run dev
