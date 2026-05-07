require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Resolve FFmpeg binary package
ffmpeg_packages = [
  "ffmpeg-full-gpl",
  "ffmpeg-full",
  "ffmpeg-min",
]

binary_package = nil
ffmpeg_packages.each do |pkg|
  # Check in monorepo node_modules
  candidate = File.join(__dir__, "..", "..", "node_modules", "@react-native-nitro-ffmpeg", pkg)
  if File.exist?(candidate)
    binary_package = candidate
    break
  end
  # Check hoisted
  candidate = File.join(__dir__, "..", "node_modules", "@react-native-nitro-ffmpeg", pkg)
  if File.exist?(candidate)
    binary_package = candidate
    break
  end
end

Pod::Spec.new do |s|
  s.name         = "react-native-nitro-ffmpeg"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => package["repository"]["url"], :tag => s.version }

  s.source_files = [
    "ios/**/*.{h,m,mm,swift}",
    "cpp/**/*.{h,hpp,c,cpp}",
    "nitrogen/generated/shared/**/*.{h,hpp,cpp}",
    "nitrogen/generated/ios/**/*.{h,hpp,cpp,mm,swift}",
  ]

  s.private_header_files = [
    "cpp/**/*.h",
  ]

  # Swift bridging header for FFmpeg C API access
  s.pod_target_xcconfig = {
    "SWIFT_OBJC_BRIDGING_HEADER" => "$(PODS_TARGET_SRCROOT)/ios/NitroFFmpeg-Bridging-Header.h",
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "OTHER_CFLAGS" => "$(inherited) -DHAVE_FFMPEG=1",
  }

  if binary_package
    s.vendored_frameworks = Dir["#{binary_package}/ios/Frameworks/*.xcframework"]

    # Add FFmpeg headers from binary package
    headers_dir = File.join(binary_package, "ios", "include")
    if File.exist?(headers_dir)
      s.pod_target_xcconfig["HEADER_SEARCH_PATHS"] = "$(inherited) \"#{headers_dir}\""
    end
  else
    Pod::UI.warn "[react-native-nitro-ffmpeg] No FFmpeg binary package found. Install one of: " \
      "@react-native-nitro-ffmpeg/ffmpeg-min, @react-native-nitro-ffmpeg/ffmpeg-full, " \
      "@react-native-nitro-ffmpeg/ffmpeg-full-gpl"
  end

  s.frameworks = [
    "AudioToolbox",
    "AVFoundation",
    "CoreMedia",
    "VideoToolbox",
  ]

  s.dependency "NitroModules"

  # Load Nitrogen autolinking
  nitrogen_autolinking = File.join(__dir__, "nitrogen", "generated", "ios", "NitroFFmpeg+autolinking.rb")
  if File.exist?(nitrogen_autolinking)
    load nitrogen_autolinking
  end

  install_modules_dependencies(s)
end
