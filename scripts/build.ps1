$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$OutDir = Join-Path $RootDir "dist"
$Pkg = "./cmd/betacliproxyapi"
$LdFlags = "-s -w"

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

function Build-Target {
    param(
        [string]$GoOS,
        [string]$GoArch
    )

    $ext = ""
    if ($GoOS -eq "windows") { $ext = ".exe" }

    $output = Join-Path $OutDir "betacliproxyapi-$GoOS-$GoArch$ext"
    Write-Host "Building $output..."

    $env:GOOS = $GoOS
    $env:GOARCH = $GoArch
    go build -trimpath -ldflags $LdFlags -o $output $Pkg
    if ($LASTEXITCODE -ne 0) { throw "Build failed for $GoOS/$GoArch" }
}

Build-Target -GoOS linux -GoArch amd64
Build-Target -GoOS linux -GoArch arm64
Build-Target -GoOS darwin -GoArch amd64
Build-Target -GoOS darwin -GoArch arm64
Build-Target -GoOS windows -GoArch amd64

Write-Host "Done. Binaries are in $OutDir"
