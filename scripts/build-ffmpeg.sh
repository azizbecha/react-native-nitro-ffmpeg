#!/bin/bash
set -euo pipefail

# Build FFmpeg for iOS and Android with fftools-as-library support.
#
# Usage:
#   ./scripts/build-ffmpeg.sh <variant> <platform> [arch]
#
#   variant:  min | full | full-gpl
#   platform: ios | android
#   arch:     (ios) arm64, x86_64-simulator
#             (android) arm64-v8a, armeabi-v7a, x86_64
#
# Environment variables:
#   FFMPEG_VERSION  - FFmpeg version (default: 7.1)
#   ANDROID_NDK     - Path to Android NDK (required for Android builds)
#   ANDROID_API     - Android API level (default: 24)
#
# Examples:
#   ./scripts/build-ffmpeg.sh min ios arm64
#   ./scripts/build-ffmpeg.sh full android arm64-v8a

VARIANT="${1:?Usage: build-ffmpeg.sh <variant> <platform> [arch]}"
PLATFORM="${2:?Usage: build-ffmpeg.sh <variant> <platform> [arch]}"
ARCH="${3:-}"

FFMPEG_VERSION="${FFMPEG_VERSION:-7.1}"
ANDROID_API="${ANDROID_API:-24}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${ROOT_DIR}/build/ffmpeg-${VARIANT}-${PLATFORM}"
PATCH_DIR="${SCRIPT_DIR}/patches"
OUTPUT_DIR="${ROOT_DIR}/packages/ffmpeg-${VARIANT}"

echo "=== Building FFmpeg ${FFMPEG_VERSION} ==="
echo "  Variant:  ${VARIANT}"
echo "  Platform: ${PLATFORM}"
echo "  Arch:     ${ARCH:-all}"
echo ""

# ─── Common configure flags ───

COMMON_FLAGS=(
  --disable-programs
  --disable-doc
  --disable-debug
  --enable-pic
  --enable-small
  --enable-cross-compile
)

# Include fftools source as library objects
FFTOOLS_FLAGS=(
  --enable-ffmpeg
  --enable-ffprobe
)

# ─── Variant-specific flags ───

