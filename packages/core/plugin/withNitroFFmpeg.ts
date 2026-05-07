import {
  createRunOncePlugin,
  type ConfigPlugin,
  withInfoPlist,
} from '@expo/config-plugins';

interface NitroFFmpegPluginOptions {
  iosBackgroundAudio?: boolean;
}

const withNitroFFmpeg: ConfigPlugin<NitroFFmpegPluginOptions> = (
  config,
  options = {},
) => {
  if (options.iosBackgroundAudio) {
    config = withInfoPlist(config, (iosConfig) => {
      const modes = iosConfig.modResults.UIBackgroundModes ?? [];
      if (!modes.includes('audio')) {
        iosConfig.modResults.UIBackgroundModes = [...modes, 'audio'];
      }
      return iosConfig;
    });
  }
  return config;
};

export default createRunOncePlugin(
  withNitroFFmpeg,
  '@react-native-nitro-ffmpeg/core',
  '0.1.0',
);
