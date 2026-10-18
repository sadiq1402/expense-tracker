import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Transactions' }} />
      <Stack.Screen name="review" options={{ title: 'Needs Review' }} />
      <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction' }} />
    </Stack>
  );
}