case "$VARIANT" in
  min)
    VARIANT_FLAGS=(
      --disable-everything
      --enable-demuxer=mov,matroska,avi,flv,mp3,ogg,wav,aac,flac,image2,rawvideo
      --enable-muxer=mp4,matroska,mp3,ogg,wav,flac,image2,mjpeg,rawvideo,null
      --enable-decoder=h264,hevc,vp8,vp9,av1,aac,mp3,flac,opus,vorbis,pcm_s16le,pcm_s24le,pcm_f32le,mjpeg,png,rawvideo
      --enable-encoder=aac,libmp3lame,flac,opus,pcm_s16le,mjpeg,png,rawvideo
      --enable-parser=h264,hevc,aac,mp3,opus,vp8,vp9,av1
      --enable-protocol=file,pipe,data
      --enable-filter=scale,aresample,concat,volume,trim,atrim,setpts,asetpts,fps,format,aformat,anull,null
      --enable-bsf=h264_mp4toannexb,hevc_mp4toannexb,aac_adtstoasc
    )
    ;;
  full)
    VARIANT_FLAGS=(
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
    VARIANT_FLAGS=(
      --enable-gpl
      --enable-nonfree
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
    echo "Error: Unknown variant '$VARIANT'. Use: min, full, or full-gpl"
    exit 1
    ;;
esac

# ─── Download and patch FFmpeg ───

mkdir -p "$BUILD_DIR"

FFMPEG_SRC="${BUILD_DIR}/ffmpeg-${FFMPEG_VERSION}"
if [ ! -d "$FFMPEG_SRC" ]; then
  echo "Downloading FFmpeg ${FFMPEG_VERSION}..."
  curl -L "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" | tar xJ -C "$BUILD_DIR"
fi

# Apply our library patch
if [ ! -f "${FFMPEG_SRC}/.patched" ]; then
  echo "Applying ffmpeg-as-library patch..."
  # Create the bridge header
  cat > "${FFMPEG_SRC}/fftools/ffmpeg_kit_bridge.h" << 'BRIDGE_EOF'
#ifndef FFMPEG_KIT_BRIDGE_H
#define FFMPEG_KIT_BRIDGE_H

#include <setjmp.h>
#include <stdint.h>

extern __thread int ffmpegkit_return_code;
extern __thread int ffmpegkit_longjmp_active;
extern __thread jmp_buf ffmpegkit_longjmp_buf;
extern __thread volatile int ffmpegkit_cancelled;

typedef void (*ffmpegkit_progress_fn)(int64_t frame, double fps, double bitrate,
                                      int64_t total_size, int64_t time_ms, double speed,
                                      void *user_data);
extern __thread ffmpegkit_progress_fn ffmpegkit_progress_callback;
extern __thread void *ffmpegkit_progress_user_data;

typedef void (*ffmpegkit_log_fn)(int level, const char *message, void *user_data);
extern __thread ffmpegkit_log_fn ffmpegkit_log_callback;
extern __thread void *ffmpegkit_log_user_data;

int ffmpeg_execute_main(int argc, char **argv);
int ffprobe_execute_main(int argc, char **argv);

#endif
BRIDGE_EOF

  # Patch exit_program to use longjmp
  if [ -f "${FFMPEG_SRC}/fftools/cmdutils.c" ]; then
    sed -i.bak 's/void exit_program(int ret)/void exit_program(int ret)/; /exit(ret)/i\
    if (ffmpegkit_longjmp_active) { longjmp(ffmpegkit_longjmp_buf, ret); }' \
      "${FFMPEG_SRC}/fftools/cmdutils.c"
    echo '#include "ffmpeg_kit_bridge.h"' | cat - "${FFMPEG_SRC}/fftools/cmdutils.c" > /tmp/cmdutils_tmp && mv /tmp/cmdutils_tmp "${FFMPEG_SRC}/fftools/cmdutils.c"
  fi

  # Rename main in ffmpeg.c
  if [ -f "${FFMPEG_SRC}/fftools/ffmpeg.c" ]; then
    sed -i.bak 's/int main(int argc, char \*\*argv)/int ffmpeg_execute_main(int argc, char **argv)/' \
      "${FFMPEG_SRC}/fftools/ffmpeg.c"
  fi

  # Rename main in ffprobe.c
  if [ -f "${FFMPEG_SRC}/fftools/ffprobe.c" ]; then
    sed -i.bak 's/int main(int argc, char \*\*argv)/int ffprobe_execute_main(int argc, char **argv)/' \
      "${FFMPEG_SRC}/fftools/ffprobe.c"
  fi

  touch "${FFMPEG_SRC}/.patched"
  echo "Patch applied."
fi

# ─── Platform builds ───

build_ios() {
  local arch="$1"
  local sdk prefix target min_ver

  if [ "$arch" = "arm64" ]; then
    sdk="iphoneos"
    target="aarch64-apple-ios15.0"
    min_ver="-miphoneos-version-min=15.0"
  else
    sdk="iphonesimulator"
    target="x86_64-apple-ios15.0-simulator"
    min_ver="-mios-simulator-version-min=15.0"
  fi

  prefix="${BUILD_DIR}/install-ios-${arch}"
  local sdkpath
  sdkpath=$(xcrun --sdk "$sdk" --show-sdk-path)

  echo "Building for iOS ${arch}..."
  cd "$FFMPEG_SRC"

  make clean 2>/dev/null || true

  ./configure \
    --prefix="$prefix" \
    --arch="$arch" \
    --target-os=darwin \
    --cc="clang -target $target" \
    --sysroot="$sdkpath" \
    --extra-cflags="-isysroot $sdkpath $min_ver -fembed-bitcode" \
    --enable-static \
    --disable-shared \
    "${COMMON_FLAGS[@]}" \
    "${VARIANT_FLAGS[@]}"

  make -j"$(sysctl -n hw.ncpu)"
  make install

  echo "iOS ${arch} build complete: ${prefix}"
}

build_android() {
  local abi="$1"
  local ffmpeg_arch cross_prefix api_prefix

  case "$abi" in
    arm64-v8a)
      ffmpeg_arch="aarch64"
      cross_prefix="aarch64-linux-android"
      ;;
    armeabi-v7a)
      ffmpeg_arch="arm"
      cross_prefix="armv7a-linux-androideabi"
      ;;
    x86_64)
      ffmpeg_arch="x86_64"
      cross_prefix="x86_64-linux-android"
      ;;
    *)
      echo "Unknown Android ABI: $abi"
      exit 1
      ;;
  esac

  if [ -z "${ANDROID_NDK:-}" ]; then
    echo "Error: ANDROID_NDK not set"
    exit 1
  fi

  local toolchain="${ANDROID_NDK}/toolchains/llvm/prebuilt/$(uname -s | tr '[:upper:]' '[:lower:]')-x86_64"
  local prefix="${BUILD_DIR}/install-android-${abi}"

  echo "Building for Android ${abi}..."
  cd "$FFMPEG_SRC"

  make clean 2>/dev/null || true

  ./configure \
    --prefix="$prefix" \
    --arch="$ffmpeg_arch" \
    --target-os=android \
    --cc="${toolchain}/bin/${cross_prefix}${ANDROID_API}-clang" \
    --cxx="${toolchain}/bin/${cross_prefix}${ANDROID_API}-clang++" \
    --cross-prefix="${toolchain}/bin/llvm-" \
    --sysroot="${toolchain}/sysroot" \
    --enable-shared \
    --disable-static \
    "${COMMON_FLAGS[@]}" \
    "${VARIANT_FLAGS[@]}"

  make -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu)"
  make install

  # Copy shared libs to output
  local out_dir="${OUTPUT_DIR}/android/jniLibs/${abi}"
  mkdir -p "$out_dir"
  cp "${prefix}/lib/"*.so "$out_dir/"

  echo "Android ${abi} build complete: ${out_dir}"
}

