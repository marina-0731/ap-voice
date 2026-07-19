import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { RoomState } from '@/services/socket';
import Constants from 'expo-constants';

const SERVER_URL: string =
  Constants.expoConfig?.extra?.serverUrl ?? 'http://localhost:3001';

/**
 * サーバーが指定した nowPlaying を忠実に再生するプレーヤー。
 * 全員が同じ順序で聞く = 「同じ場にいる」体験の担保。
 * 自分の発話はスキップ(自分の声のエコー防止)。
 */
export function useQueuePlayer(
  room: RoomState | null,
  myUserId: string,
  onDone: (entryId: string) => void
) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const playingIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nowId = room?.nowPlaying ?? null;
    if (!nowId || nowId === playingIdRef.current) return;

    const entry = room?.queue.find((e) => e.id === nowId);
    if (!entry || !entry.audioUrl) return;

    playingIdRef.current = nowId;

    // 自分の発話は再生せず完了通知だけ返す
    if (entry.userId === myUserId) {
      onDone(nowId);
      return;
    }

    (async () => {
      try {
        await soundRef.current?.unloadAsync();
        const { sound } = await Audio.Sound.createAsync(
          { uri: `${SERVER_URL}${entry.audioUrl}` },
          { shouldPlay: true }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            onDone(nowId);
          }
        });
      } catch {
        onDone(nowId); // 再生失敗でもキューを止めない
      }
    })();
  }, [room?.nowPlaying]);

  useEffect(() => () => { soundRef.current?.unloadAsync(); }, []);
}
