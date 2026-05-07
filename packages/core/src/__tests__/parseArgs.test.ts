import { describe, it, expect } from 'vitest';
import { parseArgs } from '../utils/parseArgs';

describe('parseArgs', () => {
  it('splits simple arguments', () => {
    expect(parseArgs('-i input.mp4 output.mp4')).toEqual([
      '-i',
      'input.mp4',
      'output.mp4',
    ]);
  });

  it('handles double-quoted strings', () => {
    expect(parseArgs('-i "my file.mp4" output.mp4')).toEqual([
      '-i',
      'my file.mp4',
      'output.mp4',
    ]);
  });

  it('handles single-quoted strings', () => {
    expect(parseArgs("-i 'my file.mp4' output.mp4")).toEqual([
      '-i',
      'my file.mp4',
      'output.mp4',
    ]);
  });

  it('handles escaped spaces', () => {
    expect(parseArgs('-i my\\ file.mp4 output.mp4')).toEqual([
      '-i',
      'my file.mp4',
      'output.mp4',
    ]);
  });

  it('handles multiple spaces between args', () => {
    expect(parseArgs('-i   input.mp4   output.mp4')).toEqual([
      '-i',
      'input.mp4',
      'output.mp4',
    ]);
  });

  it('handles complex FFmpeg command', () => {
    expect(
      parseArgs(
        '-i input.mp4 -c:v libx264 -crf 23 -preset fast -vf "scale=1280:-2" output.mp4',
      ),
    ).toEqual([
      '-i',
      'input.mp4',
      '-c:v',
      'libx264',
      '-crf',
      '23',
      '-preset',
      'fast',
      '-vf',
      'scale=1280:-2',
      'output.mp4',
    ]);
  });

  it('handles empty string', () => {
    expect(parseArgs('')).toEqual([]);
  });

  it('handles leading/trailing spaces', () => {
    expect(parseArgs('  -i input.mp4  ')).toEqual(['-i', 'input.mp4']);
  });

  it('handles filter_complex with quotes', () => {
    expect(
      parseArgs(
        '-i a.mp4 -i b.mp4 -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1" output.mp4',
      ),
    ).toEqual([
      '-i',
      'a.mp4',
      '-i',
      'b.mp4',
      '-filter_complex',
      '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1',
      'output.mp4',
    ]);
  });
});
