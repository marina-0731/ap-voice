import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * VoiceOver / TalkBack が有効かどうか。
 *
 * 有効なとき「押している間だけ録音」は成立しない。スクリーンリーダーは
 * 長押しなどのジェスチャを先に横取りするため、押しっぱなしがアプリまで届かない。
 * そこで有効時はタップで開始/停止する方式に切り替える。
 */
export function useScreenReader(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled().then((v) => {
      if (alive) setEnabled(v);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return enabled;
}
