import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Server as ServerIcon,
  Wifi,
  Play,
  Square,
  Copy,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import { interopIcon } from '@/utils/css';
import { useServerStore } from '@/store/serverStore';
import { useShallow } from 'zustand/react/shallow';
import { ToastAndroid } from 'react-native';

interopIcon(ServerIcon);
interopIcon(Wifi);
interopIcon(Play);
interopIcon(Square);
interopIcon(Copy);
interopIcon(CheckCircle2);
interopIcon(XCircle);

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

  const port = settings.port;

  const toggleServer = () => {
    if (!isRunning) {
      const params = {
        basePath: settings.basePath,
        port: settings.port,
      };
      start(params);
    } else {
      stop();
    }
  };

  const copyAddress = () => {
    ToastAndroid.show('copied', ToastAndroid.SHORT);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text className="text-2xl font-bold text-foreground">Share files</Text>
          <ThemeToggle />
        </View>

        {/* Status Card */}
        <View className="mx-6 mb-6">
          <View
            className={`rounded-2xl border p-6 ${isRunning ? 'border-primary/20 bg-primary/10' : 'border-border bg-muted/50'}`}>
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className={`rounded-full p-3 ${isRunning ? 'bg-primary' : 'bg-muted'}`}>
                  <ServerIcon size={28} color={isRunning ? 'white' : 'gray'} />
                </View>
                <View>
                  <Text
                    className={`text-lg font-semibold ${isRunning ? 'text-primary' : 'text-muted-foreground'}`}>
                    {isRunning ? 'Sharing active' : 'Not sharing'}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {isRunning
                      ? 'Open the link on your computer to browse files'
                      : 'Tap the button below to start sharing'}
                  </Text>
                </View>
              </View>
              {isRunning ? (
                <CheckCircle2 className="text-primary" size={24} />
              ) : (
                <XCircle className="text-muted-foreground" size={24} />
              )}
            </View>

            {/* Connection Info */}
            {isRunning && (
              <View className="mt-4 border-t border-border/50 pt-4">
                <TouchableOpacity
                  onPress={copyAddress}
                  className="flex-row items-center justify-between rounded-lg border border-border bg-background p-3">
                  <View>
                    <Text className="mb-1 text-xs text-muted-foreground">
                      Open on your computer
                    </Text>
                    <Text className="font-mono text-sm text-foreground">
                      dav://{ip}:{port}
                    </Text>
                  </View>
                  <Copy className="text-muted-foreground" size={18} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Instructions */}
        <View className="px-6">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground opacity-70">
            How to connect
          </Text>
          <View className="rounded-xl border border-border/50 bg-muted/30 p-4">
            <Text className="text-sm leading-relaxed text-muted-foreground">
              1. Make sure your phone and computer are on the same Wi‑Fi network.
              {'\n\n'}
              2. Tap “Start sharing” below.
              {'\n\n'}
              3. On your computer, open the link shown above in a browser or file explorer to browse
              and download files.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Action */}
      <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent p-6">
        <TouchableOpacity
          onPress={toggleServer}
          className={`w-full flex-row items-center justify-center gap-3 rounded-xl py-4 ${isRunning ? 'bg-destructive' : 'bg-primary'}`}>
          {isRunning ? (
            <>
              <Square color="white" size={20} fill="white" />
              <Text className="text-lg font-semibold text-white">Stop sharing</Text>
            </>
          ) : (
            <>
              <Play color="white" size={20} fill="white" />
              <Text className="text-lg font-semibold text-white">Start sharing</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
