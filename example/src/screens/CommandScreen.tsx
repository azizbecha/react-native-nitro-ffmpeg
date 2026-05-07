import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';

export function CommandScreen() {
  const [command, setCommand] = useState('-i input.mp4 -c:v libx264 output.mp4');
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setLogs([]);
    setResult(null);

    try {
      const { FFmpeg, LogLevel } = require('@react-native-nitro-ffmpeg/core');

      const session = FFmpeg.run(command, {
        logLevel: LogLevel.INFO,
        onLog: (log: { level: number; message: string }) => {
          setLogs((prev) => [...prev, `[LOG] ${log.message}`]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
        },
        onProgress: (p: { frame: number; fps: number; speed: number; totalSize: number }) => {
          setLogs((prev) => [
            ...prev,
            `[PROGRESS] frame=${p.frame} fps=${p.fps.toFixed(1)} speed=${p.speed.toFixed(1)}x`,
          ]);
        },
      });

      const res = await session;
      setResult(
        res.ok
          ? `Completed (${Math.round(res.duration)}ms)`
          : `Failed: ${res.failureMessage ?? `exit code ${res.returnCode}`}`,
      );
    } catch (err: any) {
      setResult(`Error: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Custom Command</Text>
      <Text style={styles.description}>
        Run any FFmpeg command and see live logs.
      </Text>

      <TextInput
        style={styles.commandInput}
        value={command}
        onChangeText={setCommand}
        multiline
        placeholderTextColor="#555"
        placeholder="Enter FFmpeg command..."
        editable={!isRunning}
      />

      <TouchableOpacity
        style={[styles.runButton, isRunning && styles.buttonDisabled]}
        onPress={handleRun}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Running...' : 'Run'}
        </Text>
      </TouchableOpacity>

      {result && (
        <Text style={[styles.result, result.startsWith('Completed') ? styles.success : styles.error]}>
          {result}
        </Text>
      )}

      {logs.length > 0 && (
        <View style={styles.logContainer}>
          <Text style={styles.logHeader}>Logs</Text>
          <ScrollView ref={scrollRef} style={styles.logScroll} contentContainerStyle={styles.logContent}>
            {logs.map((line, i) => (
              <Text key={i} style={styles.logLine}>{line}</Text>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  description: { fontSize: 14, color: '#888', marginBottom: 20 },
  commandInput: {
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, color: '#fff', fontSize: 14,
    fontFamily: 'Menlo', borderWidth: 1, borderColor: '#2a2a2a', minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
  },
  runButton: { backgroundColor: '#4a9eff', borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  result: { marginTop: 16, fontSize: 15 },
  success: { color: '#4aff7a' },
  error: { color: '#ff4a4a' },
  logContainer: { marginTop: 20, flex: 1 },
  logHeader: { fontSize: 13, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  logScroll: { backgroundColor: '#111', borderRadius: 10, maxHeight: 300, borderWidth: 1, borderColor: '#1a1a1a' },
  logContent: { padding: 12 },
  logLine: { fontSize: 11, color: '#aaa', fontFamily: 'Menlo', lineHeight: 16 },
});
