import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, touch, type } from '@/theme/tokens';

/**
 * 入口画面。名前とルームコードだけ。文字入力はここだけで、
 * ルームに入ったら以降は声だけで完結する。
 */
export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('ap:name').then((v) => v && setName(v));
  }, []);

  const join = async () => {
    if (!name.trim() || !roomCode.trim()) return;
    await AsyncStorage.setItem('ap:name', name.trim());
    router.push({ pathname: '/room/[roomId]', params: { roomId: roomCode.trim(), name: name.trim() } });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hero} accessibilityRole="header">声が、順番に届く。</Text>
      <Text style={styles.sub}>
        同時に話しても、かぶらない。{'\n'}聞くのも、読むのも、選べる。
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>あなたの名前</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="まぬる"
          placeholderTextColor={colors.queued}
          accessibilityLabel="あなたの名前"
        />
        <Text style={styles.label}>ルームコード</Text>
        <TextInput
          style={styles.input}
          value={roomCode}
          onChangeText={setRoomCode}
          placeholder="manul-schole"
          placeholderTextColor={colors.queued}
          autoCapitalize="none"
          accessibilityLabel="ルームコード"
        />
        <Pressable
          style={({ pressed }) => [styles.joinButton, pressed && styles.joinPressed]}
          onPress={join}
          accessibilityRole="button"
          accessibilityLabel="ルームに入る"
        >
          <Text style={styles.joinLabel}>ルームに入る</Text>
        </Pressable>
      </View>

      <View style={styles.links}>
        <Pressable
          onPress={() => router.push('/blocked')}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="ブロックした人を見る"
        >
          <Text style={styles.linkLabel}>ブロックした人</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/terms')}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel="利用規約と個人情報のあつかいを読む"
        >
          <Text style={styles.linkLabel}>規約とプライバシー</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, gap: 12 },
  hero: { ...type.display, color: colors.text, marginTop: 24 },
  sub: { ...type.body, color: colors.textDim, marginBottom: 20 },
  form: { gap: 8 },
  label: { ...type.caption, color: colors.textDim, marginTop: 8 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: 16,
    // 文字サイズを大きくしたときに文字が切れないよう、固定の高さにしない
    minHeight: touch.min,
    paddingVertical: 12,
  },
  joinButton: {
    marginTop: 20,
    minHeight: touch.min + 8,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.speaking,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinPressed: { backgroundColor: colors.speakingDeep },
  joinLabel: { ...type.title, color: colors.bg, fontWeight: '700', textAlign: 'center' },
  links: { marginTop: 'auto', gap: 4, paddingBottom: 8 },
  link: { minHeight: touch.min - 12, justifyContent: 'center' },
  linkLabel: { ...type.body, color: colors.focus },
});
