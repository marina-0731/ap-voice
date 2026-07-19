import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

const SERVER_URL: string =
  Constants.expoConfig?.extra?.serverUrl ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, { transports: ['websocket'] });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// ---- 型定義(サーバーと共有) ----
export type QueueEntry = {
  id: string;
  userId: string;
  userName: string;
  startedAt: number;        // サーバー補正済みタイムスタンプ
  status: 'recording' | 'ready' | 'playing' | 'done';
  audioUrl?: string;
  transcript?: string;
  isBackchannel?: boolean;  // 相槌判定(キューをスキップ)
  durationMs?: number;
};

export type RoomState = {
  roomId: string;
  members: { userId: string; userName: string; a11y?: 'visual' | 'auditory' | null }[];
  queue: QueueEntry[];
  nowPlaying: string | null; // QueueEntry.id
};
