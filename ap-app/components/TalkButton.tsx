import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { colors, radius, touch, type } from '@/theme/tokens';

/**
 * 押している間だけ話せる大型ボタン。
 * 画面下半分近くを占める大きさ = 視覚に頼らず押せる。
 */
export function TalkButton({
  isRecording,
  onPressIn,
  onPressOut,
  queuePosition,
}: {
  isRecording: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  queuePosition: number;
}) {
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    pulse.value = isRecording
      ? withRepeat(withTiming(1.06, { duration: 600 }), -1, true)
      : withTiming(1, { duration: 200 });
  }, [isRecording]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.buttonOuter, animStyle]}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={({ pressed }) => [styles.button, (pressed || isRecording) && styles.buttonActive]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={isRecording ? '録音中。指をはなすと送信します' : '押している間、話せます'}
          accessibilityHint="長押しで録音、はなすと順番待ちに入ります"
        >
          <Text style={[styles.label, isRecording && styles.labelActive]}>
            {isRecording ? 'はなすと送信' : '押して話す'}
          </Text>
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
    width: touch.large * 2,
    height: touch.large * 2,
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
  queueHint: { ...type.caption, color: colors.self },
});
