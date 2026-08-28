import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LegalText } from '@/components/LegalText';
import { PRIVACY_SECTIONS, TERMS_SECTIONS, TERMS_VERSION } from '@/constants/legal';
import { colors, radius, touch, type } from '@/theme/tokens';

const AGREED_KEY = 'ap:agreedTerms';

/**
 * 初回起動時の規約同意(App Store ガイドライン 1.2 の必須要件)。
 * 同意するまでルームに入れない。同意した規約のバージョンを端末に残し、
 * 内容を変えた(= TERMS_VERSION を上げた)ときだけもう一度たずねる。
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const [agreed, setAgreed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AGREED_KEY)
      .then((v) => setAgreed(v === TERMS_VERSION))
      .catch(() => setAgreed(false));
  }, []);

  const agree = async () => {
    setAgreed(true); // 待たせない。保存に失敗しても次の起動で聞き直すだけ
    try {
      await AsyncStorage.setItem(AGREED_KEY, TERMS_VERSION);
    } catch {
      /* 保存できなくても今回の利用は続けられる */
    }
  };

  if (agreed === null) {
    return (
      <View style={styles.loading} accessibilityLabel="読み込み中">
        <ActivityIndicator color={colors.speaking} />
      </View>
    );
  }

  if (agreed) return <>{children}</>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">
          はじめる前に
        </Text>
        <Text style={styles.lead}>
          APは、みんなが安心して話せる場をめざしています。{'\n'}
          次のことに同意していただけますか。
        </Text>

        <LegalText sections={TERMS_SECTIONS} />

        <Text style={styles.divider} accessibilityRole="header">
          個人情報のあつかい
        </Text>
        <LegalText sections={PRIVACY_SECTIONS} />
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footNote}>
          「同意する」を押すと、上の内容に同意したことになります。
        </Text>
        <Pressable
          onPress={agree}
          style={({ pressed }) => [styles.agreeButton, pressed && styles.agreePressed]}
          accessibilityRole="button"
          accessibilityLabel="利用規約と個人情報のあつかいに同意する"
        >
          <Text style={styles.agreeLabel}>同意する</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24, gap: 20, paddingBottom: 8 },
  title: { ...type.display, color: colors.text },
  lead: { ...type.body, color: colors.textDim },
  divider: { ...type.display, color: colors.text, marginTop: 12 },
  footer: {
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceRaised,
    backgroundColor: colors.bg,
  },
  footNote: { ...type.caption, color: colors.textDim, textAlign: 'center' },
  agreeButton: {
    minHeight: touch.min + 8,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.speaking,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreePressed: { backgroundColor: colors.speakingDeep },
  agreeLabel: { ...type.title, color: colors.bg, fontWeight: '700', textAlign: 'center' },
});
