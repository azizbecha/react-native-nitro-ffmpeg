import { describe, it, expect, vi } from 'vitest';
import { CommandBuilder } from '../CommandBuilder';

vi.mock('../FFmpeg', () => ({
  FFmpeg: {
    execute: vi.fn(),
  },
}));

describe('CommandBuilder', () => {
  it('builds basic transcode command', () => {
    const args = new CommandBuilder()
      .input('input.mp4')
      .videoCodec('libx264')
      .output('output.mp4')
      .build();

    expect(args).toEqual(['-i', 'input.mp4', '-c:v', 'libx264', 'output.mp4']);
  });

  it('builds command with CRF and preset', () => {
    const args = new CommandBuilder()
      .input('input.mp4')
      .videoCodec('libx264')
      .crf(23)
      .preset('fast')
      .output('output.mp4')
      .build();

    expect(args).toEqual([
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      '-crf', '23',
      '-preset', 'fast',
      'output.mp4',
    ]);
  });

  it('builds command with video and audio options', () => {
    const args = new CommandBuilder()
      .input('input.mp4')
      .videoCodec('libx264')
      .videoBitrate('2M')
      .audioCodec('aac')
      .audioBitrate('128k')
      .output('output.mp4')
      .build();

    expect(args).toEqual([
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      '-b:v', '2M',
      '-c:a', 'aac',
      '-b:a', '128k',
      'output.mp4',
    ]);
  });

  it('builds command with size as object', () => {
    const args = new CommandBuilder()
      .input('input.mp4')
      .size({ width: 1280, height: 720 })
      .output('output.mp4')
      .build();

    expect(args).toEqual([
      '-i', 'input.mp4',
      '-s', '1280x720',
      'output.mp4',
    ]);
  });

  it('builds command with video filter', () => {
    const args = new CommandBuilder()
      .input('input.mp4')
      .videoFilter('scale=1280:-2')
      .videoFilter('eq=brightness=0.1')
      .output('output.mp4')
      .build();

    expect(args).toEqual([
      '-i', 'input.mp4',
      '-vf', 'scale=1280:-2,eq=brightness=0.1',
      'output.mp4',
    ]);
  });

  it('builds command with noAudio', () => {
    const args = new CommandBuilder()
      .input('input.mp4')
      .noAudio()
      .output('output.mp4')
      .build();

    expect(args).toEqual(['-i', 'input.mp4', '-an', 'output.mp4']);
  });

  it('builds command with overwrite flag', () => {
    const args = new CommandBuilder()
      .overwrite()
      .input('input.mp4')
      .output('output.mp4')
      .build();

    expect(args).toEqual(['-y', '-i', 'input.mp4', 'output.mp4']);
  });

  it('builds command with seek and duration', () => {
    const args = new CommandBuilder()
      .input('input.mp4')
      .seek(5000) // 5 seconds
      .duration(10000) // 10 seconds
      .output('output.mp4')
      .build();

    expect(args).toEqual([
      '-i', 'input.mp4',
      '-ss', '5',
      '-t', '10',
      'output.mp4',
    ]);
  });

  it('builds command with complex filter', () => {
    const args = new CommandBuilder()
      .input('a.mp4')
      .input('b.mp4')
      .complexFilter('[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]')
      .map('[outv]')
      .map('[outa]')
      .output('merged.mp4')
      .build();

    expect(args).toEqual([
      '-i', 'a.mp4',
      '-i', 'b.mp4',
      '-map', '[outv]',
      '-map', '[outa]',
      '-filter_complex', '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]',
      'merged.mp4',
    ]);
  });

  it('builds command with multiple inputs and input options', () => {
    const args = new CommandBuilder()
      .input('input.mp4', { seekMs: 3000 })
      .videoCodec('libx264')
      .output('output.mp4')
      .build();

    expect(args).toEqual([
      '-ss', '3',
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      'output.mp4',
    ]);
  });

  it('builds command with format', () => {
    const args = new CommandBuilder()
      .input('input.mp4')
      .format('mp3')
      .output('output.mp3')
      .build();

    expect(args).toEqual([
      '-i', 'input.mp4',
      '-f', 'mp3',
      'output.mp3',
    ]);
  });

  it('builds command with output options', () => {
    const args = new CommandBuilder()
      .input('input.mp4')
      .outputOptions(['-movflags', 'faststart'])
      .output('output.mp4')
      .build();

    expect(args).toEqual([
      '-i', 'input.mp4',
      '-movflags', 'faststart',
      'output.mp4',
    ]);
  });
});
