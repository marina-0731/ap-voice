import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { blockedList, loadBlocked, subscribeBlocked, unblockUser } from '@/services/moderation';
import { colors, radius, touch, type } from '@/theme/tokens';

/** ブロックした人の一覧と解除。「あとでもどせます」の約束を果たす画面 */
export default function Blocked() {
  const [people, setPeople] = useState<{ userId: string; userName: string }[]>([]);

  useEffect(() => {
    const refresh = () => setPeople(blockedList());
    const unsubscribe = subscribeBlocked(refresh);
    loadBlocked().then(refresh);
    return unsubscribe;
  }, []);

  const confirmUnblock = (userId: string, userName: string) => {
    Alert.alert(
      `${userName}さんのブロックをやめますか?`,
      'この人の声がまた聞こえるようになります。',
      [
        { text: 'やめる', style: 'cancel' },
        { text: 'ブロックをやめる', onPress: () => unblockUser(userId) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={people}
        keyExtractor={(p) => p.userId}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={2}>
              {item.userName}
            </Text>
            <Pressable
              onPress={() => confirmUnblock(item.userId, item.userName)}
              style={({ pressed }) => [styles.unblock, pressed && styles.unblockPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.userName}さんのブロックをやめる`}
            >
              <Text style={styles.unblockLabel}>やめる</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>ブロックしている人はいません</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
  },
  name: { ...type.body, color: colors.text, flex: 1 },
  unblock: {
    minHeight: touch.min - 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  unblockPressed: { backgroundColor: colors.queued },
  unblockLabel: { ...type.body, color: colors.text, fontWeight: '600' },
  empty: { ...type.body, color: colors.textDim, textAlign: 'center', paddingVertical: 32 },
});
