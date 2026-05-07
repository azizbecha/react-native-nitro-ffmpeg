# react-native-nitro-ffmpeg

High-performance FFmpeg for React Native, powered by [Nitro Modules](https://github.com/mrousavy/nitro).

> The successor to the archived `ffmpeg-kit-react-native`. Built from scratch with Nitro for 15-36x faster native calls, first-class Swift/Kotlin support, and a modern TypeScript API.

## Features

- **Nitro-powered** &mdash; Direct JSI calls, no bridge serialization
- **Full FFmpeg & FFprobe** &mdash; Execute any command or use high-level helpers
- **Progress tracking** &mdash; Real-time callbacks or `AsyncIterable` streaming
- **Cancellation** &mdash; Standard `AbortController` support
- **Concurrent sessions** &mdash; Run multiple operations in parallel
- **React hook** &mdash; `useFFmpeg()` for declarative state management
- **Command builder** &mdash; Fluent API for constructing complex commands
- **Expo compatible** &mdash; Config plugin for managed workflow

## Installation

```bash
# Install the core library
npm install @react-native-nitro-ffmpeg/core react-native-nitro-modules

# Install ONE binary package (pick based on your needs):
npm install @react-native-nitro-ffmpeg/ffmpeg-min       # LGPL, ~8MB  - core codecs
npm install @react-native-nitro-ffmpeg/ffmpeg-full       # LGPL, ~25MB - all LGPL codecs
npm install @react-native-nitro-ffmpeg/ffmpeg-full-gpl   # GPL,  ~35MB - all codecs (x264, x265, etc.)
```

### iOS

```bash
cd ios && pod install
```

### Expo

Add the plugin to your `app.json`:

```json
{
  "plugins": [
    ["@react-native-nitro-ffmpeg/core/plugin", { "iosBackgroundAudio": true }]
  ]
}
```

## Quick Start

### Execute a command

```typescript
import { FFmpeg } from '@react-native-nitro-ffmpeg/core';

const result = await FFmpeg.execute([
  '-i', 'input.mp4',
  '-c:v', 'libx264',
  '-crf', '23',
  'output.mp4',
]);

if (result.ok) {
  console.log(`Done in ${result.duration}ms`);
}
```

### Progress tracking

```typescript
const session = FFmpeg.execute(args, {
  onProgress: (p) => console.log(`${Math.round((p.percentage ?? 0) * 100)}%`),
  estimatedDurationMs: 120_000,
});

// Or stream with AsyncIterable
for await (const p of session.progress) {
  updateProgressBar(p.percentage);
}
```

### Cancellation

```typescript
const controller = new AbortController();
const session = FFmpeg.execute(args, { signal: controller.signal });

// Cancel after 10 seconds
setTimeout(() => controller.abort(), 10_000);

// Or cancel directly
session.cancel();
```

### Media information

```typescript
import { FFprobe } from '@react-native-nitro-ffmpeg/core';

const info = await FFprobe.getMediaInfo('video.mp4');
console.log(info.format.durationMs);      // 120000
console.log(info.streams[0].type);         // 'video'
```

### High-level helpers

```typescript
import { compress, trim, extractAudio, thumbnail, concat } from '@react-native-nitro-ffmpeg/core';

// Compress video
await compress('input.mp4', 'output.mp4', {
  quality: 'medium',
  maxWidth: 1280,
  onProgress: (p) => setProgress(p.percentage),
});

// Trim
await trim('input.mp4', 'clip.mp4', { startMs: 5000, endMs: 15000 });

// Extract audio
await extractAudio('video.mp4', 'audio.mp3', { format: 'mp3', bitrate: '192k' });

// Thumbnail
await thumbnail('video.mp4', 'thumb.jpg', { atMs: 3000, width: 320 });

// Concatenate
await concat(['part1.mp4', 'part2.mp4'], 'merged.mp4');
```

### Command builder

```typescript
import { CommandBuilder } from '@react-native-nitro-ffmpeg/core';

const result = await new CommandBuilder()
  .input('input.mp4')
  .videoCodec('libx264')
  .crf(23)
  .preset('fast')
  .size({ width: 1280, height: 720 })
  .audioCodec('aac')
  .audioBitrate('128k')
  .output('output.mp4')
  .execute({ onProgress: (p) => console.log(p.percentage) });
```

### React hook

```typescript
import { useFFmpeg } from '@react-native-nitro-ffmpeg/core';

function VideoCompressor() {
  const [state, actions] = useFFmpeg();

  return (
    <View>
      {state.isRunning && <ProgressBar value={state.percentage ?? 0} />}
      {state.error && <Text>{state.error.message}</Text>}
      {state.result?.ok && <Text>Done!</Text>}
      <Button
        title="Compress"
        onPress={() => actions.execute(['-i', inputPath, '-crf', '28', outputPath])}
      />
      <Button title="Cancel" onPress={actions.cancel} />
    </View>
  );
}
```

## Binary Packages

| Package | License | Size | Codecs |
|---|---|---|---|
| `@react-native-nitro-ffmpeg/ffmpeg-min` | LGPL-3.0 | ~8MB/platform | Core codecs |
| `@react-native-nitro-ffmpeg/ffmpeg-full` | LGPL-3.0 | ~25MB/platform | All LGPL codecs |
| `@react-native-nitro-ffmpeg/ffmpeg-full-gpl` | GPL-3.0 | ~35MB/platform | All codecs (x264, x265, etc.) |

Choose `ffmpeg-min` for the smallest binary size, `ffmpeg-full` for broad codec support without GPL obligations, or `ffmpeg-full-gpl` for maximum codec coverage.

## Requirements

- React Native >= 0.76.0
- react-native-nitro-modules >= 0.18.0
- iOS 15.0+
- Android API 24+

## License

MIT
