export interface SessionResult {
  readonly sessionId: string;
  readonly returnCode: number;
  readonly duration: number;
  readonly logs: string;
  readonly command: readonly string[];
  readonly ok: boolean;
  readonly failureMessage?: string;
}

export interface Progress {
  readonly frame: number;
  readonly fps: number;
  readonly bitrate: number;
  readonly totalSize: number;
  readonly timeMs: number;
  readonly speed: number;
  readonly percentage?: number;
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
}

export enum LogLevel {
  QUIET = -8,
  PANIC = 0,
  FATAL = 8,
  ERROR = 16,
  WARNING = 24,
  INFO = 32,
  VERBOSE = 40,
  DEBUG = 48,
  TRACE = 56,
}

export enum ReturnCode {
  SUCCESS = 0,
  CANCEL = 255,
}

export interface ExecuteOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: Progress) => void;
  readonly onLog?: (log: LogEntry) => void;
  readonly estimatedDurationMs?: number;
  readonly logLevel?: LogLevel;
}

export interface MediaInfo {
  readonly filename: string;
  readonly format: FormatInfo;
  readonly streams: readonly StreamInfo[];
  readonly chapters: readonly ChapterInfo[];
  readonly raw: Record<string, unknown>;
}

export interface FormatInfo {
  readonly name: string;
  readonly longName: string;
  readonly durationMs: number;
  readonly sizeBytes: number;
  readonly bitrate: number;
  readonly tags: Readonly<Record<string, string>>;
}

export type StreamInfo =
  | VideoStreamInfo
  | AudioStreamInfo
  | SubtitleStreamInfo
  | DataStreamInfo;

interface BaseStreamInfo {
  readonly index: number;
  readonly codecName: string;
  readonly codecLongName: string;
  readonly profile?: string;
  readonly tags: Readonly<Record<string, string>>;
}

export interface VideoStreamInfo extends BaseStreamInfo {
  readonly type: 'video';
  readonly width: number;
  readonly height: number;
  readonly displayAspectRatio: string;
  readonly pixelFormat: string;
  readonly frameRate: number;
  readonly bitrate: number;
  readonly durationMs: number;
  readonly rotation?: number;
  readonly isHdr: boolean;
}

export interface AudioStreamInfo extends BaseStreamInfo {
  readonly type: 'audio';
  readonly sampleRate: number;
  readonly channels: number;
  readonly channelLayout: string;
  readonly bitrate: number;
  readonly durationMs: number;
}

export interface SubtitleStreamInfo extends BaseStreamInfo {
  readonly type: 'subtitle';
}

export interface DataStreamInfo extends BaseStreamInfo {
  readonly type: 'data';
}

export interface ChapterInfo {
  readonly id: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly title?: string;
  readonly tags: Readonly<Record<string, string>>;
}

export type MediaPath = string;

export interface CompressOptions extends ExecuteOptions {
  readonly quality?: 'low' | 'medium' | 'high';
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly videoCodec?: 'h264' | 'h265' | 'vp9';
  readonly keepAudio?: boolean;
}

export interface TrimOptions extends ExecuteOptions {
  readonly startMs: number;
  readonly endMs: number;
  readonly fastSeek?: boolean;
}

export interface ExtractAudioOptions extends ExecuteOptions {
  readonly format?: 'aac' | 'mp3' | 'wav' | 'flac' | 'opus';
  readonly bitrate?: string;
  readonly sampleRate?: number;
}

export interface ThumbnailOptions extends ExecuteOptions {
  readonly atMs?: number;
  readonly width?: number;
  readonly height?: number;
  readonly format?: 'jpg' | 'png' | 'webp';
  readonly quality?: number;
}

export interface ConcatOptions extends ExecuteOptions {
  readonly demuxer?: boolean;
}

export interface ConvertOptions extends ExecuteOptions {
  readonly videoCodec?: string;
  readonly audioCodec?: string;
}
