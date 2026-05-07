import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFFmpeg, extractAudio } from '@react-native-nitro-ffmpeg/core';

type AudioFormat = 'mp3' | 'aac' | 'wav' | 'flac' | 'opus';

const FORMATS: { key: AudioFormat; label: string }[] = [
  { key: 'mp3', label: 'MP3' },
  { key: 'aac', label: 'AAC' },
  { key: 'wav', label: 'WAV' },
  { key: 'flac', label: 'FLAC' },
  { key: 'opus', label: 'Opus' },
];

export function ExtractAudioScreen() {
  const [state, actions] = useFFmpeg();
  const [format, setFormat] = useState<AudioFormat>('mp3');

  const handleExtract = () => {
    const inputPath = '/path/to/video.mp4';
    const outputPath = `/path/to/audio.${format}`;

    extractAudio(inputPath, outputPath, {
      format,
      bitrate: '192k',
      onProgress: (p) => {
        console.log(
          `Extract progress: ${Math.round((p.percentage ?? 0) * 100)}%`,
        );
      },
    });
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
            style={[
              styles.formatChip,
              format === f.key && styles.formatChipActive,
            ]}
            onPress={() => setFormat(f.key)}
          >
            <Text
              style={[
                styles.formatText,
                format === f.key && styles.formatTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, state.isRunning && styles.buttonDisabled]}
        onPress={handleExtract}
        disabled={state.isRunning}
      >
        <Text style={styles.buttonText}>
          {state.isRunning ? 'Extracting...' : 'Select & Extract'}
        </Text>
      </TouchableOpacity>

      {state.isRunning && (
        <>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(state.percentage ?? 0) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round((state.percentage ?? 0) * 100)}%
            </Text>
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={actions.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}

      {state.result?.ok && (
        <Text style={styles.success}>
          Audio extracted in {Math.round(state.result.duration)}ms
        </Text>
      )}

      {state.error && <Text style={styles.error}>{state.error.message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  description: { fontSize: 14, color: '#888', marginBottom: 24 },
  sectionLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formatRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  formatChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  formatChipActive: {
    backgroundColor: '#4a9eff20',
    borderColor: '#4a9eff',
  },
  formatText: { fontSize: 14, color: '#888' },
  formatTextActive: { color: '#4a9eff', fontWeight: '600' },
  button: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4a9eff',
    borderRadius: 4,
  },
  progressText: { color: '#888', fontSize: 14, width: 40, textAlign: 'right' },
  cancelButton: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff4a4a',
  },
  cancelText: { color: '#ff4a4a', fontSize: 15, fontWeight: '500' },
  success: { color: '#4aff7a', marginTop: 20, fontSize: 15 },
  error: { color: '#ff4a4a', marginTop: 20, fontSize: 15 },
});
