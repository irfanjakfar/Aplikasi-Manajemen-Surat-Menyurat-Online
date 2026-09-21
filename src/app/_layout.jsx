import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#121212' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="staf/beranda" />
      <Stack.Screen name="tu/beranda" />
      <Stack.Screen name="pimpinan/beranda" />
    </Stack>
  );
}