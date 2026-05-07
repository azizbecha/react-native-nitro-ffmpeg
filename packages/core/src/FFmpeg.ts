import { NitroModules } from 'react-native-nitro-modules';
import type { FFmpeg as FFmpegSpec } from './specs/FFmpeg.nitro';
import type {
  SessionResult,
  Progress,
  LogEntry,
  ExecuteOptions,
} from './types';
import { LogLevel, ReturnCode } from './types';
import { CancellationError, ExecutionError, FFmpegError, FFmpegErrorCode } from './errors';
import { parseArgs } from './utils/parseArgs';

let _module: FFmpegSpec | null = null;

function getModule(): FFmpegSpec {
  if (!_module) {
    try {
      _module = NitroModules.createHybridObject<FFmpegSpec>('FFmpeg');
    } catch {
      throw new FFmpegError(
        FFmpegErrorCode.MODULE_NOT_AVAILABLE,
        'Native FFmpeg module not available. Make sure you have installed one of: ' +
          '@react-native-nitro-ffmpeg/ffmpeg-min, @react-native-nitro-ffmpeg/ffmpeg-full, ' +
          'or @react-native-nitro-ffmpeg/ffmpeg-full-gpl',
      );
    }
  }
  return _module;
}

let nextSessionId = 1;

const activeSessions = new Map<string, FFmpegSessionImpl>();

type ProgressListener = (progress: Progress) => void;
type LogListener = (log: LogEntry) => void;
type Unsubscribe = () => void;

interface AsyncQueue<T> {
  push(value: T): void;
  close(): void;
  iterate(): AsyncIterable<T>;
}

