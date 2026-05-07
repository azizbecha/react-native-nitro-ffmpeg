import { describe, it, expect } from 'vitest';
import { parseMediaInfo } from '../utils/parseMediaInfo';

describe('parseMediaInfo', () => {
  it('parses basic format info', () => {
    const json = JSON.stringify({
      format: {
        format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
        format_long_name: 'QuickTime / MOV',
        duration: '120.5',
        size: '15728640',
        bit_rate: '1044480',
      },
      streams: [],
      chapters: [],
    });

    const info = parseMediaInfo(json, '/path/to/video.mp4');

    expect(info.filename).toBe('/path/to/video.mp4');
    expect(info.format.name).toBe('mov,mp4,m4a,3gp,3g2,mj2');
    expect(info.format.longName).toBe('QuickTime / MOV');
    expect(info.format.durationMs).toBeCloseTo(120500);
    expect(info.format.sizeBytes).toBe(15728640);
    expect(info.format.bitrate).toBeCloseTo(1044.48);
  });

  it('parses video stream', () => {
    const json = JSON.stringify({
      format: {},
      streams: [
        {
          index: 0,
          codec_type: 'video',
          codec_name: 'h264',
          codec_long_name: 'H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10',
          width: 1920,
          height: 1080,
          pix_fmt: 'yuv420p',
          r_frame_rate: '30/1',
          bit_rate: '5000000',
          duration: '60.0',
          display_aspect_ratio: '16:9',
          tags: { language: 'eng' },
        },
      ],
      chapters: [],
    });

    const info = parseMediaInfo(json, 'test.mp4');
    const stream = info.streams[0];

    expect(stream).toBeDefined();
    expect(stream!.type).toBe('video');
    if (stream!.type === 'video') {
      expect(stream!.width).toBe(1920);
      expect(stream!.height).toBe(1080);
      expect(stream!.pixelFormat).toBe('yuv420p');
      expect(stream!.frameRate).toBe(30);
      expect(stream!.isHdr).toBe(false);
      expect(stream!.tags.language).toBe('eng');
    }
  });

  it('detects HDR content', () => {
    const json = JSON.stringify({
      format: {},
      streams: [
        {
          index: 0,
          codec_type: 'video',
          codec_name: 'hevc',
          codec_long_name: 'H.265',
          width: 3840,
          height: 2160,
          pix_fmt: 'yuv420p10le',
          r_frame_rate: '24/1',
          color_transfer: 'smpte2084',
        },
      ],
      chapters: [],
    });

    const info = parseMediaInfo(json, 'hdr.mp4');
    const stream = info.streams[0];

    expect(stream!.type).toBe('video');
    if (stream!.type === 'video') {
      expect(stream!.isHdr).toBe(true);
    }
  });

  it('parses audio stream', () => {
    const json = JSON.stringify({
      format: {},
      streams: [
        {
          index: 1,
          codec_type: 'audio',
          codec_name: 'aac',
          codec_long_name: 'AAC (Advanced Audio Coding)',
          sample_rate: '44100',
          channels: 2,
          channel_layout: 'stereo',
          bit_rate: '128000',
          duration: '60.0',
        },
      ],
      chapters: [],
    });

    const info = parseMediaInfo(json, 'test.mp4');
    const stream = info.streams[0];

    expect(stream!.type).toBe('audio');
    if (stream!.type === 'audio') {
      expect(stream!.sampleRate).toBe(44100);
      expect(stream!.channels).toBe(2);
      expect(stream!.channelLayout).toBe('stereo');
    }
  });

  it('parses chapters', () => {
    const json = JSON.stringify({
      format: {},
      streams: [],
      chapters: [
        {
          id: 1,
          start_time: '0.0',
          end_time: '30.0',
          tags: { title: 'Introduction' },
        },
        {
          id: 2,
          start_time: '30.0',
          end_time: '90.0',
          tags: { title: 'Main Content' },
        },
      ],
    });

    const info = parseMediaInfo(json, 'test.mp4');

    expect(info.chapters).toHaveLength(2);
    expect(info.chapters[0]!.startMs).toBe(0);
    expect(info.chapters[0]!.endMs).toBe(30000);
    expect(info.chapters[0]!.title).toBe('Introduction');
    expect(info.chapters[1]!.startMs).toBe(30000);
    expect(info.chapters[1]!.endMs).toBe(90000);
  });

  it('handles missing fields gracefully', () => {
    const json = JSON.stringify({});
    const info = parseMediaInfo(json, 'test.mp4');

    expect(info.filename).toBe('test.mp4');
    expect(info.streams).toEqual([]);
    expect(info.chapters).toEqual([]);
  });
});
