import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import QRScanner from '@/components/QRScanner';
import ServerControls from '@/components/ServerControls';
import ConnectionInfo from '@/components/ConnectionInfo';
import { useServerStore } from '@/store/serverStore';
import { useShallow } from 'zustand/react/shallow';

export default function ServerScreen() {
  const { ip, settings, isRunning, start, stop } = useServerStore(
    useShallow((s) => ({
      ip: s.ip,
      settings: s.settings,
      isRunning: s.isRunning,
      start: s.start,
      stop: s.stop,
    }))
  );

  const [showQR, setShowQR] = useState(false);

  const toggleServer = () => {
    if (!isRunning) {
      start();
    } else {
      stop();
    }
  };

  if (showQR) {
    return <QRScanner onScanComplete={() => setShowQR(false)} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text className="text-2xl font-bold text-foreground">Share files</Text>
          <ThemeToggle />
        </View>

        <ServerControls
          isRunning={isRunning}
          ip={ip}
          port={settings.port}
          onToggle={toggleServer}
        />

        <ConnectionInfo isRunning={isRunning} onPairDevice={() => setShowQR(true)} />
      </ScrollView>
    </SafeAreaView>
  );
}