# ─── Run builds ───

case "$PLATFORM" in
  ios)
    if [ -n "$ARCH" ]; then
      build_ios "$ARCH"
    else
      build_ios arm64
      build_ios x86_64
    fi

    # Create XCFrameworks
    echo "Creating XCFrameworks..."
    local_output="${OUTPUT_DIR}/ios/Frameworks"
    mkdir -p "$local_output"

    for lib in avcodec avformat avutil swscale swresample avfilter; do
      arm64_lib="${BUILD_DIR}/install-ios-arm64/lib/lib${lib}.a"
      x64_lib="${BUILD_DIR}/install-ios-x86_64/lib/lib${lib}.a"
      headers="${BUILD_DIR}/install-ios-arm64/include"

      if [ -f "$arm64_lib" ] && [ -f "$x64_lib" ]; then
        xcodebuild -create-xcframework \
          -library "$arm64_lib" -headers "$headers" \
          -library "$x64_lib" -headers "$headers" \
          -output "${local_output}/lib${lib}.xcframework"
      fi
    done

    # Copy headers
    mkdir -p "${OUTPUT_DIR}/ios/include"
    cp -R "${BUILD_DIR}/install-ios-arm64/include/"* "${OUTPUT_DIR}/ios/include/"

    echo "XCFrameworks created at: ${local_output}"
    ;;

  android)
    if [ -n "$ARCH" ]; then
      build_android "$ARCH"
    else
      build_android arm64-v8a
      build_android armeabi-v7a
      build_android x86_64
    fi

    # Copy headers
    local first_abi
    for abi in arm64-v8a armeabi-v7a x86_64; do
      if [ -d "${BUILD_DIR}/install-android-${abi}/include" ]; then
        mkdir -p "${OUTPUT_DIR}/android/include"
        cp -R "${BUILD_DIR}/install-android-${abi}/include/"* "${OUTPUT_DIR}/android/include/"
        break
      fi
    done

    echo "Android builds complete at: ${OUTPUT_DIR}/android"
    ;;

  *)
    echo "Error: Unknown platform '$PLATFORM'. Use: ios or android"
    exit 1
    ;;
esac

echo ""
echo "=== Build complete ==="
echo "Output: ${OUTPUT_DIR}"
