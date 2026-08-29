import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SERVER_URL: string =
  Constants.expoConfig?.extra?.serverUrl ?? 'http://localhost:3001';

const BLOCK_KEY = 'ap:blocked';       // userId の配列
const BLOCK_NAMES_KEY = 'ap:blockedNames'; // userId -> 表示名(解除画面で誰かを分かるように)

/**
 * ブロックリスト。フェーズ1は端末内で完結させる(サーバー側の実装は不要)。
 * 「ブロックしたらその場で効く」ことが大事なので、保存の完了を待たずに
 * メモリ上の集合を先に更新して購読者へ通知する。
 */
let blocked = new Set<string>();
let names: Record<string, string> = {};
let loaded = false;
const listeners = new Set<(b: Set<string>) => void>();

function notify() {
  const snapshot = new Set(blocked);
  listeners.forEach((fn) => fn(snapshot));
}

async function persist() {
  try {
    await AsyncStorage.multiSet([
      [BLOCK_KEY, JSON.stringify([...blocked])],
      [BLOCK_NAMES_KEY, JSON.stringify(names)],
    ]);
  } catch {
    /* 保存に失敗してもその場のブロックは効いている */
  }
}

export async function loadBlocked(): Promise<Set<string>> {
  if (loaded) return new Set(blocked);
  try {
    const [rawIds, rawNames] = await AsyncStorage.multiGet([BLOCK_KEY, BLOCK_NAMES_KEY]);
    blocked = new Set<string>(rawIds[1] ? JSON.parse(rawIds[1]) : []);
    names = rawNames[1] ? JSON.parse(rawNames[1]) : {};
  } catch {
    blocked = new Set();
    names = {};
  }
  loaded = true;
  notify();
  return new Set(blocked);
}

/** 再生ループから同期的に引ける判定(await できない場所で使う) */
export function isBlocked(userId: string): boolean {
  return blocked.has(userId);
}

export function blockUser(userId: string, userName?: string) {
  blocked.add(userId);
  if (userName) names[userId] = userName;
  notify();
  return persist();
}

export function unblockUser(userId: string) {
  blocked.delete(userId);
  delete names[userId];
  notify();
  return persist();
}

/** ブロック中の相手を「userId と表示名」で返す(解除画面用) */
export function blockedList(): { userId: string; userName: string }[] {
  return [...blocked].map((userId) => ({
    userId,
    userName: names[userId] ?? '名前のわからない人',
  }));
}

export function subscribeBlocked(fn: (b: Set<string>) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export type ReportPayload = {
  roomId: string;
  entryId: string;
  reporterUserId: string;
  reportedUserId: string;
  reason?: string;
};

/** 通報をサーバーへ送る。運営が24時間以内に確認する(利用規約に明記) */
export async function reportEntry(payload: ReportPayload): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
