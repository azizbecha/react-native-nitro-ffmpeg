require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

ffmpeg_packages = ["ffmpeg-full-gpl", "ffmpeg-full", "ffmpeg-min"]

binary_package = nil
ffmpeg_packages.each do |pkg|
  candidate = File.join(__dir__, "..", pkg)
  if File.exist?(candidate) && (File.exist?(File.join(candidate, "ios", "lib")) || File.exist?(File.join(candidate, "ios", "Frameworks")))
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

  xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
  }

  if binary_package
    # Check for static libraries (.a files)
    lib_dir = File.join(binary_package, "ios", "lib")
    headers_dir = File.join(binary_package, "ios", "include")
    frameworks_dir = File.join(binary_package, "ios", "Frameworks")

    if File.exist?(lib_dir)
      s.vendored_libraries = Dir["#{lib_dir}/*.a"]
      xcconfig["OTHER_CFLAGS"] = "$(inherited) -DHAVE_FFMPEG=1"
    elsif File.exist?(frameworks_dir)
      s.vendored_frameworks = Dir["#{frameworks_dir}/*.xcframework"]
      xcconfig["OTHER_CFLAGS"] = "$(inherited) -DHAVE_FFMPEG=1"
    end

    if File.exist?(headers_dir)
      xcconfig["HEADER_SEARCH_PATHS"] = "$(inherited) \"#{headers_dir}\""
    end
  else
    Pod::UI.warn "[react-native-nitro-ffmpeg] No FFmpeg binary package found."
  end

  s.pod_target_xcconfig = xcconfig

  s.frameworks = [
    "AudioToolbox",
    "AVFoundation",
    "CoreMedia",
    "VideoToolbox",
  ]

  s.libraries = ["z", "bz2", "iconv"]

  s.dependency "NitroModules"

  nitrogen_autolinking = File.join(__dir__, "nitrogen", "generated", "ios", "NitroFFmpeg+autolinking.rb")
  if File.exist?(nitrogen_autolinking)
    load nitrogen_autolinking
  end

  install_modules_dependencies(s)
end
