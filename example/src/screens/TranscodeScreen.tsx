import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFFmpeg, compress } from '@react-native-nitro-ffmpeg/core';

export function TranscodeScreen() {
  const [state, actions] = useFFmpeg();

  const handleCompress = () => {
    const inputPath = '/path/to/input.mp4';
    const outputPath = '/path/to/output.mp4';

    compress(inputPath, outputPath, {
      quality: 'medium',
      maxWidth: 1280,
      videoCodec: 'h264',
      onProgress: (p) => {
        // Progress is also tracked via useFFmpeg state
        console.log(`Progress: ${Math.round((p.percentage ?? 0) * 100)}%`);
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Video Compression</Text>
      <Text style={styles.description}>
        Pick a video file and compress it with H.264 encoding. Progress is
        tracked in real-time.
      </Text>

      <TouchableOpacity
        style={[styles.button, state.isRunning && styles.buttonDisabled]}
        onPress={handleCompress}
        disabled={state.isRunning}
      >
        <Text style={styles.buttonText}>
          {state.isRunning ? 'Compressing...' : 'Select & Compress'}
        </Text>
      </TouchableOpacity>

      {state.isRunning && (
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
      )}

      {state.isRunning && (
        <TouchableOpacity style={styles.cancelButton} onPress={actions.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}

      {state.result?.ok && (
        <Text style={styles.success}>
          Completed in {Math.round(state.result.duration)}ms
        </Text>
      )}

      {state.error && (
        <Text style={styles.error}>{state.error.message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  description: { fontSize: 14, color: '#888', marginBottom: 24 },
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
