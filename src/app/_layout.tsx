import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { CloseButton } from '@/components/CloseButton';
import { colors, fontFamily } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily, fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="review" options={{ title: 'Needs Review' }} />
        <Stack.Screen name="transaction/[id]" options={{ title: '' }} />
        <Stack.Screen name="breakdown" options={{ title: '' }} />
        <Stack.Screen
          name="add-cash"
          options={{
            title: 'Add cash',
            presentation: 'modal',
            headerTitleStyle: { fontFamily, fontWeight: '800', fontSize: 20 },
            headerBackVisible: false,
            headerRight: () => <CloseButton />,
          }}
        />
      </Stack>
    </>
  );
}
