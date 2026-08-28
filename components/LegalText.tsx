import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Section } from '@/constants/legal';
import { colors, type } from '@/theme/tokens';

/** 規約・プライバシーの本文を読みやすく並べるだけの表示部品 */
export function LegalText({ sections }: { sections: Section[] }) {
  return (
    <View style={styles.wrap}>
      {sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {s.heading}
          </Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  section: { gap: 6 },
  heading: { ...type.title, color: colors.speaking },
  body: { ...type.body, color: colors.text },
});
