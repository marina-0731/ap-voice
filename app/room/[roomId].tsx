import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSocketQueue } from '@/hooks/useSocketQueue';
import { useRecorder } from '@/hooks/useRecorder';
import { useQueuePlayer } from '@/hooks/useQueuePlayer';
import { useModeration } from '@/hooks/useModeration';
import { useScreenReader } from '@/hooks/useScreenReader';
import { QueueVisualizer } from '@/components/QueueVisualizer';
import { TranscriptFeed } from '@/components/TranscriptFeed';
import { TalkButton } from '@/components/TalkButton';
import { getUserId } from '@/services/identity';
import { QueueEntry } from '@/services/socket';
import { colors, radius, type } from '@/theme/tokens';

type ViewMode = 'listen' | 'read';
type TalkMode = 'auto' | 'hold' | 'tap';

export default function Room() {
  const { roomId, name } = useLocalSearchParams<{ roomId: string; name: string }>();
  const [userId, setUserId] = useState<string | null>(null);

  // ブロックは userId を覚える機能なので、端末に保存した固定のIDを使う
  useEffect(() => {
    getUserId().then(setUserId);
  }, []);

  if (!userId) {
    return (
      <View style={styles.loading} accessibilityLabel="準備中">
        <ActivityIndicator color={colors.speaking} />
      </View>
    );
  }

  return <RoomView roomId={String(roomId)} userName={String(name ?? 'ゲスト')} userId={userId} />;
}

function RoomView({
  roomId,
  userName,
  userId,
}: {
  roomId: string;
  userName: string;
  userId: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('listen');
  const [talkMode, setTalkMode] = useState<TalkMode>('auto');
  const screenReader = useScreenReader();

  const { room, connected, notifySpeechStart, notifySpeechEnd, notifyPlaybackDone, myQueuePosition } =
    useSocketQueue(roomId, userId, userName);

  const { isRecording, start, stop } = useRecorder(notifySpeechStart, notifySpeechEnd);
  const { blocked, block, report } = useModeration();

  useQueuePlayer(room, userId, notifyPlaybackDone);

  // スクリーンリーダー使用中は押しっぱなしがアプリに届かないので、既定でタップ式にする
  const useTap = talkMode === 'auto' ? screenReader : talkMode === 'tap';

  const onReport = (entry: QueueEntry) =>
    report({
      roomId,
      entryId: entry.id,
      reporterUserId: userId,
      reportedUserId: entry.userId,
    });

  const modeTabs = useMemo(() => ['listen', 'read'] as ViewMode[], []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 聞く / 読む の切り替え。どちらでも同じ場に参加できる */}
      <View style={styles.modeSwitch} accessibilityRole="tablist">
        {modeTabs.map((m) => (
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
            blocked={blocked}
          />
        ) : (
          <TranscriptFeed
            entries={room?.queue ?? []}
            myUserId={userId}
            blocked={blocked}
            onReport={onReport}
            onBlock={block}
          />
        )}
      </View>

      <View style={styles.footer}>
        <TalkButton
          isRecording={isRecording}
          onStart={start}
          onStop={stop}
          queuePosition={myQueuePosition}
          tapMode={useTap}
        />
        <Pressable
          onPress={() => setTalkMode(useTap ? 'hold' : 'tap')}
          style={styles.talkModeToggle}
          accessibilityRole="button"
          accessibilityLabel={
            useTap ? '押している間だけ話す方式に変える' : 'タップして話す方式に変える'
          }
        >
          <Text style={styles.talkModeLabel}>
            {useTap ? '押している間だけ話す方式にする' : 'タップで話す方式にする'}
          </Text>
        </Pressable>
        <Text style={styles.members}>{room?.members.length ?? 0}人が参加中</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
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
  talkModeToggle: { paddingVertical: 8, paddingHorizontal: 12 },
  talkModeLabel: { ...type.caption, color: colors.focus, textAlign: 'center' },
  members: { ...type.caption, color: colors.textDim },
});
