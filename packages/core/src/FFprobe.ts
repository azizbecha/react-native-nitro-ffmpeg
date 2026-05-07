import { NitroModules } from 'react-native-nitro-modules';
import type { FFmpeg as FFmpegSpec } from './specs/FFmpeg.nitro';
import type { MediaInfo, MediaPath } from './types';
import { FFmpegError, FFmpegErrorCode } from './errors';
import { parseMediaInfo } from './utils/parseMediaInfo';

let _module: FFmpegSpec | null = null;

function getModule(): FFmpegSpec {
  if (!_module) {
    try {
      _module = NitroModules.createHybridObject<FFmpegSpec>('FFmpeg');
    } catch {
      throw new FFmpegError(
        FFmpegErrorCode.MODULE_NOT_AVAILABLE,
        'Native FFmpeg module not available.',
      );
    }
  }
  return _module;
}

export namespace FFprobe {
  export async function getMediaInfo(path: MediaPath): Promise<MediaInfo> {
    const json = await getModule().probe(path);
    return parseMediaInfo(json, path);
  }

  export async function execute(
    args: string[],
  ): Promise<Record<string, unknown>> {
    const command = [
      ...args,
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      '-show_chapters',
    ].join(' ');
    const json = await getModule().probe(command);
    return JSON.parse(json) as Record<string, unknown>;
  }
}
