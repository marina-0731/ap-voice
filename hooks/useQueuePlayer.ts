import { useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { RoomState } from '@/services/socket';
import { isBlocked } from '@/services/moderation';
import { setPlaybackActive } from '@/services/announcer';
import Constants from 'expo-constants';

const SERVER_URL: string =
  Constants.expoConfig?.extra?.serverUrl ?? 'http://localhost:3001';

/**
 * サーバーが指定した nowPlaying を忠実に再生するプレーヤー。
 * 全員が同じ順序で聞く = 「同じ場にいる」体験の担保。
 * 自分の発話とブロック中の相手の発話はスキップし、すぐ次へ送る。
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

    // 自分の発話(エコー防止)とブロック中の相手は鳴らさず、完了通知だけ返す。
    // キューは止めない = 他の人の順番に影響を与えない。
    if (entry.userId === myUserId || isBlocked(entry.userId)) {
      onDone(nowId);
      return;
    }

    // 読み上げとの競合を防ぐため、再生開始の判断と同時に(await より前に)立てる
    setPlaybackActive(true);

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
            setPlaybackActive(false);
            onDone(nowId);
          }
        });
      } catch {
        setPlaybackActive(false);
        onDone(nowId); // 再生失敗でもキューを止めない
      }
    })();
  }, [room?.nowPlaying]);

  useEffect(
    () => () => {
      setPlaybackActive(false);
      soundRef.current?.unloadAsync();
    },
    []
  );
}
