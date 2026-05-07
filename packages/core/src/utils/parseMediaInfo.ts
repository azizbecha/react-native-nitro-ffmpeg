import type {
  MediaInfo,
  FormatInfo,
  StreamInfo,
  VideoStreamInfo,
  AudioStreamInfo,
  SubtitleStreamInfo,
  DataStreamInfo,
  ChapterInfo,
} from '../types';

export function parseMediaInfo(json: string, path: string): MediaInfo {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const rawFormat = (raw.format ?? {}) as Record<string, unknown>;
  const rawStreams = (raw.streams ?? []) as Record<string, unknown>[];
  const rawChapters = (raw.chapters ?? []) as Record<string, unknown>[];

  return {
    filename: path,
    format: parseFormat(rawFormat),
    streams: rawStreams.map(parseStream),
    chapters: rawChapters.map(parseChapter),
    raw,
  };
}

function parseFormat(raw: Record<string, unknown>): FormatInfo {
  return {
    name: String(raw.format_name ?? ''),
    longName: String(raw.format_long_name ?? ''),
    durationMs: parseFloat(String(raw.duration ?? '0')) * 1000,
    sizeBytes: parseInt(String(raw.size ?? '0'), 10),
    bitrate: parseInt(String(raw.bit_rate ?? '0'), 10) / 1000,
    tags: parseTags(raw.tags),
  };
}

function parseStream(raw: Record<string, unknown>): StreamInfo {
  const codecType = String(raw.codec_type ?? 'data');

  switch (codecType) {
    case 'video':
      return parseVideoStream(raw);
    case 'audio':
      return parseAudioStream(raw);
    case 'subtitle':
      return parseSubtitleStream(raw);
    default:
      return parseDataStream(raw);
  }
}

function parseVideoStream(raw: Record<string, unknown>): VideoStreamInfo {
  const rFrameRate = String(raw.r_frame_rate ?? '0/1');
  const [num, den] = rFrameRate.split('/').map(Number);
  const frameRate = den ? (num ?? 0) / den : 0;

  const sideDataList = (raw.side_data_list ?? []) as Record<string, unknown>[];
  const rotationData = sideDataList.find(
    (d) => d.side_data_type === 'Display Matrix',
  );
  const rotation = rotationData
    ? Math.abs(Number(rotationData.rotation ?? 0))
    : undefined;

  const pixelFormat = String(raw.pix_fmt ?? '');
  const isHdr =
    pixelFormat.includes('10le') ||
    pixelFormat.includes('10be') ||
    String(raw.color_transfer ?? '').includes('smpte2084') ||
    String(raw.color_transfer ?? '').includes('arib-std-b67');

  return {
    type: 'video',
    index: Number(raw.index ?? 0),
    codecName: String(raw.codec_name ?? ''),
    codecLongName: String(raw.codec_long_name ?? ''),
    profile: raw.profile ? String(raw.profile) : undefined,
    width: Number(raw.width ?? 0),
    height: Number(raw.height ?? 0),
    displayAspectRatio: String(raw.display_aspect_ratio ?? ''),
    pixelFormat,
    frameRate,
    bitrate: parseInt(String(raw.bit_rate ?? '0'), 10) / 1000,
    durationMs: parseFloat(String(raw.duration ?? '0')) * 1000,
    rotation,
    isHdr,
    tags: parseTags(raw.tags),
  };
}

function parseAudioStream(raw: Record<string, unknown>): AudioStreamInfo {
  return {
    type: 'audio',
    index: Number(raw.index ?? 0),
    codecName: String(raw.codec_name ?? ''),
    codecLongName: String(raw.codec_long_name ?? ''),
    profile: raw.profile ? String(raw.profile) : undefined,
    sampleRate: parseInt(String(raw.sample_rate ?? '0'), 10),
    channels: Number(raw.channels ?? 0),
    channelLayout: String(raw.channel_layout ?? ''),
    bitrate: parseInt(String(raw.bit_rate ?? '0'), 10) / 1000,
    durationMs: parseFloat(String(raw.duration ?? '0')) * 1000,
    tags: parseTags(raw.tags),
  };
}

function parseSubtitleStream(
  raw: Record<string, unknown>,
): SubtitleStreamInfo {
  return {
    type: 'subtitle',
    index: Number(raw.index ?? 0),
    codecName: String(raw.codec_name ?? ''),
    codecLongName: String(raw.codec_long_name ?? ''),
    profile: raw.profile ? String(raw.profile) : undefined,
    tags: parseTags(raw.tags),
  };
}

function parseDataStream(raw: Record<string, unknown>): DataStreamInfo {
  return {
    type: 'data',
    index: Number(raw.index ?? 0),
    codecName: String(raw.codec_name ?? ''),
    codecLongName: String(raw.codec_long_name ?? ''),
    profile: raw.profile ? String(raw.profile) : undefined,
    tags: parseTags(raw.tags),
  };
}

function parseChapter(raw: Record<string, unknown>): ChapterInfo {
  const tags = parseTags(raw.tags);
  return {
    id: Number(raw.id ?? 0),
    startMs:
      parseFloat(String(raw.start_time ?? '0')) * 1000,
    endMs:
      parseFloat(String(raw.end_time ?? '0')) * 1000,
    title: tags.title,
    tags,
  };
}

function parseTags(
  raw: unknown,
): Readonly<Record<string, string>> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    result[key] = String(value);
  }
  return result;
}
