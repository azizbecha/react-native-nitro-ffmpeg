#!/bin/bash
set -euo pipefail

# Build FFmpeg for iOS and Android
# Usage: ./scripts/build-ffmpeg.sh [min|full|full-gpl]
# Requires: Xcode (iOS), Android NDK (Android), gas-preprocessor (iOS ARM)

VARIANT="${1:-min}"
FFMPEG_VERSION="7.1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${ROOT_DIR}/build/ffmpeg-${VARIANT}"
OUTPUT_DIR="${ROOT_DIR}/packages/ffmpeg-${VARIANT}"

echo "Building FFmpeg ${FFMPEG_VERSION} (${VARIANT}) ..."

# Common configure flags
COMMON_FLAGS=(
  --disable-programs
  --disable-doc
  --disable-debug
  --enable-pic
  --enable-small
  --enable-cross-compile
  --enable-static
  --disable-shared
)

case "$VARIANT" in
  min)
    EXTRA_FLAGS=(
      --disable-everything
      --enable-demuxer=mov,matroska,avi,flv,mp3,ogg,wav,aac,flac
      --enable-muxer=mp4,matroska,mp3,ogg,wav,flac,image2,mjpeg
      --enable-decoder=h264,hevc,vp8,vp9,aac,mp3,flac,opus,pcm_s16le,mjpeg,png
      --enable-encoder=aac,libmp3lame,flac,opus,pcm_s16le,mjpeg,png
      --enable-parser=h264,hevc,aac,mp3,opus,vp8,vp9
      --enable-protocol=file,pipe
      --enable-filter=scale,aresample,concat,volume,trim,atrim
      --enable-bsf=h264_mp4toannexb,hevc_mp4toannexb,aac_adtstoasc
    )
    ;;
  full)
    EXTRA_FLAGS=(
      --enable-demuxers
      --enable-muxers
      --enable-decoders
      --enable-encoders
      --enable-parsers
      --enable-protocols
      --enable-filters
      --enable-bsfs
    )
    ;;
  full-gpl)
    EXTRA_FLAGS=(
      --enable-gpl
      --enable-demuxers
      --enable-muxers
      --enable-decoders
      --enable-encoders
      --enable-parsers
      --enable-protocols
      --enable-filters
      --enable-bsfs
      --enable-libx264
      --enable-libx265
    )
    ;;
  *)
    echo "Unknown variant: $VARIANT"
    exit 1
    ;;
esac

mkdir -p "$BUILD_DIR"

# Download FFmpeg source
if [ ! -d "${BUILD_DIR}/ffmpeg-${FFMPEG_VERSION}" ]; then
  echo "Downloading FFmpeg ${FFMPEG_VERSION}..."
  curl -L "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" | tar xJ -C "$BUILD_DIR"
fi

FFMPEG_SRC="${BUILD_DIR}/ffmpeg-${FFMPEG_VERSION}"

echo ""
echo "FFmpeg source: ${FFMPEG_SRC}"
echo "Output dir:    ${OUTPUT_DIR}"
echo "Variant:       ${VARIANT}"
echo "Configure flags: ${COMMON_FLAGS[*]} ${EXTRA_FLAGS[*]}"
echo ""
echo "NOTE: Full cross-compilation for iOS and Android requires"
echo "      platform-specific toolchains. This script provides"
echo "      the configuration - see GitHub Actions workflow for"
echo "      the complete CI build pipeline."
echo ""
echo "To build for a specific platform, set PLATFORM=ios or PLATFORM=android"
