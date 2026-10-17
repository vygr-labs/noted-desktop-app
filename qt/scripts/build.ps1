# Configure (first run only) and build noted with the MSVC + Qt dev shell.
#
#   .\scripts\build.ps1            # build everything
#   .\scripts\build.ps1 noted      # build one target
#   .\scripts\build.ps1 -Test      # build, then run the unit tests

param(
    [string]$Target = '',
    [switch]$Test
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    . (Join-Path $root 'dev-shell.ps1') *> $null
    # CMake writes warnings to stderr; exit codes decide success, not stderr.
    $ErrorActionPreference = 'Continue'
    if (-not (Test-Path (Join-Path $root 'build\build.ninja'))) {
        cmake --preset release
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    if ($Target) { cmake --build build --target $Target } else { cmake --build build }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if ($Test) {
        $env:QT_QPA_PLATFORM = 'offscreen'
        ctest --test-dir build --output-on-failure
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}
