import { useState, useCallback, useRef } from 'react';
import { FFmpeg, type FFmpegSession } from './FFmpeg';
import type { Progress, SessionResult } from './types';

export interface UseFFmpegState {
  readonly isRunning: boolean;
  readonly progress: Progress | null;
  readonly percentage: number | null;
  readonly result: SessionResult | null;
  readonly error: Error | null;
}

export interface UseFFmpegActions {
  execute(args: string[]): FFmpegSession;
  cancel(): void;
  reset(): void;
}

export function useFFmpeg(): [UseFFmpegState, UseFFmpegActions] {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const sessionRef = useRef<FFmpegSession | null>(null);

  const execute = useCallback((args: string[]): FFmpegSession => {
    if (sessionRef.current) {
      sessionRef.current.cancel();
    }

    setIsRunning(true);
    setProgress(null);
    setResult(null);
    setError(null);

    const session = FFmpeg.execute(args, {
      onProgress: (p) => setProgress(p),
    });

    sessionRef.current = session;

    Promise.resolve(session).then(
      (res) => {
        setResult(res);
        setIsRunning(false);
        sessionRef.current = null;
      },
      (err: Error) => {
        setError(err);
        setIsRunning(false);
        sessionRef.current = null;
      },
    );

    return session;
  }, []);

  const cancel = useCallback(() => {
    sessionRef.current?.cancel();
  }, []);

  const reset = useCallback(() => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setIsRunning(false);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  const state: UseFFmpegState = {
    isRunning,
    progress,
    percentage: progress?.percentage ?? null,
    result,
    error,
  };

  return [state, { execute, cancel, reset }];
}
