import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket, QueueEntry, RoomState } from '@/services/socket';

/**
 * ルームのキュー状態を購読し、発話イベントを送信するフック。
 * サーバーが唯一の順序決定者(single source of truth)。
 * クライアントは speech_start / speech_end を投げるだけで、
 * 並び順の解決には一切関与しない。
 */
export function useSocketQueue(roomId: string, userId: string, userName: string) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const clockOffsetRef = useRef(0); // serverTime - clientTime

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      // 時計同期(簡易NTP): 往復時間の半分を補正
      const t0 = Date.now();
      socket.emit('clock_sync', { t0 }, (res: { serverTime: number }) => {
        const t1 = Date.now();
        const rtt = t1 - t0;
        clockOffsetRef.current = res.serverTime + rtt / 2 - t1;
      });
      socket.emit('join_room', { roomId, userId, userName });
    };

    const onRoomState = (state: RoomState) => setRoom(state);

    socket.on('connect', onConnect);
    socket.on('room_state', onRoomState);
    if (socket.connected) onConnect();

    return () => {
      socket.emit('leave_room', { roomId, userId });
      socket.off('connect', onConnect);
      socket.off('room_state', onRoomState);
    };
  }, [roomId, userId, userName]);

  /** 発話開始を即座に通知(音声データより先にタイムスタンプが走る) */
  const notifySpeechStart = useCallback((entryId: string) => {
    getSocket().emit('speech_start', {
      roomId,
      userId,
      entryId,
      clientTimestamp: Date.now() + clockOffsetRef.current,
    });
  }, [roomId, userId]);

  /** 発話終了 + 音声本体を送信 */
  const notifySpeechEnd = useCallback(
    (entryId: string, audioBase64: string, durationMs: number) => {
      getSocket().emit('speech_end', { roomId, userId, entryId, audioBase64, durationMs });
    },
    [roomId, userId]
  );

  /** 再生完了をサーバーへ(次のキュー再生のトリガー) */
  const notifyPlaybackDone = useCallback((entryId: string) => {
    getSocket().emit('playback_done', { roomId, userId, entryId });
  }, [roomId, userId]);

  const myQueuePosition = room
    ? room.queue.findIndex(
        (e) => e.userId === userId && (e.status === 'recording' || e.status === 'ready')
      )
    : -1;

  return { room, connected, notifySpeechStart, notifySpeechEnd, notifyPlaybackDone, myQueuePosition };
}
