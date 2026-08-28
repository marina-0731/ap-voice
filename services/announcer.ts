import { AccessibilityInfo } from 'react-native';

/**
 * スクリーンリーダーへの読み上げ窓口。
 *
 * このアプリは「声を聞く」ことが主目的なので、読み上げが音声再生にかぶると
 * どちらも聞き取れなくなる。そこで:
 *  - 再生中は読み上げない
 *  - 読み上げは少し遅らせて予約し、その間に再生が始まったら取り消す
 * (再生開始とキュー変化はほぼ同時に届くため、遅延なしでは競合を防げない)
 */
let playbackActive = false;
let pending: ReturnType<typeof setTimeout> | null = null;

export function setPlaybackActive(active: boolean) {
  playbackActive = active;
  if (active && pending) {
    clearTimeout(pending);
    pending = null;
  }
}

export function announce(message: string, delayMs = 250) {
  if (playbackActive) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    if (playbackActive) return;
    AccessibilityInfo.announceForAccessibility(message);
  }, delayMs);
}
