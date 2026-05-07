import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';

export function TrimScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [percentage, setPercentage] = useState(0);
  const [startSec, setStartSec] = useState('5');
  const [endSec, setEndSec] = useState('15');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrim = async () => {
    setIsRunning(true);
    setPercentage(0);
    setResult(null);
    setError(null);

    try {
      const { trim } = require('@react-native-nitro-ffmpeg/core');
      const session = trim('/path/to/input.mp4', '/path/to/trimmed.mp4', {
        startMs: parseFloat(startSec) * 1000,
        endMs: parseFloat(endSec) * 1000,
        onProgress: (p: { percentage?: number }) => setPercentage(p.percentage ?? 0),
      });
      const res = await session;
      setResult(`Trimmed in ${Math.round(res.duration)}ms`);
    } catch (err: any) {
      setError(err?.message ?? 'Native module not available');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Trim Video</Text>
      <Text style={styles.description}>
        Cut a video to a specific time range. Set start and end times in seconds.
      </Text>

      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Start (sec)</Text>
          <TextInput
            style={styles.input}
            value={startSec}
            onChangeText={setStartSec}
            keyboardType="decimal-pad"
            placeholderTextColor="#555"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>End (sec)</Text>
          <TextInput
            style={styles.input}
            value={endSec}
            onChangeText={setEndSec}
            keyboardType="decimal-pad"
            placeholderTextColor="#555"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.button, isRunning && styles.buttonDisabled]}
        onPress={handleTrim}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Trimming...' : 'Select & Trim'}
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
  inputRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 13, color: '#888', marginBottom: 6 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
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
