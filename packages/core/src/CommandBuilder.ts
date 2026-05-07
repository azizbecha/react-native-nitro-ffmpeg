import { FFmpeg, type FFmpegSession } from './FFmpeg';
import type { ExecuteOptions } from './types';

interface InputEntry {
  path: string;
  options: string[];
}

export interface InputOptions {
  seekMs?: number;
  options?: string[];
}

export class CommandBuilder {
  private _inputs: InputEntry[] = [];
  private _outputPath = '';
  private _videoOptions: string[] = [];
  private _audioOptions: string[] = [];
  private _outputOptions: string[] = [];
  private _filters: string[] = [];
  private _audioFilters: string[] = [];
  private _complexFilter = '';
  private _maps: string[] = [];
  private _overwrite = false;
  private _noAudio = false;
  private _formatOption = '';
  private _seekOption = '';
  private _durationOption = '';
  private _toOption = '';

  input(path: string, options?: InputOptions): this {
    const opts: string[] = [];
    if (options?.seekMs !== undefined) {
      opts.push('-ss', String(options.seekMs / 1000));
    }
    if (options?.options) {
      opts.push(...options.options);
    }
    this._inputs.push({ path, options: opts });
    return this;
  }

  output(path: string): this {
    this._outputPath = path;
    return this;
  }

  videoCodec(codec: string): this {
    this._videoOptions.push('-c:v', codec);
    return this;
  }

  videoBitrate(bitrate: string | number): this {
    this._videoOptions.push('-b:v', String(bitrate));
    return this;
  }

  fps(rate: number): this {
    this._videoOptions.push('-r', String(rate));
    return this;
  }

  size(dimensions: string | { width: number; height: number }): this {
    const value =
      typeof dimensions === 'string'
        ? dimensions
        : `${dimensions.width}x${dimensions.height}`;
    this._videoOptions.push('-s', value);
    return this;
  }

  aspect(ratio: string): this {
    this._videoOptions.push('-aspect', ratio);
    return this;
  }

  videoFilter(filter: string): this {
    this._filters.push(filter);
    return this;
  }

  videoFilters(filters: string[]): this {
    this._filters.push(...filters);
    return this;
  }

  crf(value: number): this {
    this._videoOptions.push('-crf', String(value));
    return this;
  }

  preset(
    preset:
      | 'ultrafast'
      | 'superfast'
      | 'veryfast'
      | 'faster'
      | 'fast'
      | 'medium'
      | 'slow'
      | 'slower'
      | 'veryslow',
  ): this {
    this._videoOptions.push('-preset', preset);
    return this;
  }

  pixelFormat(format: string): this {
    this._videoOptions.push('-pix_fmt', format);
    return this;
  }

  audioCodec(codec: string): this {
    this._audioOptions.push('-c:a', codec);
    return this;
  }

  audioBitrate(bitrate: string | number): this {
    this._audioOptions.push('-b:a', String(bitrate));
    return this;
  }

  audioSampleRate(rate: number): this {
    this._audioOptions.push('-ar', String(rate));
    return this;
  }

  audioChannels(count: number): this {
    this._audioOptions.push('-ac', String(count));
    return this;
  }

  audioFilter(filter: string): this {
    this._audioFilters.push(filter);
    return this;
  }

  audioFilters(filters: string[]): this {
    this._audioFilters.push(...filters);
    return this;
  }

  noAudio(): this {
    this._noAudio = true;
    return this;
  }

  seek(offsetMs: number): this {
    this._seekOption = String(offsetMs / 1000);
    return this;
  }

  duration(durationMs: number): this {
    this._durationOption = String(durationMs / 1000);
    return this;
  }

  to(positionMs: number): this {
    this._toOption = String(positionMs / 1000);
    return this;
  }

  format(fmt: string): this {
    this._formatOption = fmt;
    return this;
  }

  overwrite(allow = true): this {
    this._overwrite = allow;
    return this;
  }

  map(specifier: string): this {
    this._maps.push(specifier);
    return this;
  }

  outputOptions(options: string[]): this {
    this._outputOptions.push(...options);
    return this;
  }

  inputOptions(options: string[]): this {
    if (this._inputs.length > 0) {
      this._inputs[this._inputs.length - 1]!.options.push(...options);
    }
    return this;
  }

  complexFilter(filterGraph: string): this {
    this._complexFilter = filterGraph;
    return this;
  }

  build(): string[] {
    const args: string[] = [];

    if (this._overwrite) {
      args.push('-y');
    }

    for (const input of this._inputs) {
      args.push(...input.options, '-i', input.path);
    }

    if (this._seekOption) {
      args.push('-ss', this._seekOption);
    }

    if (this._durationOption) {
      args.push('-t', this._durationOption);
    }

    if (this._toOption) {
      args.push('-to', this._toOption);
    }

    for (const m of this._maps) {
      args.push('-map', m);
    }

    if (this._complexFilter) {
      args.push('-filter_complex', this._complexFilter);
    }

    args.push(...this._videoOptions);

    if (this._filters.length > 0) {
      args.push('-vf', this._filters.join(','));
    }

    if (this._noAudio) {
      args.push('-an');
    } else {
      args.push(...this._audioOptions);
      if (this._audioFilters.length > 0) {
        args.push('-af', this._audioFilters.join(','));
      }
    }

    if (this._formatOption) {
      args.push('-f', this._formatOption);
    }

    args.push(...this._outputOptions);

    if (this._outputPath) {
      args.push(this._outputPath);
    }

    return args;
  }

  execute(options?: ExecuteOptions): FFmpegSession {
    return FFmpeg.execute(this.build(), options);
  }
}
