import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';

type Screen =
  | 'home'
  | 'transcode'
  | 'mediainfo'
  | 'trim'
  | 'extractaudio'
  | 'thumbnail'
  | 'command';

const SCREENS: {key: Screen; title: string; desc: string}[] = [
  {key: 'transcode', title: 'Transcode', desc: 'Compress a video with progress tracking'},
  {key: 'mediainfo', title: 'Media Info', desc: 'Inspect format, streams, and metadata'},
  {key: 'trim', title: 'Trim', desc: 'Cut a video to a specific time range'},
  {key: 'extractaudio', title: 'Extract Audio', desc: 'Pull audio track from a video file'},
  {key: 'thumbnail', title: 'Thumbnail', desc: 'Extract a frame at a given timestamp'},
  {key: 'command', title: 'Command Builder', desc: 'Run custom FFmpeg commands with live logs'},
];

function TranscodeScreen() {
  const [running, setRunning] = useState(false);
  const [pct, setPct] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true); setPct(0); setResult(null); setError(null);
    try {
      const {compress} = require('@react-native-nitro-ffmpeg/core');
      const s = compress('/sdcard/input.mp4', '/sdcard/output.mp4', {
        quality: 'medium', maxWidth: 1280,
        onProgress: (p: any) => setPct(p.percentage ?? 0),
      });
      const r = await s;
      setResult(`Done in ${Math.round(r.duration)}ms`);
    } catch (e: any) { setError(e?.message ?? 'Error'); }
    finally { setRunning(false); }
  };

  return (
    <View style={s.page}>
      <Text style={s.h1}>Video Compression</Text>
      <Text style={s.desc}>Compress with H.264 encoding and real-time progress.</Text>
      <Btn label={running ? 'Compressing...' : 'Select & Compress'} onPress={run} disabled={running} />
      {running && <Progress value={pct} />}
      {running && <Btn label="Cancel" onPress={() => { setRunning(false); setError('Cancelled'); }} outline />}
      {result && <Text style={s.ok}>{result}</Text>}
      {error && <Text style={s.err}>{error}</Text>}
    </View>
  );
}

