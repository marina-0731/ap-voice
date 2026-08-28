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
app.use(express.json({ limit: '256kb' }));
app.use('/audio', express.static(AUDIO_DIR));

// ヘルスチェック(Renderのスリープ解除・死活監視用)
app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() });
});

/**
 * 通報の受け口(App Store ガイドライン 1.2 対応)。
 * 記録はサーバーログに残す(Renderのログから追える)。
 * REPORT_WEBHOOK_URL を設定すると、その宛先にも転送する。
 * 運営は24時間以内に内容を確認する(利用規約に明記)。
 */
const REPORT_LIMIT_PER_MIN = 10;
const reportHits = new Map(); // ip -> { count, windowStart }

app.post('/report', (req, res) => {
  // 通報自体が荒らしに使われないよう、IPごとに軽く絞る
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const hit = reportHits.get(ip);
  if (!hit || now - hit.windowStart > 60_000) {
    reportHits.set(ip, { count: 1, windowStart: now });
  } else if (++hit.count > REPORT_LIMIT_PER_MIN) {
    return res.status(429).json({ ok: false, error: '通報が多すぎます。少し待ってからお試しください。' });
  }

  const { roomId, entryId, reporterUserId, reportedUserId, reason } = req.body ?? {};
  if (!entryId || !reportedUserId) {
    return res.status(400).json({ ok: false, error: 'entryId と reportedUserId は必須です' });
  }

  // 通報対象の文字起こしを添えて記録する(音声本体は1時間で消えるため)
  const entry = rooms.get(roomId)?.queue.find((e) => e.id === entryId);
  const record = {
    type: 'ap_report',
    at: new Date().toISOString(),
    roomId, entryId, reporterUserId, reportedUserId,
    reason: String(reason ?? '').slice(0, 500),
    transcript: entry?.transcript ?? null,
    audioUrl: entry?.audioUrl ?? null,
  };
  console.warn('[REPORT]', JSON.stringify(record));

  if (process.env.REPORT_WEBHOOK_URL) {
    fetch(process.env.REPORT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }).catch((e) => console.error('通報の転送に失敗:', e.message));
  }

  res.json({ ok: true });
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
  socket.on('speech_end', ({ roomId, userId, entryId, audioBase64, durationMs }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const entry = room.queue.find((e) => e.id === entryId);
    if (!entry) return;

    const filename = `${entryId}.m4a`;
    writeFileSync(path.join(AUDIO_DIR, filename), Buffer.from(audioBase64, 'base64'));
    entry.audioUrl = `/audio/${filename}`;
    entry.durationMs = durationMs;
    entry.isBackchannel = durationMs < BACKCHANNEL_MS;
    // 相槌はキューに並ばせず即完了(文字としてだけ残る)
    entry.status = entry.isBackchannel ? 'done' : 'ready';
    entry.transcribing = true;

    // 先に順番を進める。文字起こしの往復(1〜3秒)で再生を待たせない。
    broadcast(roomId);
    tryPlayNext(roomId);

    // 文字起こしは後追いで届く。順序はすでに speech_start で確定しているので、
    // ここが遅れても・失敗しても再生順には一切影響しない。
    transcribe(audioBase64).then((text) => {
      entry.transcript = text;
      entry.transcribing = false;
      broadcast(roomId);
    });
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
 * 文字起こし(OpenAI Whisper)。日本語固定。
 *
 * ここは「落ちてもよい」経路として設計してある:
 * - APIキーが無くてもサーバーは起動し、音声通話はそのまま動く
 * - API失敗・タイムアウトでも例外を投げず、説明文を返してキューを止めない
 * 音声は .m4a で届く。
 */
const STT_TIMEOUT_MS = 20_000;

async function transcribe(audioBase64) {
  if (!process.env.OPENAI_API_KEY) return '(文字起こしは現在利用できません)';
  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'audio/m4a' }), 'audio.m4a');
    form.append('model', 'whisper-1');
    form.append('language', 'ja');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(STT_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

    const data = await res.json();
    return data.text?.trim() || '(聞き取れませんでした)';
  } catch (e) {
    console.error('STT failed:', e.message);
    return '(文字起こしに失敗しました)';
  }
}

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => console.log(`AP server listening on :${PORT}`));
