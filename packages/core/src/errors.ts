import type { SessionResult } from './types';

export enum FFmpegErrorCode {
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  INPUT_NOT_FOUND = 'INPUT_NOT_FOUND',
  OUTPUT_NOT_WRITABLE = 'OUTPUT_NOT_WRITABLE',
  CODEC_NOT_FOUND = 'CODEC_NOT_FOUND',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
  MODULE_NOT_AVAILABLE = 'MODULE_NOT_AVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export class FFmpegError extends Error {
  readonly code: FFmpegErrorCode;

  constructor(code: FFmpegErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FFmpegError';
    this.code = code;
  }
}

export class ExecutionError extends FFmpegError {
  readonly result: SessionResult;

  constructor(result: SessionResult) {
    super(
      FFmpegErrorCode.EXECUTION_FAILED,
      result.failureMessage ?? `FFmpeg exited with code ${result.returnCode}`,
    );
    this.name = 'ExecutionError';
    this.result = result;
  }
}

export class CancellationError extends FFmpegError {
  readonly result: SessionResult;

  constructor(result: SessionResult) {
    super(FFmpegErrorCode.CANCELLED, 'Operation was cancelled');
    this.name = 'CancellationError';
    this.result = result;
  }
}
