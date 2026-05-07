cmake_minimum_required(VERSION 3.22)
project(NitroFFmpeg)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(PACKAGE_NAME "NitroFFmpeg")

# Find packages
find_package(fbjni REQUIRED)
find_package(ReactAndroid REQUIRED)
find_package(react-native-nitro-modules REQUIRED)

# Collect sources
file(GLOB_RECURSE CPP_SOURCES
  "../cpp/*.cpp"
  "src/main/cpp/*.cpp"
)

file(GLOB_RECURSE NITROGEN_SOURCES
  "../nitrogen/generated/shared/**/*.cpp"
  "../nitrogen/generated/android/**/*.cpp"
)

# Create library
add_library(${PACKAGE_NAME} SHARED
  ${CPP_SOURCES}
  ${NITROGEN_SOURCES}
)

# Include directories
target_include_directories(${PACKAGE_NAME} PRIVATE
  "../cpp"
  "../nitrogen/generated/shared/c++"
  "../nitrogen/generated/android/c++"
)

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
