// キューイングの統合テスト: 2クライアントが「ほぼ同時」に話し始めた場合の順序解決
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dummyAudio = Buffer.from('dummy-audio-data').toString('base64');

const a = io(URL, { transports: ['polling'] });
const b = io(URL, { transports: ['polling'] });
let lastState = null;
a.on('room_state', (s) => (lastState = s));

await sleep(300);
a.emit('join_room', { roomId: 'test', userId: 'alice', userName: 'アリス' });
b.emit('join_room', { roomId: 'test', userId: 'bob', userName: 'ボブ' });
await sleep(200);

// ボブが 50ms 早く話し始める(0.3秒閾値以内 = ほぼ同時)
const now = Date.now();
b.emit('speech_start', { roomId: 'test', userId: 'bob', entryId: 'e-bob', clientTimestamp: now });
a.emit('speech_start', { roomId: 'test', userId: 'alice', entryId: 'e-alice', clientTimestamp: now + 50 });
await sleep(200);

// 両者とも発話終了(アリスの方が先に音声が届いても、順序はボブが先のはず)
a.emit('speech_end', { roomId: 'test', userId: 'alice', entryId: 'e-alice', audioBase64: dummyAudio, durationMs: 2000 });
await sleep(100);
b.emit('speech_end', { roomId: 'test', userId: 'bob', entryId: 'e-bob', audioBase64: dummyAudio, durationMs: 1500 });
await sleep(300);

const order = lastState.queue.map((e) => `${e.userName}:${e.status}`);
console.log('キュー順:', order.join(' → '));
const playingUser = lastState.queue.find((e) => e.id === lastState.nowPlaying)?.userName;
console.log('再生中:', playingUser);

// 検証1: ボブ(先に話し始めた)が「先に再生」される(キュー順序だけでなく再生順)
console.log(playingUser === 'ボブ' ? '✅ 再生順OK(発話開始が早いボブが先に再生)' : `❌ 再生順不正: ${playingUser}が再生中`);

// 検証2: 再生完了 → 次のエントリへ進む
a.emit('playback_done', { roomId: 'test', userId: 'alice', entryId: 'e-bob' });
b.emit('playback_done', { roomId: 'test', userId: 'bob', entryId: 'e-bob' });
await sleep(300);
const nowPlayingUser = lastState.queue.find((e) => e.id === lastState.nowPlaying)?.userName;
console.log(nowPlayingUser === 'アリス' ? '✅ キュー進行OK(ボブ→アリス)' : `❌ 進行不正: ${nowPlayingUser}`);

// 検証3: 短い発話(相槌)はキューをスキップ
a.emit('speech_start', { roomId: 'test', userId: 'alice', entryId: 'e-aizuchi', clientTimestamp: Date.now() });
await sleep(50);
a.emit('speech_end', { roomId: 'test', userId: 'alice', entryId: 'e-aizuchi', audioBase64: dummyAudio, durationMs: 400 });
await sleep(300);
const aizuchi = lastState.queue.find((e) => e.id === 'e-aizuchi');
console.log(aizuchi?.status === 'done' && aizuchi?.isBackchannel ? '✅ 相槌スキップOK' : `❌ 相槌処理不正: ${JSON.stringify(aizuchi)}`);

a.close(); b.close();
process.exit(0);
