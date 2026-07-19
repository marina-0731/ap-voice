import React from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { QueueEntry } from '@/services/socket';
import { colors, radius, type } from '@/theme/tokens';

/**
 * シグネチャーUI: 「声の順番待ち」を灯りの列として可視化。
 * 再生中 = 明るいアンバーの灯り、待機 = 暗い灯り。
 * スクリーンリーダーには「◯番目に△△さんの声」と読み上げる。
 */
export function QueueVisualizer({
  queue,
  nowPlaying,
  myUserId,
}: {
  queue: QueueEntry[];
  nowPlaying: string | null;
  myUserId: string;
}) {
  const visible = queue.filter((e) => e.status !== 'done');

  React.useEffect(() => {
    // キュー変化をスクリーンリーダーへアナウンス
    const playing = visible.find((e) => e.id === nowPlaying);
    if (playing) {
      AccessibilityInfo.announceForAccessibility(
        `${playing.userName}さんの声を再生中。待ち ${visible.length - 1} 件`
      );
    }
  }, [nowPlaying]);

  if (visible.length === 0) {
    return (
      <View style={styles.empty} accessible accessibilityLabel="今は誰も話していません">
        <Text style={styles.emptyText}>しずか</Text>
        <Text style={styles.emptyHint}>ボタンを押して話しはじめよう</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`声の順番、${visible.length}件`}>
      {visible.map((e, i) => {
        const isPlaying = e.id === nowPlaying;
        const isMine = e.userId === myUserId;
        return (
          <Animated.View
            key={e.id}
            entering={FadeInDown.duration(250)}
            layout={Layout.springify()}
            style={[
              styles.lantern,
              isPlaying && styles.lanternPlaying,
              isMine && !isPlaying && styles.lanternMine,
            ]}
            accessible
            accessibilityLabel={
              isPlaying
                ? `再生中: ${e.userName}さん`
                : `${i}番目に待機: ${e.userName}さん${isMine ? '(あなた)' : ''}`
            }
          >
            <View style={[styles.dot, isPlaying && styles.dotPlaying]} />
            <Text style={[styles.name, isPlaying && styles.namePlaying]} numberOfLines={1}>
              {e.userName}
              {isMine ? '(あなた)' : ''}
            </Text>
            <Text style={styles.status}>
              {isPlaying ? '再生中' : e.status === 'recording' ? '話し中…' : `${i}番`}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  lantern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  lanternPlaying: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.speaking,
  },
  lanternMine: { borderColor: colors.self },
  dot: {
    width: 14, height: 14, borderRadius: radius.full,
    backgroundColor: colors.queued,
  },
  dotPlaying: { backgroundColor: colors.speaking },
  name: { ...type.body, color: colors.text, flex: 1, fontWeight: '600' },
  namePlaying: { color: colors.speaking },
  status: { ...type.caption, color: colors.textDim },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyText: { ...type.title, color: colors.textDim },
  emptyHint: { ...type.caption, color: colors.textDim },
});
