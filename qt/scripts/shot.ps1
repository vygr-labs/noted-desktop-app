# Build the app and take a screenshot of it (dev/testing).
#
#   .\scripts\shot.ps1 out.png                       # default state
#   .\scripts\shot.ps1 out.png '{"view":"todos"}'    # startup UI state (see Main.qml)
#   .\scripts\shot.ps1 out.png -Demo                 # the sample notes in personal/qt-demo

param(
    [Parameter(Mandatory = $true)][string]$Out,
    [string]$State = '',
    [int]$Delay = 2500,
    [switch]$NoBuild,
    [switch]$Demo
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $NoBuild) {
    & (Join-Path $PSScriptRoot 'build.ps1') noted | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "build failed"; exit 1 }
}
$env:PATH = "C:\Qt\6.11.1\msvc2022_64\bin;$env:PATH"
$argv = @('--screenshot', $Out, '--screenshot-delay', "$Delay")
if ($Demo) { $argv += @('--db', (Join-Path (Split-Path -Parent $root) 'personal\qt-demo\app.sqlite')) }
if ($State) { $argv += @('--state', ('"' + ($State -replace '"', '\"') + '"')) }
$err = [System.IO.Path]::GetTempFileName()
$p = Start-Process -FilePath (Join-Path $root 'build\noted.exe') -ArgumentList $argv -PassThru -Wait -NoNewWindow -RedirectStandardError $err
Get-Content $err | Where-Object { $_ -match 'WARN|CRIT|FATAL|qml' } | Select-Object -First 30
Remove-Item $err
exit $p.ExitCode
