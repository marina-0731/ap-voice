import { useCallback, useEffect, useState } from 'react';
import {
  blockUser,
  loadBlocked,
  reportEntry,
  subscribeBlocked,
  unblockUser,
  type ReportPayload,
} from '@/services/moderation';

/**
 * ブロックリストの購読と、通報の送信をまとめたフック。
 * ブロックは端末内で完結し、即座に反映される。
 */
export function useModeration() {
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = subscribeBlocked(setBlocked);
    loadBlocked().then(setBlocked);
    return unsubscribe;
  }, []);

  const block = useCallback(
    (userId: string, userName?: string) => blockUser(userId, userName),
    []
  );
  const unblock = useCallback((userId: string) => unblockUser(userId), []);
  const report = useCallback((payload: ReportPayload) => reportEntry(payload), []);

  return { blocked, block, unblock, report };
}
