import React, { useEffect, useRef } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { QueueEntry } from '@/services/socket';
import { colors, radius, type } from '@/theme/tokens';

/**
 * 文字起こしフィード。聴覚での参加が難しい人のメインビュー。
 * 話者ごとに左ボーダー色で判別できるようにする(色+名前の二重符号化)。
 */
const SPEAKER_COLORS = ['#FFB454', '#7BD88F', '#8AD8FF', '#FF9EC4', '#C9A7FF'];

export function TranscriptFeed({ entries, myUserId }: { entries: QueueEntry[]; myUserId: string }) {
  const listRef = useRef<FlatList>(null);
  const done = entries.filter((e) => e.transcript);
  const speakerColor = (userId: string) => {
    const ids = [...new Set(entries.map((e) => e.userId))];
    return SPEAKER_COLORS[ids.indexOf(userId) % SPEAKER_COLORS.length];
  };

  useEffect(() => {
    if (done.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [done.length]);

  return (
    <FlatList
      ref={listRef}
      data={done}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View
          style={[styles.bubble, { borderLeftColor: speakerColor(item.userId) }]}
          accessible
          accessibilityLabel={`${item.userName}さん: ${item.transcript}`}
        >
          <Text style={[styles.speaker, { color: speakerColor(item.userId) }]}>
            {item.userName}{item.userId === myUserId ? '(あなた)' : ''}
          </Text>
          <Text style={styles.transcript}>{item.transcript}</Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>話すと、ここに文字でも届きます</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingBottom: 16 },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: 14,
    gap: 4,
  },
  speaker: { ...type.caption, fontWeight: '700' },
  transcript: { ...type.body, color: colors.text },
  emptyText: { ...type.caption, color: colors.textDim, textAlign: 'center', paddingVertical: 24 },
});
