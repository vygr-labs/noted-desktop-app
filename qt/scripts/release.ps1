# Builds a Windows release of noted into qt\dist:
#
#   dist\noted\                 the app and its Qt files (what the installer copies)
#   dist\noted-win-x64.exe      the installer (Inno Setup)
#   dist\noted-update.json      the signed manifest this build's updater reads
#   dist\latest.yml             the Electron build's update feed, so its
#                               installs move to this version
#
#   .\scripts\release.ps1               build everything, publish nothing
#   .\scripts\release.ps1 -Publish      also make a DRAFT GitHub release with
#                                       those files (publish it from GitHub)
#
# Signing needs personal\update-signing.key (see core\tools\release_tool.cpp).

param(
    [switch]$Publish,
    [string]$Notes = '',
    # The Electron build's Mac and Linux installs read latest-mac.yml and
    # latest-linux.yml from the newest release. This version is Windows-only,
    # so the release carries theirs over unchanged and they stay put.
    [string]$CarryFrom = 'v1.2.4'
)

$ErrorActionPreference = 'Stop'
$qt = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent $qt
$key = Join-Path $repo 'personal\update-signing.key'
$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $key)) { throw "No signing key at $key" }
if (-not (Test-Path $iscc)) { throw "Inno Setup 6 isn't installed" }

$version = (Select-String -Path (Join-Path $qt 'CMakeLists.txt') -Pattern '^\s+VERSION (\d+\.\d+\.\d+)').Matches[0].Groups[1].Value
Write-Host "noted $version"

# 1. Build (and test).
& (Join-Path $PSScriptRoot 'build.ps1') -Test
if ($LASTEXITCODE -ne 0) { throw 'Build or tests failed' }
. (Join-Path $qt 'dev-shell.ps1') *> $null
$ErrorActionPreference = 'Stop'

# 2. The app folder.
$dist = Join-Path $qt 'dist'
$app = Join-Path $dist 'noted'
if (Test-Path $app) { Remove-Item $app -Recurse -Force }
New-Item -ItemType Directory -Force $app | Out-Null
Copy-Item (Join-Path $qt 'build\noted.exe') $app
& windeployqt --release --qmldir (Join-Path $qt 'app\qml') --no-translations --no-compiler-runtime (Join-Path $app 'noted.exe') | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'windeployqt failed' }
# The C++ runtime goes next to noted.exe (Microsoft's app-local deployment).
# windeployqt would ship vc_redist.x64.exe instead, which needs an admin to
# run, and this installer is per-user on purpose; without the DLLs a clean
# PC can't start noted at all (MSVCP140.dll was not found).
if (-not $env:VCToolsRedistDir) {
    $env:VCToolsRedistDir = (Get-ChildItem "${env:ProgramFiles}\Microsoft Visual Studio\*\*\VC\Redist\MSVC\*" -Directory |
        Where-Object { $_.Name -match '^\d' } | Sort-Object Name -Descending | Select-Object -First 1).FullName
}
$crt = Get-ChildItem (Join-Path $env:VCToolsRedistDir 'x64') -Directory -Filter 'Microsoft.VC14*.CRT' | Select-Object -First 1
if (-not $crt) { throw "No C++ runtime under $env:VCToolsRedistDir" }
Copy-Item (Join-Path $crt.FullName '*.dll') $app
foreach ($dll in 'msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll') {
    if (-not (Test-Path (Join-Path $app $dll))) { throw "$dll didn't make it into the app folder" }
}

# 3. The installer.
& $iscc /Q "/DVersion=$version" "/DSource=$app" (Join-Path $qt 'packaging\noted.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup failed' }
$exe = Join-Path $dist 'noted-win-x64.exe'
$size = (Get-Item $exe).Length
$sha256 = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLower()
$sha512 = [Convert]::ToBase64String([System.Security.Cryptography.SHA512]::Create().ComputeHash([IO.File]::ReadAllBytes($exe)))
$now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

# 4. The signed manifest for this build's updater.
$unsigned = Join-Path $dist 'noted-update.unsigned.json'
@{ version = $version; file = 'noted-win-x64.exe'; size = $size; sha256 = $sha256; notes = $Notes; published = $now } |
    ConvertTo-Json | ForEach-Object { [IO.File]::WriteAllText($unsigned, $_, (New-Object System.Text.UTF8Encoding $false)) }
& (Join-Path $qt 'build\noted-release.exe') sign $key $unsigned (Join-Path $dist 'noted-update.json')
if ($LASTEXITCODE -ne 0) { throw 'Signing failed' }
Remove-Item $unsigned

# 5. electron-updater's feed: the Electron build reads latest.yml from the
#    latest release and runs whatever installer it names.
@"
version: $version
files:
  - url: noted-win-x64.exe
    sha512: $sha512
    size: $size
path: noted-win-x64.exe
sha512: $sha512
releaseDate: '$now'
"@ | Set-Content -Encoding ascii (Join-Path $dist 'latest.yml')

Write-Host "Built $exe ($([math]::Round($size / 1MB, 1)) MB)"

# 6. A draft release, only when asked.
if ($Publish) {
    gh release download $CarryFrom --repo vygr-labs/noted-desktop-app -p latest-mac.yml -p latest-linux.yml -D $dist --clobber
    if ($LASTEXITCODE -ne 0) { throw "Couldn't fetch the Mac and Linux feeds from $CarryFrom" }
    $assets = @($exe, (Join-Path $dist 'noted-update.json'), (Join-Path $dist 'latest.yml'),
                (Join-Path $dist 'latest-mac.yml'), (Join-Path $dist 'latest-linux.yml'))
    gh release create "v$version" @assets --repo vygr-labs/noted-desktop-app --draft --title "noted. v$version" --notes $Notes
    if ($LASTEXITCODE -ne 0) { throw 'gh release create failed' }
    Write-Host "Draft release v$version created. Publish it on GitHub when you're ready."
}
