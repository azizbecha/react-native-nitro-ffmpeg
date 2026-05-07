import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';

export function TranscodeScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [percentage, setPercentage] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompress = async () => {
    setIsRunning(true);
    setPercentage(0);
    setResult(null);
    setError(null);

    try {
      const { compress } = require('@react-native-nitro-ffmpeg/core');
      const inputPath = '/path/to/input.mp4';
      const outputPath = '/path/to/output.mp4';

      const session = compress(inputPath, outputPath, {
        quality: 'medium',
        maxWidth: 1280,
        videoCodec: 'h264',
        onProgress: (p: { percentage?: number }) => {
          setPercentage(p.percentage ?? 0);
        },
      });

      const res = await session;
      setResult(`Completed in ${Math.round(res.duration)}ms`);
    } catch (err: any) {
      setError(err?.message ?? 'Native module not available');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Video Compression</Text>
      <Text style={styles.description}>
        Pick a video file and compress it with H.264 encoding. Progress is
        tracked in real-time.
      </Text>

      <TouchableOpacity
        style={[styles.button, isRunning && styles.buttonDisabled]}
        onPress={handleCompress}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Compressing...' : 'Select & Compress'}
        </Text>
      </TouchableOpacity>

      {isRunning && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${percentage * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(percentage * 100)}%
          </Text>
        </View>
      )}

      {isRunning && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            setIsRunning(false);
            setError('Cancelled');
          }}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
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
