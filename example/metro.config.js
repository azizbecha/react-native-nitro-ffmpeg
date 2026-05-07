const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');
const corePackage = path.resolve(root, 'packages', 'core', 'src');

const config = {
  watchFolders: [root],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(root, 'node_modules'),
    ],
    extraNodeModules: {
      '@react-native-nitro-ffmpeg/core': corePackage,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
