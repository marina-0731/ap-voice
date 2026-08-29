import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { LegalText } from '@/components/LegalText';
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from '@/constants/legal';
import { colors, type } from '@/theme/tokens';

/** 同意したあとでも、いつでも読み返せる規約の画面 */
export default function Terms() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        利用規約
      </Text>
      <LegalText sections={TERMS_SECTIONS} />
      <Text style={styles.title} accessibilityRole="header">
        個人情報のあつかい
      </Text>
      <LegalText sections={PRIVACY_SECTIONS} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, gap: 20, paddingBottom: 48 },
  title: { ...type.display, color: colors.text },
});
