import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { TranscodeScreen } from './screens/TranscodeScreen';
import { MediaInfoScreen } from './screens/MediaInfoScreen';
import { TrimScreen } from './screens/TrimScreen';
import { ExtractAudioScreen } from './screens/ExtractAudioScreen';
import { ThumbnailScreen } from './screens/ThumbnailScreen';
import { CommandScreen } from './screens/CommandScreen';

type Screen =
  | 'home'
  | 'transcode'
  | 'mediainfo'
  | 'trim'
  | 'extractaudio'
  | 'thumbnail'
  | 'command';

const SCREENS: { key: Screen; title: string; description: string }[] = [
  {
    key: 'transcode',
    title: 'Transcode',
    description: 'Compress a video with progress tracking',
  },
  {
    key: 'mediainfo',
    title: 'Media Info',
    description: 'Inspect format, streams, and metadata',
  },
  {
    key: 'trim',
    title: 'Trim',
    description: 'Cut a video to a specific time range',
  },
  {
    key: 'extractaudio',
    title: 'Extract Audio',
    description: 'Pull audio track from a video file',
  },
  {
    key: 'thumbnail',
    title: 'Thumbnail',
    description: 'Extract a frame at a given timestamp',
  },
  {
    key: 'command',
    title: 'Command Builder',
    description: 'Run custom FFmpeg commands with live logs',
  },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');

  const renderScreen = () => {
    switch (screen) {
      case 'transcode':
        return <TranscodeScreen />;
      case 'mediainfo':
        return <MediaInfoScreen />;
      case 'trim':
        return <TrimScreen />;
      case 'extractaudio':
        return <ExtractAudioScreen />;
      case 'thumbnail':
        return <ThumbnailScreen />;
      case 'command':
        return <CommandScreen />;
      default:
        return null;
    }
  };

  if (screen !== 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('home')}>
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {SCREENS.find((s) => s.key === screen)?.title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        {renderScreen()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>react-native-nitro-ffmpeg</Text>
        <Text style={styles.subtitle}>
          High-performance FFmpeg powered by Nitro Modules
        </Text>

        {SCREENS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.card}
            onPress={() => setScreen(item.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cardDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    fontSize: 16,
    color: '#4a9eff',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
});
