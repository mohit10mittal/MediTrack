import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { initDatabase } from '../src/db/schema';
import { requestNotificationPermissions } from '../src/utils/notifications';
import { Colors } from '../src/constants/colors';

export default function RootLayout() {
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SQLiteProvider databaseName="meditrack.db" onInit={initDatabase}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="profile/[id]"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="medicine/[id]"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="medicine/add"
            options={{ headerShown: false, presentation: 'modal' }}
          />
        </Stack>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
