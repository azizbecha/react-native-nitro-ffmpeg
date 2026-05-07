import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet } from 'react-native';

export function ThumbnailScreen() {
  const [timestampSec, setTimestampSec] = useState('3');
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    setLoading(true);
    setError(null);
    setOutputPath(null);

    try {
      const { thumbnail } = require('@react-native-nitro-ffmpeg/core');
      const output = '/path/to/thumbnail.jpg';
      const session = thumbnail('/path/to/video.mp4', output, {
        atMs: parseFloat(timestampSec) * 1000,
        width: 640,
        quality: 90,
      });
      const res = await session;
      if (res.ok) setOutputPath(output);
    } catch (err: any) {
      setError(err?.message ?? 'Native module not available');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Extract Thumbnail</Text>
      <Text style={styles.description}>
        Capture a single frame from a video at a specific timestamp.
      </Text>

      <Text style={styles.inputLabel}>Timestamp (seconds)</Text>
      <TextInput
        style={styles.input}
        value={timestampSec}
        onChangeText={setTimestampSec}
        keyboardType="decimal-pad"
        placeholderTextColor="#555"
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleExtract}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Extracting...' : 'Select & Extract Frame'}
        </Text>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      {outputPath && (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Extracted Frame</Text>
          <Image
            source={{ uri: `file://${outputPath}` }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  description: { fontSize: 14, color: '#888', marginBottom: 24 },
  inputLabel: { fontSize: 13, color: '#888', marginBottom: 6 },
  input: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 20 },
  button: { backgroundColor: '#4a9eff', borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#ff4a4a', marginTop: 20, fontSize: 15 },
  preview: { marginTop: 24 },
  previewLabel: { fontSize: 14, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#1a1a1a' },
});
