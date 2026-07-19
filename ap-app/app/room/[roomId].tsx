import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSocketQueue } from '@/hooks/useSocketQueue';
import { useRecorder } from '@/hooks/useRecorder';
import { useQueuePlayer } from '@/hooks/useQueuePlayer';
import { QueueVisualizer } from '@/components/QueueVisualizer';
import { TranscriptFeed } from '@/components/TranscriptFeed';
import { TalkButton } from '@/components/TalkButton';
import { colors, radius, type } from '@/theme/tokens';

type ViewMode = 'listen' | 'read';

export default function Room() {
  const { roomId, name } = useLocalSearchParams<{ roomId: string; name: string }>();
  const userId = useMemo(() => `u-${Math.random().toString(36).slice(2, 10)}`, []);
  const [viewMode, setViewMode] = useState<ViewMode>('listen');

  const { room, connected, notifySpeechStart, notifySpeechEnd, notifyPlaybackDone, myQueuePosition } =
    useSocketQueue(String(roomId), userId, String(name ?? 'ゲスト'));

  const { isRecording, start, stop } = useRecorder(notifySpeechStart, notifySpeechEnd);

  useQueuePlayer(room, userId, notifyPlaybackDone);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 聞く / 読む の切り替え。どちらでも同じ場に参加できる */}
      <View style={styles.modeSwitch} accessibilityRole="tablist">
        {(['listen', 'read'] as ViewMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setViewMode(m)}
            style={[styles.modeTab, viewMode === m && styles.modeTabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === m }}
            accessibilityLabel={m === 'listen' ? '聞くモード' : '読むモード'}
          >
            <Text style={[styles.modeLabel, viewMode === m && styles.modeLabelActive]}>
              {m === 'listen' ? '聞く' : '読む'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.main}>
        {!connected && <Text style={styles.connecting}>つないでいます…</Text>}
        {viewMode === 'listen' ? (
          <QueueVisualizer
            queue={room?.queue ?? []}
            nowPlaying={room?.nowPlaying ?? null}
            myUserId={userId}
          />
        ) : (
          <TranscriptFeed entries={room?.queue ?? []} myUserId={userId} />
        )}
      </View>

      <View style={styles.footer}>
        <TalkButton
          isRecording={isRecording}
          onPressIn={start}
          onPressOut={stop}
          queuePosition={myQueuePosition}
        />
        <Text style={styles.members}>
          {room?.members.length ?? 0}人が参加中
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  modeSwitch: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1, paddingVertical: 12, borderRadius: radius.lg - 4, alignItems: 'center',
  },
  modeTabActive: { backgroundColor: colors.surfaceRaised },
  modeLabel: { ...type.body, color: colors.textDim },
  modeLabelActive: { color: colors.speaking, fontWeight: '700' },
  main: { flex: 1, paddingHorizontal: 16 },
  connecting: { ...type.caption, color: colors.textDim, textAlign: 'center', paddingVertical: 8 },
  footer: { padding: 16, gap: 8, alignItems: 'center' },
  members: { ...type.caption, color: colors.textDim },
});
