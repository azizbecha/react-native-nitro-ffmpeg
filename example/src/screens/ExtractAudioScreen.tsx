import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type AudioFormat = 'mp3' | 'aac' | 'wav' | 'flac' | 'opus';

const FORMATS: { key: AudioFormat; label: string }[] = [
  { key: 'mp3', label: 'MP3' },
  { key: 'aac', label: 'AAC' },
  { key: 'wav', label: 'WAV' },
  { key: 'flac', label: 'FLAC' },
  { key: 'opus', label: 'Opus' },
];

export function ExtractAudioScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [percentage, setPercentage] = useState(0);
  const [format, setFormat] = useState<AudioFormat>('mp3');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    setIsRunning(true);
    setPercentage(0);
    setResult(null);
    setError(null);

    try {
      const { extractAudio } = require('@react-native-nitro-ffmpeg/core');
      const session = extractAudio('/path/to/video.mp4', `/path/to/audio.${format}`, {
        format,
        bitrate: '192k',
        onProgress: (p: { percentage?: number }) => setPercentage(p.percentage ?? 0),
      });
      const res = await session;
      setResult(`Audio extracted in ${Math.round(res.duration)}ms`);
    } catch (err: any) {
      setError(err?.message ?? 'Native module not available');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Extract Audio</Text>
      <Text style={styles.description}>
        Pull the audio track from a video file into a standalone audio file.
      </Text>

      <Text style={styles.sectionLabel}>Output Format</Text>
      <View style={styles.formatRow}>
        {FORMATS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.formatChip, format === f.key && styles.formatChipActive]}
            onPress={() => setFormat(f.key)}
          >
            <Text style={[styles.formatText, format === f.key && styles.formatTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, isRunning && styles.buttonDisabled]}
        onPress={handleExtract}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Extracting...' : 'Select & Extract'}
        </Text>
      </TouchableOpacity>

      {isRunning && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${percentage * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(percentage * 100)}%</Text>
        </View>
      )}

      {result && <Text style={styles.success}>{result}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  description: { fontSize: 14, color: '#888', marginBottom: 24 },
  sectionLabel: { fontSize: 13, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  formatRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  formatChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  formatChipActive: { backgroundColor: '#4a9eff20', borderColor: '#4a9eff' },
  formatText: { fontSize: 14, color: '#888' },
  formatTextActive: { color: '#4a9eff', fontWeight: '600' },
  button: { backgroundColor: '#4a9eff', borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 12 },
  progressBar: { flex: 1, height: 8, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4a9eff', borderRadius: 4 },
  progressText: { color: '#888', fontSize: 14, width: 40, textAlign: 'right' },
  success: { color: '#4aff7a', marginTop: 20, fontSize: 15 },
  error: { color: '#ff4a4a', marginTop: 20, fontSize: 15 },
});
