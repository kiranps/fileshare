import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemeToggle } from '@/components/ThemeToggle';
import ServerControls from '@/components/ServerControls';
import { useServerStore } from '@/store/serverStore';

export default function ServerScreen() {
  const router = useRouter();
  const isRunning = useServerStore((s) => s.isRunning);
  const session_id = useServerStore((s) => s.session_id);
  const setSessionId = useServerStore((s) => s.setSessionId);
  const start = useServerStore((s) => s.start);
  const stop = useServerStore((s) => s.stop);

  const toggleServer = () => {
    if (!isRunning) {
      start();
    } else {
      stop();
    }
  };

  const handleUnpair = () => {
    setSessionId(null);
    stop();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text className="text-2xl font-bold text-foreground">Share files</Text>
          <ThemeToggle />
        </View>

        {/* Pair (QR) / Paired info */}
        {!session_id ? (
          <View className="px-6 mt-10 mb-8">
            <TouchableOpacity
              className="w-full rounded-xl border border-primary bg-background py-5 flex-row items-center justify-center"
              onPress={() => router.push('/qr-scanner')}
            >
              <Text className="text-lg font-semibold text-primary">Pair device (scan QR)</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="px-6 mt-4 mb-4 items-center">
            <Text className="text-base text-muted-foreground mb-2">Paired with:</Text>
            <Text className="font-mono text-xs text-foreground mb-4" selectable>{session_id}</Text>
            <TouchableOpacity
              className="rounded bg-muted px-6 py-1 mb-2"
              onPress={handleUnpair}
            >
              <Text className="text-xs text-destructive font-semibold">Unpair</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show share controls only when paired (session_id set) */}
        {session_id && (
          <ServerControls isRunning={isRunning} onToggle={toggleServer} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
