import { FFmpeg, type FFmpegSession } from './FFmpeg';
import type {
  MediaPath,
  CompressOptions,
  TrimOptions,
  ExtractAudioOptions,
  ThumbnailOptions,
  ConcatOptions,
  ConvertOptions,
} from './types';

const CRF_MAP = { low: 32, medium: 23, high: 18 } as const;

const CODEC_MAP = {
  h264: 'libx264',
  h265: 'libx265',
  vp9: 'libvpx-vp9',
} as const;

export function compress(
  input: MediaPath,
  output: MediaPath,
  options: CompressOptions = {},
): FFmpegSession {
  const {
    quality = 'medium',
    maxWidth,
    maxHeight,
    videoCodec = 'h264',
    keepAudio = true,
    signal,
    onProgress,
    onLog,
    estimatedDurationMs,
    logLevel,
  } = options;

  const args: string[] = ['-i', input];

  args.push('-c:v', CODEC_MAP[videoCodec]);
  args.push('-crf', String(CRF_MAP[quality]));
  args.push('-preset', 'fast');

  if (maxWidth || maxHeight) {
    const w = maxWidth ? `min(${maxWidth},iw)` : '-2';
    const h = maxHeight ? `min(${maxHeight},ih)` : '-2';
    args.push('-vf', `scale=${w}:${h}`);
  }

  if (!keepAudio) {
    args.push('-an');
  } else {
    args.push('-c:a', 'aac', '-b:a', '128k');
  }

  args.push('-movflags', 'faststart');
  args.push('-y', output);

  return FFmpeg.execute(args, {
    signal,
    onProgress,
    onLog,
    estimatedDurationMs,
    logLevel,
  });
}

export function trim(
  input: MediaPath,
  output: MediaPath,
  options: TrimOptions,
): FFmpegSession {
  const {
    startMs,
    endMs,
    fastSeek = false,
    signal,
    onProgress,
    onLog,
    logLevel,
  } = options;

  const args: string[] = [];
  const durationMs = endMs - startMs;

  if (fastSeek) {
    args.push('-ss', String(startMs / 1000));
    args.push('-i', input);
    args.push('-t', String(durationMs / 1000));
    args.push('-c', 'copy');
  } else {
    args.push('-i', input);
    args.push('-ss', String(startMs / 1000));
    args.push('-to', String(endMs / 1000));
  }

  args.push('-y', output);

  return FFmpeg.execute(args, {
    signal,
    onProgress,
    onLog,
    estimatedDurationMs: durationMs,
    logLevel,
  });
}

export function extractAudio(
  input: MediaPath,
  output: MediaPath,
  options: ExtractAudioOptions = {},
): FFmpegSession {
  const {
    format = 'aac',
    bitrate,
    sampleRate,
    signal,
    onProgress,
    onLog,
    estimatedDurationMs,
    logLevel,
  } = options;

  const codecMap: Record<string, string> = {
    aac: 'aac',
    mp3: 'libmp3lame',
    wav: 'pcm_s16le',
    flac: 'flac',
    opus: 'libopus',
  };

  const args: string[] = ['-i', input, '-vn'];
  args.push('-c:a', codecMap[format] ?? format);

  if (bitrate) {
    args.push('-b:a', bitrate);
  }

  if (sampleRate) {
    args.push('-ar', String(sampleRate));
  }

  args.push('-y', output);

  return FFmpeg.execute(args, {
    signal,
    onProgress,
    onLog,
    estimatedDurationMs,
    logLevel,
  });
}

export function thumbnail(
  input: MediaPath,
  output: MediaPath,
  options: ThumbnailOptions = {},
): FFmpegSession {
  const {
    atMs = 0,
    width,
    height,
    quality = 90,
    signal,
    onProgress,
    onLog,
    logLevel,
  } = options;

  const args: string[] = [
    '-ss',
    String(atMs / 1000),
    '-i',
    input,
    '-frames:v',
    '1',
  ];

  if (width || height) {
    const w = width ? String(width) : '-2';
    const h = height ? String(height) : '-2';
    args.push('-vf', `scale=${w}:${h}`);
  }

  args.push('-q:v', String(Math.round((100 - quality) * 0.31 + 1)));
  args.push('-y', output);

  return FFmpeg.execute(args, { signal, onProgress, onLog, logLevel });
}

export function concat(
  inputs: MediaPath[],
  output: MediaPath,
  options: ConcatOptions = {},
): FFmpegSession {
  const { demuxer = false, signal, onProgress, onLog, logLevel } = options;

  if (demuxer) {
    const listContent = inputs.map((p) => `file '${p}'`).join('\n');
    const args = [
      '-f',
      'concat',
      '-safe',
      '0',
      '-protocol_whitelist',
      'file,pipe',
      '-i',
      `pipe:0`,
      '-c',
      'copy',
      '-y',
      output,
    ];
    // Note: pipe input requires native-side support for stdin.
    // For now, fall back to the filter_complex approach.
    return FFmpeg.execute(args, { signal, onProgress, onLog, logLevel });
  }

  const args: string[] = [];
  for (const input of inputs) {
    args.push('-i', input);
  }

  const filterParts = inputs.map((_, i) => `[${i}:v][${i}:a]`).join('');
  args.push(
    '-filter_complex',
    `${filterParts}concat=n=${inputs.length}:v=1:a=1[outv][outa]`,
  );
  args.push('-map', '[outv]', '-map', '[outa]');
  args.push('-y', output);

  return FFmpeg.execute(args, { signal, onProgress, onLog, logLevel });
}

export function convertFormat(
  input: MediaPath,
  output: MediaPath,
  options: ConvertOptions = {},
): FFmpegSession {
  const { videoCodec, audioCodec, signal, onProgress, onLog, logLevel } =
    options;

  const args: string[] = ['-i', input];

  if (videoCodec) {
    args.push('-c:v', videoCodec);
  }

  if (audioCodec) {
    args.push('-c:a', audioCodec);
  }

  args.push('-y', output);

  return FFmpeg.execute(args, { signal, onProgress, onLog, logLevel });
}
