import React, { useEffect, useRef } from 'react';
import { FlatList, View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { QueueEntry } from '@/services/socket';
import { colors, radius, touch, type } from '@/theme/tokens';

/**
 * 文字起こしフィード。聴覚での参加が難しい人のメインビュー。
 * 話者ごとに左ボーダー色で判別できるようにする(色+名前の二重符号化)。
 * ブロック中の相手の発言は表示しない。
 */
const SPEAKER_COLORS = ['#FFB454', '#7BD88F', '#8AD8FF', '#FF9EC4', '#C9A7FF'];

export function TranscriptFeed({
  entries,
  myUserId,
  blocked,
  onReport,
  onBlock,
}: {
  entries: QueueEntry[];
  myUserId: string;
  blocked: Set<string>;
  onReport: (entry: QueueEntry) => Promise<boolean>;
  onBlock: (userId: string, userName: string) => void;
}) {
  const listRef = useRef<FlatList>(null);
  // 文字起こしは音声より少し遅れて届く。待っている間もその場に居ることが分かるよう、
  // 「…」の状態でも行を出しておく。
  const shown = entries.filter(
    (e) => (e.transcript || e.transcribing) && !blocked.has(e.userId)
  );

  const speakerColor = (userId: string) => {
    const ids = [...new Set(entries.map((e) => e.userId))];
    return SPEAKER_COLORS[ids.indexOf(userId) % SPEAKER_COLORS.length];
  };

  useEffect(() => {
    if (shown.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [shown.length]);

  /** 通報 → 確認 → 送信結果を伝える */
  const confirmReport = (item: QueueEntry) => {
    Alert.alert(
      'この発言を通報しますか?',
      `${item.userName}さんの発言を運営に知らせます。\n運営は24時間以内に内容を確認します。`,
      [
        { text: 'やめる', style: 'cancel' },
        {
          text: '通報する',
          style: 'destructive',
          onPress: async () => {
            const ok = await onReport(item);
            Alert.alert(
              ok ? '通報を受け付けました' : '通報を送れませんでした',
              ok
                ? '運営が24時間以内に内容を確認します。\nこの人の声を今すぐ止めたいときは、ブロックもできます。'
                : '通信の状態を確かめて、もう一度お試しください。'
            );
          },
        },
      ]
    );
  };

  const confirmBlock = (item: QueueEntry) => {
    Alert.alert(
      `${item.userName}さんをブロックしますか?`,
      'この人の声は聞こえなくなり、文字も表示されなくなります。あとで設定からもどせます。',
      [
        { text: 'やめる', style: 'cancel' },
        {
          text: 'ブロックする',
          style: 'destructive',
          onPress: () => onBlock(item.userId, item.userName),
        },
      ]
    );
  };

  /** 長押しでもメニューボタンでも開ける(スクリーンリーダー利用時は長押しが届かないため) */
  const openMenu = (item: QueueEntry) => {
    if (item.userId === myUserId) return;
    Alert.alert(`${item.userName}さんの発言`, item.transcript ?? '', [
      { text: '通報する', style: 'destructive', onPress: () => confirmReport(item) },
      { text: 'この人をブロック', style: 'destructive', onPress: () => confirmBlock(item) },
      { text: 'とじる', style: 'cancel' },
    ]);
  };

  return (
    // 新着は「polite」で伝える。読んでいる途中のフォーカスを奪わない。
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <FlatList
        ref={listRef}
        data={shown}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMine = item.userId === myUserId;
          return (
            <Pressable
              onLongPress={() => openMenu(item)}
              delayLongPress={400}
              style={[styles.bubble, { borderLeftColor: speakerColor(item.userId) }]}
              accessible
              accessibilityLabel={`${item.userName}さん: ${item.transcript ?? '文字起こし中'}`}
            >
              <View style={styles.header}>
                <Text
                  style={[styles.speaker, { color: speakerColor(item.userId) }]}
                  numberOfLines={2}
                >
                  {item.userName}
                  {isMine ? '(あなた)' : ''}
                </Text>
                {!isMine && (
                  <Pressable
                    onPress={() => openMenu(item)}
                    hitSlop={12}
                    style={styles.menuButton}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.userName}さんの発言のメニュー。通報やブロックができます`}
                  >
                    <Text style={styles.menuIcon}>⋯</Text>
                  </Pressable>
                )}
              </View>
              <Text style={item.transcript ? styles.transcript : styles.transcriptPending}>
                {item.transcript ?? '文字起こし中…'}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>話すと、ここに文字でも届きます</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { gap: 10, paddingBottom: 16 },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: 14,
    gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  speaker: { ...type.caption, fontWeight: '700', flex: 1 },
  menuButton: {
    minWidth: touch.min / 2,
    minHeight: touch.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { ...type.title, color: colors.textDim, lineHeight: 22 },
  transcript: { ...type.body, color: colors.text },
  transcriptPending: { ...type.body, color: colors.textDim, fontStyle: 'italic' },
  emptyText: { ...type.caption, color: colors.textDim, textAlign: 'center', paddingVertical: 24 },
});