function createAsyncQueue<T>(): AsyncQueue<T> {
  const buffer: T[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  return {
    push(value: T) {
      if (done) return;
      buffer.push(value);
      resolve?.();
      resolve = null;
    },
    close() {
      done = true;
      resolve?.();
      resolve = null;
    },
    iterate(): AsyncIterable<T> {
      return {
        [Symbol.asyncIterator]() {
          return {
            async next(): Promise<IteratorResult<T>> {
              while (buffer.length === 0 && !done) {
                await new Promise<void>((r) => {
                  resolve = r;
                });
              }
              if (buffer.length > 0) {
                return { done: false, value: buffer.shift()! };
              }
              return { done: true, value: undefined };
            },
          };
        },
      };
    },
  };
}

class FFmpegSessionImpl implements PromiseLike<SessionResult> {
  readonly sessionId: string;
  private _resolve!: (result: SessionResult) => void;
  private _reject!: (error: Error) => void;
  private readonly _promise: Promise<SessionResult>;
  private readonly _progressListeners: Set<ProgressListener> = new Set();
  private readonly _logListeners: Set<LogListener> = new Set();
  private readonly _command: string[];
  private _cancelled = false;
  private _estimatedDurationMs?: number;

  private readonly _progressQueue: AsyncQueue<Progress>;
  private readonly _logQueue: AsyncQueue<LogEntry>;

  constructor(command: string[], options?: ExecuteOptions) {
    this._command = command;
    this._estimatedDurationMs = options?.estimatedDurationMs;
    this._progressQueue = createAsyncQueue<Progress>();
    this._logQueue = createAsyncQueue<LogEntry>();

    this._promise = new Promise<SessionResult>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });

    this.sessionId = String(nextSessionId++);
    activeSessions.set(this.sessionId, this);

    if (options?.onProgress) {
      this._progressListeners.add(options.onProgress);
    }

    if (options?.onLog) {
      this._logListeners.add(options.onLog);
    }

    if (options?.signal) {
      if (options.signal.aborted) {
        this.cancel();
      } else {
        options.signal.addEventListener('abort', () => this.cancel(), {
          once: true,
        });
      }
    }

    const mod = getModule();

    mod.onProgress = (sessionId, nativeProgress) => {
      const session = activeSessions.get(sessionId);
      if (!session) return;
      session._handleProgress(nativeProgress);
    };

    mod.onLog = (sessionId, nativeLog) => {
      const session = activeSessions.get(sessionId);
      if (!session) return;
      session._handleLog(nativeLog);
    };

    mod.onComplete = (sessionId, nativeResult) => {
      const session = activeSessions.get(sessionId);
      if (!session) return;
      session._handleComplete(nativeResult);
    };

    const logLevel = options?.logLevel ?? LogLevel.WARNING;
    mod.execute(this.sessionId, command, logLevel);
  }

  cancel(): void {
    if (this._cancelled) return;
    this._cancelled = true;
    try {
      getModule().cancel(this.sessionId);
    } catch {
      // Session may have already completed
    }
  }

  onProgress(callback: ProgressListener): Unsubscribe {
    this._progressListeners.add(callback);
    return () => this._progressListeners.delete(callback);
  }

  onLog(callback: LogListener): Unsubscribe {
    this._logListeners.add(callback);
    return () => this._logListeners.delete(callback);
  }

  get progress(): AsyncIterable<Progress> {
    return this._progressQueue.iterate();
  }

  get logs(): AsyncIterable<LogEntry> {
    return this._logQueue.iterate();
  }

  then<TResult1 = SessionResult, TResult2 = never>(
    onfulfilled?:
      | ((value: SessionResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): Promise<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected);
  }

  _handleProgress(native: { frame: number; fps: number; bitrate: number; totalSize: number; timeMs: number; speed: number }): void {
    const progress: Progress = {
      frame: native.frame,
      fps: native.fps,
      bitrate: native.bitrate,
      totalSize: native.totalSize,
      timeMs: native.timeMs,
      speed: native.speed,
      percentage: this._estimatedDurationMs
        ? Math.min(native.timeMs / this._estimatedDurationMs, 1)
        : undefined,
    };

    for (const listener of this._progressListeners) {
      listener(progress);
    }

    this._progressQueue.push(progress);
  }

  _handleLog(native: { level: number; message: string }): void {
    const log: LogEntry = {
      level: native.level as LogLevel,
      message: native.message,
    };

    for (const listener of this._logListeners) {
      listener(log);
    }

    this._logQueue.push(log);
  }

  _handleComplete(native: {
    sessionId: string;
    returnCode: number;
    duration: number;
    logs: string;
    command: string[];
    failureMessage: string | undefined;
  }): void {
    activeSessions.delete(this.sessionId);

    this._progressQueue.close();
    this._logQueue.close();

    const result: SessionResult = {
      sessionId: native.sessionId,
      returnCode: native.returnCode,
      duration: native.duration,
      logs: native.logs,
      command: this._command,
      ok: native.returnCode === ReturnCode.SUCCESS,
      failureMessage: native.failureMessage,
    };

    if (result.returnCode === ReturnCode.CANCEL) {
      this._reject(new CancellationError(result));
    } else if (!result.ok) {
      this._reject(new ExecutionError(result));
    } else {
      this._resolve(result);
    }
  }
}

export type FFmpegSession = FFmpegSessionImpl;

export namespace FFmpeg {
  export function execute(
    args: string[],
    options?: ExecuteOptions,
  ): FFmpegSession {
    return new FFmpegSessionImpl(args, options);
  }

  export function run(
    command: string,
    options?: ExecuteOptions,
  ): FFmpegSession {
    return new FFmpegSessionImpl(parseArgs(command), options);
  }

  export function cancel(sessionId: string): void {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.cancel();
    } else {
      getModule().cancel(sessionId);
    }
  }

  export function cancelAll(): void {
    for (const session of activeSessions.values()) {
      session.cancel();
    }
    getModule().cancelAll();
  }

  export function getActiveSessions(): string[] {
    return getModule().getActiveSessions();
  }

  export function getVersion(): string {
    return getModule().getFFmpegVersion();
  }

  export function getSupportedEncoders(): string[] {
    return getModule().getSupportedEncoders();
  }

  export function getSupportedDecoders(): string[] {
    return getModule().getSupportedDecoders();
  }
}
