#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT_DIR="$ROOT_DIR/dist"

mkdir -p "$OUT_DIR"

LDFLAGS="-s -w"
PKG="./cmd/betacliproxyapi"

build_target() {
  local goos="$1"
  local goarch="$2"
  local ext=""
  if [[ "$goos" == "windows" ]]; then
    ext=".exe"
  fi

  local output="$OUT_DIR/betacliproxyapi-${goos}-${goarch}${ext}"
  echo "Building ${output}..."
  GOOS="$goos" GOARCH="$goarch" go build -trimpath -ldflags "$LDFLAGS" -o "$output" "$PKG"
}

build_target linux amd64
build_target linux arm64
build_target darwin amd64
build_target darwin arm64
build_target windows amd64

echo "Done. Binaries are in $OUT_DIR"
