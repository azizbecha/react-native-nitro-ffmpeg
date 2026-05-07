import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FFprobe, type MediaInfo } from '@react-native-nitro-ffmpeg/core';

export function MediaInfoScreen() {
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async () => {
    setLoading(true);
    setError(null);
    try {
      const path = '/path/to/video.mp4';
      const mediaInfo = await FFprobe.getMediaInfo(path);
      setInfo(mediaInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
          <InfoSection title="Format">
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
          </InfoSection>

          {info.streams.map((stream, i) => (
            <InfoSection key={i} title={`Stream ${stream.index} (${stream.type})`}>
              <InfoRow label="Codec" value={stream.codecName} />
              {stream.type === 'video' && (
                <>
                  <InfoRow
                    label="Resolution"
                    value={`${stream.width}x${stream.height}`}
                  />
                  <InfoRow
                    label="Frame Rate"
                    value={`${stream.frameRate.toFixed(2)} fps`}
                  />
                  <InfoRow label="Pixel Format" value={stream.pixelFormat} />
                  <InfoRow label="HDR" value={stream.isHdr ? 'Yes' : 'No'} />
                </>
              )}
              {stream.type === 'audio' && (
                <>
                  <InfoRow
                    label="Sample Rate"
                    value={`${stream.sampleRate} Hz`}
                  />
                  <InfoRow label="Channels" value={String(stream.channels)} />
                  <InfoRow label="Layout" value={stream.channelLayout} />
                </>
              )}
            </InfoSection>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
