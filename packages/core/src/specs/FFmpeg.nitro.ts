import type { HybridObject } from 'react-native-nitro-modules';

export interface NativeSessionResult {
  sessionId: string;
  returnCode: number;
  duration: number;
  logs: string;
  command: string[];
  failureMessage: string | undefined;
}

export interface NativeProgress {
  frame: number;
  fps: number;
  bitrate: number;
  totalSize: number;
  timeMs: number;
  speed: number;
}

export interface NativeLogEntry {
  level: number;
  message: string;
}

export interface FFmpeg
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  execute(sessionId: string, args: string[], logLevel: number): void;
  cancel(sessionId: string): void;
  cancelAll(): void;
  getActiveSessions(): string[];

  probe(path: string): Promise<string>;

  getFFmpegVersion(): string;
  getSupportedEncoders(): string[];
  getSupportedDecoders(): string[];

  onProgress: (sessionId: string, progress: NativeProgress) => void;
  onLog: (sessionId: string, log: NativeLogEntry) => void;
  onComplete: (sessionId: string, result: NativeSessionResult) => void;
}
