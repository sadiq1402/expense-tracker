import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="review" options={{ title: 'Needs Review' }} />
      <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction' }} />
      <Stack.Screen name="add-cash" options={{ title: 'Add cash', presentation: 'modal' }} />
    </Stack>
  );
}
