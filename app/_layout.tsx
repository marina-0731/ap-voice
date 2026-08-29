import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConsentGate } from '@/components/ConsentGate';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      {/* 規約に同意するまで、どの画面にも入れない(App Store 1.2 の必須要件) */}
      <ConsentGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'AP' }} />
          <Stack.Screen name="room/[roomId]" options={{ title: 'ルーム' }} />
          <Stack.Screen name="terms" options={{ title: '規約とプライバシー' }} />
          <Stack.Screen name="blocked" options={{ title: 'ブロックした人' }} />
        </Stack>
      </ConsentGate>
    </>
  );
}
