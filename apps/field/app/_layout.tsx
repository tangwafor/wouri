import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Field app shell. No em-dashes.
export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#0d4f47' }, headerTintColor: '#f6f4ee', headerTitle: 'Wouri Field' }} />
    </>
  );
}
