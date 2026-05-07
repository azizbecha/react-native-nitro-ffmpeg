import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface MediaInfoData {
  format: {
    name: string;
    longName: string;
    durationMs: number;
    sizeBytes: number;
    bitrate: number;
  };
  streams: Array<{
    index: number;
    type: string;
    codecName: string;
    width?: number;
    height?: number;
    frameRate?: number;
    pixelFormat?: string;
    isHdr?: boolean;
    sampleRate?: number;
    channels?: number;
    channelLayout?: string;
  }>;
}

export function MediaInfoScreen() {
  const [info, setInfo] = useState<MediaInfoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async () => {
    setLoading(true);
    setError(null);
    try {
      const { FFprobe } = require('@react-native-nitro-ffmpeg/core');
      const path = '/path/to/video.mp4';
      const mediaInfo = await FFprobe.getMediaInfo(path);
      setInfo(mediaInfo);
    } catch (err: any) {
      setError(err?.message ?? 'Native module not available');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Media Information</Text>
      <Text style={styles.description}>
        Select a media file to inspect its format, streams, codecs, and
        metadata.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handlePick}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Analyzing...' : 'Select File'}
        </Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator style={styles.loader} color="#4a9eff" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {info && (
        <View style={styles.infoContainer}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Format</Text>
            <InfoRow label="Name" value={info.format.name} />
            <InfoRow label="Long Name" value={info.format.longName} />
            <InfoRow
              label="Duration"
              value={`${(info.format.durationMs / 1000).toFixed(1)}s`}
            />
            <InfoRow
              label="Size"
              value={`${(info.format.sizeBytes / 1024 / 1024).toFixed(2)} MB`}
            />
            <InfoRow
              label="Bitrate"
              value={`${Math.round(info.format.bitrate)} kbps`}
            />
          </View>

          {info.streams.map((stream, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.sectionTitle}>
                Stream {stream.index} ({stream.type})
              </Text>
              <InfoRow label="Codec" value={stream.codecName} />
              {stream.type === 'video' && (
                <>
                  <InfoRow
                    label="Resolution"
                    value={`${stream.width}x${stream.height}`}
                  />
                  <InfoRow
                    label="Frame Rate"
                    value={`${(stream.frameRate ?? 0).toFixed(2)} fps`}
                  />
                </>
              )}
              {stream.type === 'audio' && (
                <>
                  <InfoRow
                    label="Sample Rate"
                    value={`${stream.sampleRate} Hz`}
                  />
                  <InfoRow label="Channels" value={String(stream.channels)} />
                </>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  description: { fontSize: 14, color: '#888', marginBottom: 24 },
  button: {
    backgroundColor: '#4a9eff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loader: { marginTop: 20 },
  error: { color: '#ff4a4a', marginTop: 20, fontSize: 15 },
  infoContainer: { marginTop: 24 },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a9eff',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: { fontSize: 14, color: '#888' },
  value: { fontSize: 14, color: '#fff', fontWeight: '500' },
});
