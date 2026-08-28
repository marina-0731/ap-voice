import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { colors, radius, touch, type } from '@/theme/tokens';

/**
 * 話すためのボタン。押し方が2通りある。
 *
 * hold: 押している間だけ録音(標準。騒がしい場所でも確実)
 * tap : 1回目のタップで開始、2回目で送信
 *
 * tap はスクリーンリーダー利用時の既定。VoiceOver / TalkBack は長押しを
 * 自分のジェスチャとして先に受け取ってしまい、押しっぱなしがアプリに届かないため。
 */
export function TalkButton({
  isRecording,
  onStart,
  onStop,
  queuePosition,
  tapMode,
}: {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  queuePosition: number;
  tapMode: boolean;
}) {
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    pulse.value = isRecording
      ? withRepeat(withTiming(1.06, { duration: 600 }), -1, true)
      : withTiming(1, { duration: 200 });
  }, [isRecording]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const pressProps = tapMode
    ? { onPress: () => (isRecording ? onStop() : onStart()) }
    : { onPressIn: onStart, onPressOut: onStop };

  const label = tapMode
    ? isRecording ? 'タップで送信' : 'タップして話す'
    : isRecording ? 'はなすと送信' : '押して話す';

  const a11yLabel = tapMode
    ? isRecording ? '録音中。もう一度タップすると送信します' : 'タップすると録音がはじまります'
    : isRecording ? '録音中。指をはなすと送信します' : '押している間、話せます';

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.buttonOuter, animStyle]}>
        <Pressable
          {...pressProps}
          style={({ pressed }) => [styles.button, (pressed || isRecording) && styles.buttonActive]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityState={{ busy: isRecording }}
          accessibilityHint={
            tapMode
              ? '1回目のタップで話しはじめ、2回目のタップで順番待ちに入ります'
              : '長押しで録音、はなすと順番待ちに入ります'
          }
        >
          <Text style={[styles.label, isRecording && styles.labelActive]}>{label}</Text>
        </Pressable>
      </Animated.View>
      {queuePosition >= 0 && (
        <Text style={styles.queueHint} accessibilityLiveRegion="polite">
          あなたの声は {queuePosition + 1} 番目に流れます
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  buttonOuter: { borderRadius: radius.full },
  button: {
    // 文字サイズを大きくしても潰れないよう、固定値ではなく最小値で持つ
    minWidth: touch.large * 2,
    minHeight: touch.large * 2,
    paddingHorizontal: 20,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 3,
    borderColor: colors.queued,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: { backgroundColor: colors.speakingDeep, borderColor: colors.speaking },
  label: { ...type.title, color: colors.text, textAlign: 'center' },
  labelActive: { color: colors.bg, fontWeight: '700' },
  queueHint: { ...type.caption, color: colors.self, textAlign: 'center' },
});
