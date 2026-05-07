const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const corePackageSrc = path.resolve(__dirname, '..', 'packages', 'core', 'src');

const config = {
  watchFolders: [corePackageSrc],
  resolver: {
    extraNodeModules: new Proxy(
      {'@react-native-nitro-ffmpeg/core': corePackageSrc},
      {
        get: (target, name) =>
          name in target
            ? target[name]
            : path.join(__dirname, 'node_modules', String(name)),
      },
    ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