function MediaInfoScreen() {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const {FFprobe} = require('@react-native-nitro-ffmpeg/core');
      setInfo(await FFprobe.getMediaInfo('/sdcard/video.mp4'));
    } catch (e: any) { setError(e?.message ?? 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView style={s.page}>
      <Text style={s.h1}>Media Information</Text>
      <Text style={s.desc}>Inspect format, streams, codecs, and metadata.</Text>
      <Btn label={loading ? 'Analyzing...' : 'Select File'} onPress={run} disabled={loading} />
      {loading && <ActivityIndicator style={{marginTop: 20}} color="#4a9eff" />}
      {error && <Text style={s.err}>{error}</Text>}
      {info && (
        <View style={{marginTop: 20}}>
          <Card title="Format">
            <Row l="Name" v={info.format?.name} />
            <Row l="Duration" v={`${(info.format?.durationMs / 1000).toFixed(1)}s`} />
            <Row l="Size" v={`${(info.format?.sizeBytes / 1024 / 1024).toFixed(2)} MB`} />
          </Card>
          {info.streams?.map((st: any, i: number) => (
            <Card key={i} title={`Stream ${st.index} (${st.type})`}>
              <Row l="Codec" v={st.codecName} />
              {st.type === 'video' && <Row l="Resolution" v={`${st.width}x${st.height}`} />}
              {st.type === 'audio' && <Row l="Sample Rate" v={`${st.sampleRate} Hz`} />}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function TrimScreen() {
  const [running, setRunning] = useState(false);
  const [pct, setPct] = useState(0);
  const [start, setStart] = useState('5');
  const [end, setEnd] = useState('15');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true); setPct(0); setResult(null); setError(null);
    try {
      const {trim} = require('@react-native-nitro-ffmpeg/core');
      const r = await trim('/sdcard/input.mp4', '/sdcard/trimmed.mp4', {
        startMs: parseFloat(start) * 1000, endMs: parseFloat(end) * 1000,
        onProgress: (p: any) => setPct(p.percentage ?? 0),
      });
      setResult(`Trimmed in ${Math.round(r.duration)}ms`);
    } catch (e: any) { setError(e?.message ?? 'Error'); }
    finally { setRunning(false); }
  };

  return (
    <View style={s.page}>
      <Text style={s.h1}>Trim Video</Text>
      <Text style={s.desc}>Cut to a specific time range.</Text>
      <View style={{flexDirection: 'row', gap: 12, marginBottom: 20}}>
        <View style={{flex: 1}}>
          <Text style={s.label}>Start (sec)</Text>
          <TextInput style={s.input} value={start} onChangeText={setStart} keyboardType="decimal-pad" placeholderTextColor="#555" />
        </View>
        <View style={{flex: 1}}>
          <Text style={s.label}>End (sec)</Text>
          <TextInput style={s.input} value={end} onChangeText={setEnd} keyboardType="decimal-pad" placeholderTextColor="#555" />
        </View>
      </View>
      <Btn label={running ? 'Trimming...' : 'Select & Trim'} onPress={run} disabled={running} />
      {running && <Progress value={pct} />}
      {result && <Text style={s.ok}>{result}</Text>}
      {error && <Text style={s.err}>{error}</Text>}
    </View>
  );
}

function ExtractAudioScreen() {
  const [running, setRunning] = useState(false);
  const [pct, setPct] = useState(0);
  const [fmt, setFmt] = useState('mp3');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fmts = ['mp3', 'aac', 'wav', 'flac', 'opus'];

  const run = async () => {
    setRunning(true); setPct(0); setResult(null); setError(null);
    try {
      const {extractAudio} = require('@react-native-nitro-ffmpeg/core');
      const r = await extractAudio('/sdcard/video.mp4', `/sdcard/audio.${fmt}`, {
        format: fmt, bitrate: '192k',
        onProgress: (p: any) => setPct(p.percentage ?? 0),
      });
      setResult(`Extracted in ${Math.round(r.duration)}ms`);
    } catch (e: any) { setError(e?.message ?? 'Error'); }
    finally { setRunning(false); }
  };

  return (
    <View style={s.page}>
      <Text style={s.h1}>Extract Audio</Text>
      <Text style={s.desc}>Pull audio track from a video file.</Text>
      <Text style={s.label}>Output Format</Text>
      <View style={{flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap'}}>
        {fmts.map(f => (
          <TouchableOpacity key={f} onPress={() => setFmt(f)}
            style={[s.chip, fmt === f && s.chipActive]}>
            <Text style={[s.chipText, fmt === f && s.chipTextActive]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Btn label={running ? 'Extracting...' : 'Select & Extract'} onPress={run} disabled={running} />
      {running && <Progress value={pct} />}
      {result && <Text style={s.ok}>{result}</Text>}
      {error && <Text style={s.err}>{error}</Text>}
    </View>
  );
}

function ThumbnailScreen() {
  const [loading, setLoading] = useState(false);
  const [ts, setTs] = useState('3');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setResult(null); setError(null);
    try {
      const {thumbnail} = require('@react-native-nitro-ffmpeg/core');
      const r = await thumbnail('/sdcard/video.mp4', '/sdcard/thumb.jpg', {
        atMs: parseFloat(ts) * 1000, width: 640, quality: 90,
      });
      if (r.ok) setResult('Frame extracted');
    } catch (e: any) { setError(e?.message ?? 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <View style={s.page}>
      <Text style={s.h1}>Extract Thumbnail</Text>
      <Text style={s.desc}>Capture a single frame at a specific timestamp.</Text>
      <Text style={s.label}>Timestamp (seconds)</Text>
      <TextInput style={[s.input, {marginBottom: 20}]} value={ts} onChangeText={setTs} keyboardType="decimal-pad" placeholderTextColor="#555" />
      <Btn label={loading ? 'Extracting...' : 'Select & Extract Frame'} onPress={run} disabled={loading} />
      {error && <Text style={s.err}>{error}</Text>}
      {result && <Text style={s.ok}>{result}</Text>}
    </View>
  );
}

function CommandScreen() {
  const [cmd, setCmd] = useState('-i input.mp4 -c:v libx264 output.mp4');
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setRunning(true); setLogs([]); setResult(null);
    try {
      const {FFmpeg} = require('@react-native-nitro-ffmpeg/core');
      const session = FFmpeg.run(cmd, {
        onLog: (l: any) => setLogs(p => [...p, `[LOG] ${l.message}`]),
        onProgress: (p: any) => setLogs(pr => [...pr, `[PROGRESS] frame=${p.frame} speed=${p.speed?.toFixed(1)}x`]),
      });
      const r = await session;
      setResult(r.ok ? `Completed (${Math.round(r.duration)}ms)` : `Failed: ${r.failureMessage}`);
    } catch (e: any) { setResult(`Error: ${e?.message}`); }
    finally { setRunning(false); }
  };

  return (
    <View style={s.page}>
      <Text style={s.h1}>Custom Command</Text>
      <Text style={s.desc}>Run any FFmpeg command and see live logs.</Text>
      <TextInput style={[s.input, {minHeight: 80, textAlignVertical: 'top', fontFamily: 'monospace', marginBottom: 16}]}
        value={cmd} onChangeText={setCmd} multiline editable={!running} placeholderTextColor="#555" />
      <Btn label={running ? 'Running...' : 'Run'} onPress={run} disabled={running} />
      {result && <Text style={[result.startsWith('Completed') ? s.ok : s.err, {marginTop: 16}]}>{result}</Text>}
      {logs.length > 0 && (
        <ScrollView style={{backgroundColor: '#111', borderRadius: 10, maxHeight: 250, marginTop: 16, borderWidth: 1, borderColor: '#1a1a1a', padding: 12}}>
          {logs.map((l, i) => <Text key={i} style={{fontSize: 11, color: '#aaa', fontFamily: 'monospace', lineHeight: 16}}>{l}</Text>)}
        </ScrollView>
      )}
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');

  const screenMap: Record<Screen, React.ReactNode> = {
    home: null,
    transcode: <TranscodeScreen />,
    mediainfo: <MediaInfoScreen />,
    trim: <TrimScreen />,
    extractaudio: <ExtractAudioScreen />,
    thumbnail: <ThumbnailScreen />,
    command: <CommandScreen />,
  };

  if (screen !== 'home') {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" />
        <View style={s.header}>
          <TouchableOpacity onPress={() => setScreen('home')}>
            <Text style={s.back}>Back</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{SCREENS.find(x => x.key === screen)?.title}</Text>
          <View style={{width: 40}} />
        </View>
        {screenMap[screen]}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{padding: 20, paddingTop: 40}}>
        <Text style={s.title}>react-native-nitro-ffmpeg</Text>
        <Text style={s.subtitle}>High-performance FFmpeg powered by Nitro Modules</Text>
        {SCREENS.map(item => (
          <TouchableOpacity key={item.key} style={s.card} onPress={() => setScreen(item.key)} activeOpacity={0.7}>
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.cardDesc}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Btn({label, onPress, disabled, outline}: {label: string; onPress: () => void; disabled?: boolean; outline?: boolean}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}
      style={[outline ? s.btnOutline : s.btn, disabled && {opacity: 0.5}]}>
      <Text style={outline ? s.btnOutlineText : s.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Progress({value}: {value: number}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 12}}>
      <View style={{flex: 1, height: 8, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden'}}>
        <View style={{height: '100%', width: `${value * 100}%`, backgroundColor: '#4a9eff', borderRadius: 4}} />
      </View>
      <Text style={{color: '#888', fontSize: 14, width: 40, textAlign: 'right'}}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

function Card({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <View style={{backgroundColor: '#1a1a1a', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a'}}>
      <Text style={{fontSize: 16, fontWeight: '600', color: '#4a9eff', marginBottom: 12}}>{title}</Text>
      {children}
    </View>
  );
}

function Row({l, v}: {l: string; v: string}) {
  return (
    <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6}}>
      <Text style={{fontSize: 14, color: '#888'}}>{l}</Text>
      <Text style={{fontSize: 14, color: '#fff', fontWeight: '500'}}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0a0a0a'},
  title: {fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center'},
  subtitle: {fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8, marginBottom: 32},
  card: {backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a'},
  cardTitle: {fontSize: 18, fontWeight: '600', color: '#fff'},
  cardDesc: {fontSize: 13, color: '#888', marginTop: 4},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a'},
  back: {fontSize: 16, color: '#4a9eff'},
  headerTitle: {fontSize: 17, fontWeight: '600', color: '#fff'},
  page: {flex: 1, padding: 20},
  h1: {fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8},
  desc: {fontSize: 14, color: '#888', marginBottom: 24},
  label: {fontSize: 13, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5},
  input: {backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a'},
  btn: {backgroundColor: '#4a9eff', borderRadius: 10, padding: 16, alignItems: 'center'},
  btnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  btnOutline: {marginTop: 12, padding: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#ff4a4a'},
  btnOutlineText: {color: '#ff4a4a', fontSize: 15, fontWeight: '500'},
  chip: {paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a'},
  chipActive: {backgroundColor: '#4a9eff20', borderColor: '#4a9eff'},
  chipText: {fontSize: 14, color: '#888'},
  chipTextActive: {color: '#4a9eff', fontWeight: '600'},
  ok: {color: '#4aff7a', marginTop: 20, fontSize: 15},
  err: {color: '#ff4a4a', marginTop: 20, fontSize: 15},
});
