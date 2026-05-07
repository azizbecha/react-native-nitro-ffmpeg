require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

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
    "cpp/**/*.{h,hpp,cpp}",
    "nitrogen/generated/shared/**/*.{h,hpp,cpp}",
    "nitrogen/generated/ios/**/*.{h,hpp,cpp,swift}",
  ]

  # Resolve FFmpeg binary package
  ffmpeg_packages = [
    "ffmpeg-full-gpl",
    "ffmpeg-full",
    "ffmpeg-min",
  ]

  binary_package = nil
  ffmpeg_packages.each do |pkg|
    candidate = File.join(__dir__, "..", "..", "node_modules", "@react-native-nitro-ffmpeg", pkg)
    if File.exist?(candidate)
      binary_package = candidate
      break
    end
    # Also check hoisted location
    candidate = File.join(__dir__, "..", "node_modules", "@react-native-nitro-ffmpeg", pkg)
    if File.exist?(candidate)
      binary_package = candidate
      break
    end
  end

  if binary_package
    s.vendored_frameworks = Dir["#{binary_package}/ios/Frameworks/*.xcframework"]
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

  install_modules_dependencies(s)
end
