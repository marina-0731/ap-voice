import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';

/**
 * 押している間だけ録音する(Push-to-Talk)レコーダー。
 * MVPではVADライブラリの代わりにボタン押下を「発話開始」とみなす。
 * (フェーズ2で @picovoice/cobra によるハンズフリーVADに置換予定)
 */
export function useRecorder(
  onStart: (entryId: string) => void,
  onEnd: (entryId: string, audioBase64: string, durationMs: number) => void
) {
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const entryIdRef = useRef('');
  const startTimeRef = useRef(0);

  const start = useCallback(async () => {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    entryIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    startTimeRef.current = Date.now();
    onStart(entryIdRef.current); // タイムスタンプを即サーバーへ(順番確定が最優先)

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef.current = recording;
    setIsRecording(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [onStart]);

  const stop = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    setIsRecording(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recordingRef.current = null;
    if (!uri) return;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const durationMs = Date.now() - startTimeRef.current;
    onEnd(entryIdRef.current, base64, durationMs);
  }, [onEnd]);

  return { isRecording, start, stop };
}
