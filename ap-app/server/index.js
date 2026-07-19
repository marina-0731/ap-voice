/**
 * AP キューイングサーバー
 * 役割: 発話イベントの順序を一元的に決定し、全クライアントに同じ再生順を配る。
 *
 * 設計原則:
 * 1. 順序の決定者はサーバーただ一人(クライアントは提案しない)
 * 2. speech_start のタイムスタンプで順序確定。音声本体は後から届いてよい
 * 3. 短い発話(相槌)はキューに並ばせず、文字としてだけ流す
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, 'audio');
if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR);

const app = express();
app.use('/audio', express.static(AUDIO_DIR));

// ヘルスチェック(Renderのスリープ解除・死活監視用)
app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() });
});

const httpServer = createServer(app);

// CORS: 本番では ALLOWED_ORIGIN を設定(未設定なら開発用に全許可)
const io = new Server(httpServer, {
  cors: { origin: process.env.ALLOWED_ORIGIN ?? '*' },
  maxHttpBufferSize: 20e6,
});

// 音声ファイルの自動掃除: 1時間経過したファイルを削除
// (APの音声は「その場で聞く」ものなので長期保存しない = プライバシー方針とも一致)
import { readdirSync, statSync, unlinkSync } from 'fs';
const AUDIO_TTL_MS = 60 * 60 * 1000;
setInterval(() => {
  try {
    for (const f of readdirSync(AUDIO_DIR)) {
      const p = path.join(AUDIO_DIR, f);
      if (Date.now() - statSync(p).mtimeMs > AUDIO_TTL_MS) unlinkSync(p);
    }
  } catch { /* 掃除失敗はサービスに影響させない */ }
}, 10 * 60 * 1000);

/** roomId -> RoomState */
const rooms = new Map();

const BACKCHANNEL_MS = 800;      // これ未満の発話は相槌扱い
const SIMULTANEOUS_MS = 300;     // これ以内の開始差は「ほぼ同時」

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { roomId, members: [], queue: [], nowPlaying: null });
  }
  return rooms.get(roomId);
}

function broadcast(roomId) {
  const room = rooms.get(roomId);
  if (room) io.to(roomId).emit('room_state', room);
}

/**
 * 次に再生すべきエントリを決めて全員に配信。
 * 重要: キュー先頭を追い越さない。先頭がまだ録音中なら待つ
 * (その人の speech_end 到着時に再びここが呼ばれる)。
 */
const STALE_RECORDING_MS = 60_000; // 録音中のまま放置された発話の破棄猶予

function tryPlayNext(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.nowPlaying) return;

  // 先頭の未完了エントリを取得(相槌・完了済みは飛ばす)
  const head = room.queue.find((e) => e.status !== 'done' && !e.isBackchannel);
  if (!head) return;

  if (head.status === 'recording') {
    // 先頭が録音中 → 追い越さずに待つ。ただし異常放置は破棄
    if (Date.now() - head.startedAt > STALE_RECORDING_MS) {
      head.status = 'done';
      broadcast(roomId);
      tryPlayNext(roomId);
    }
    return;
  }

  if (head.status === 'ready') {
    head.status = 'playing';
    room.nowPlaying = head.id;
    head.playbackAcks = new Set();
    broadcast(roomId);
  }
}

io.on('connection', (socket) => {
  socket.on('clock_sync', (_data, cb) => cb?.({ serverTime: Date.now() }));

  socket.on('join_room', ({ roomId, userId, userName }) => {
    socket.join(roomId);
    socket.data = { roomId, userId };
    const room = getRoom(roomId);
    if (!room.members.some((m) => m.userId === userId)) {
      room.members.push({ userId, userName });
    }
    broadcast(roomId);
  });

  socket.on('leave_room', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.members = room.members.filter((m) => m.userId !== userId);
    socket.leave(roomId);
    broadcast(roomId);
  });

  socket.on('disconnect', () => {
    const { roomId, userId } = socket.data ?? {};
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.members = room.members.filter((m) => m.userId !== userId);
    broadcast(roomId);
  });

  /**
   * 発話開始: この時点で順序が確定する。
   * SIMULTANEOUS_MS 以内の同時開始はタイムスタンプの早い順に安定ソート。
   */
  socket.on('speech_start', ({ roomId, userId, entryId, clientTimestamp }) => {
    const room = getRoom(roomId);
    const member = room.members.find((m) => m.userId === userId);
    room.queue.push({
      id: entryId,
      userId,
      userName: member?.userName ?? '?',
      startedAt: clientTimestamp,
      status: 'recording',
    });
    // 「ほぼ同時」帯の中では startedAt で並べ直す(到着順の揺らぎを吸収)
    room.queue.sort((a, b) => {
      if (a.status === 'done' || a.status === 'playing') return -1;
      if (b.status === 'done' || b.status === 'playing') return 1;
      return Math.abs(a.startedAt - b.startedAt) < SIMULTANEOUS_MS
        ? a.startedAt - b.startedAt
        : 0; // 帯を跨ぐ並べ替えはしない(FIFOを維持)
    });
    broadcast(roomId);
  });

  /** 発話終了: 音声を保存し、相槌判定してから再生キューへ */
  socket.on('speech_end', async ({ roomId, userId, entryId, audioBase64, durationMs }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const entry = room.queue.find((e) => e.id === entryId);
    if (!entry) return;

    const filename = `${entryId}.m4a`;
    writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(audioBase64, 'base64'));
    entry.audioUrl = `/audio/${filename}`;
    entry.durationMs = durationMs;
    entry.isBackchannel = durationMs < BACKCHANNEL_MS;
    entry.status = 'ready';

    // 文字起こし(MVPはスタブ。本番はSTT APIをここに接続)
    entry.transcript = await transcribe(audioBase64, durationMs);

    if (entry.isBackchannel) {
      // 相槌はキューに並ばせず即完了(文字としてだけ残る)
      entry.status = 'done';
    }
    broadcast(roomId);
    tryPlayNext(roomId);
  });

  /** 全員の再生完了が揃ったら次へ */
  socket.on('playback_done', ({ roomId, userId, entryId }) => {
    const room = rooms.get(roomId);
    if (!room || room.nowPlaying !== entryId) return;
    const entry = room.queue.find((e) => e.id === entryId);
    if (!entry) return;
    entry.playbackAcks?.add(userId);
    // 全メンバーが聞き終わるか、タイムアウトで次へ進む
    if (entry.playbackAcks.size >= room.members.length) {
      finishEntry(room, entry);
    } else if (!entry._ackTimer) {
      entry._ackTimer = setTimeout(() => finishEntry(room, entry), (entry.durationMs ?? 5000) + 8000);
    }
  });
});

function finishEntry(room, entry) {
  clearTimeout(entry._ackTimer);
  delete entry._ackTimer;
  delete entry.playbackAcks;
  entry.status = 'done';
  room.nowPlaying = null;
  // 履歴が肥大しないように古いdoneを間引く(直近50件は残す)
  const done = room.queue.filter((e) => e.status === 'done');
  if (done.length > 50) {
    const removeIds = new Set(done.slice(0, done.length - 50).map((e) => e.id));
    room.queue = room.queue.filter((e) => !removeIds.has(e.id));
  }
  broadcast(room.roomId);
  tryPlayNext(room.roomId);
}

/**
 * STTスタブ。本番では Google Speech-to-Text / Whisper API に差し替える。
 * 差し替えポイントはこの関数だけに閉じてある。
 */
async function transcribe(_audioBase64, durationMs) {
  return `(音声メッセージ ${Math.round(durationMs / 1000)}秒)`;
}

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => console.log(`AP server listening on :${PORT}`));
