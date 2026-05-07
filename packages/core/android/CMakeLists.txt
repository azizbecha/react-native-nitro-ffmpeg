cmake_minimum_required(VERSION 3.22)
project(NitroFFmpeg)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(PACKAGE_NAME "NitroFFmpeg")

# Find packages
find_package(fbjni REQUIRED)
find_package(ReactAndroid REQUIRED)
find_package(react-native-nitro-modules REQUIRED)

# Resolve FFmpeg binary package
set(FFMPEG_BINARY_PACKAGES
  "ffmpeg-full-gpl"
  "ffmpeg-full"
  "ffmpeg-min"
)

set(FFMPEG_LIBS_DIR "")
foreach(pkg ${FFMPEG_BINARY_PACKAGES})
  set(candidate "${CMAKE_SOURCE_DIR}/../../node_modules/@react-native-nitro-ffmpeg/${pkg}/android/jniLibs/${ANDROID_ABI}")
  if(EXISTS ${candidate})
    set(FFMPEG_LIBS_DIR ${candidate})
    break()
  endif()
  set(candidate "${CMAKE_SOURCE_DIR}/../../../node_modules/@react-native-nitro-ffmpeg/${pkg}/android/jniLibs/${ANDROID_ABI}")
  if(EXISTS ${candidate})
    set(FFMPEG_LIBS_DIR ${candidate})
    break()
  endif()
endforeach()

# Collect sources
file(GLOB_RECURSE NITROGEN_SOURCES
  "../nitrogen/generated/shared/**/*.cpp"
  "../nitrogen/generated/android/**/*.cpp"
)

# Create library
add_library(${PACKAGE_NAME} SHARED
  # Shared C wrapper
  ../cpp/ffmpeg_wrapper.c
  # JNI bridge
  src/main/cpp/ffmpeg_jni.cpp
  # Nitrogen generated
  ${NITROGEN_SOURCES}
)

# Include directories
target_include_directories(${PACKAGE_NAME} PRIVATE
  ../cpp
  ../nitrogen/generated/shared/c++
  ../nitrogen/generated/android/c++
)

# If FFmpeg binary package is found, link against it
if(NOT "${FFMPEG_LIBS_DIR}" STREQUAL "")
  message(STATUS "Found FFmpeg binaries at: ${FFMPEG_LIBS_DIR}")

  # Import FFmpeg shared libraries
  foreach(lib avcodec avformat avutil swscale swresample avfilter)
    if(EXISTS "${FFMPEG_LIBS_DIR}/lib${lib}.so")
      add_library(${lib} SHARED IMPORTED)
      set_target_properties(${lib} PROPERTIES
        IMPORTED_LOCATION "${FFMPEG_LIBS_DIR}/lib${lib}.so"
      )
      target_link_libraries(${PACKAGE_NAME} ${lib})
    endif()
  endforeach()

  # FFmpeg headers (from the binary package)
  foreach(pkg ${FFMPEG_BINARY_PACKAGES})
    set(headers_dir "${CMAKE_SOURCE_DIR}/../../node_modules/@react-native-nitro-ffmpeg/${pkg}/android/include")
    if(EXISTS ${headers_dir})
      target_include_directories(${PACKAGE_NAME} PRIVATE ${headers_dir})
      break()
    endif()
  endforeach()
else()
  message(WARNING "No FFmpeg binary package found. Build will fail at link time.")
endif()

# Link libraries
target_link_libraries(${PACKAGE_NAME}
  fbjni::fbjni
  ReactAndroid::jsi
  ReactAndroid::react_nativemodule_core
  react-native-nitro-modules::NitroModules
  log
  android
)

# Nitrogen autolinking
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroFFmpeg+autolinking.cmake)
