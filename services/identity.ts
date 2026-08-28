import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = 'ap:userId';

let cached: string | null = null;

/**
 * この端末のユーザーID。
 * ブロックは userId を覚える機能なので、IDが毎回変わってしまうと意味がなくなる。
 * そのため端末に保存して使い回す(サーバーには送るが、個人情報は含まない乱数)。
 */
export async function getUserId(): Promise<string> {
  if (cached) return cached;
  try {
    const saved = await AsyncStorage.getItem(USER_ID_KEY);
    if (saved) {
      cached = saved;
      return saved;
    }
  } catch {
    /* 読めなければ作り直す */
  }
  const fresh = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  cached = fresh;
  AsyncStorage.setItem(USER_ID_KEY, fresh).catch(() => {});
  return fresh;
}
