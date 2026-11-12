#!/usr/bin/env bash
# Builds the Gobia Panel image from a signed release directory (the output of scripts/release/build-release.sh).
#
#   deploy/docker/build-image.sh <release dir> [image name]
#
# The release directory holds release.json and gobia-panel-<version>.tar.gz; the image is tagged
# <image name>:<version> (default gobia-panel). The Dockerfile verifies the signature; this script only stages files.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE="${1:?usage: build-image.sh <release dir> [image name]}"
IMAGE="${2:-gobia-panel}"
VERSION="$(php -r 'echo json_decode(file_get_contents($argv[1]), true)["gobia_version"] ?? "";' "$RELEASE/release.json")"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-z]+(\.[0-9]+)?)?$ ]] || { echo "No valid version in $RELEASE/release.json" >&2; exit 1; }

CONTEXT="$(mktemp -d)"
trap 'rm -rf "$CONTEXT"' EXIT
mkdir -p "$CONTEXT/release" "$CONTEXT/deploy/docker" "$CONTEXT/extensions/gobia-core/src/Updater" "$CONTEXT/.github"
cp "$RELEASE/release.json" "$RELEASE/gobia-panel-$VERSION.tar.gz" "$CONTEXT/release/"
cp "$ROOT/deploy/docker/verify-release.php" "$CONTEXT/deploy/docker/"
cp "$ROOT/extensions/gobia-core/src/Updater/ReleaseSignature.php" "$CONTEXT/extensions/gobia-core/src/Updater/"
cp -r "$ROOT/.github/docker" "$CONTEXT/.github/docker"

docker build -f "$ROOT/deploy/docker/Dockerfile.release" -t "$IMAGE:$VERSION" "$CONTEXT"
echo "Built $IMAGE:$VERSION"
