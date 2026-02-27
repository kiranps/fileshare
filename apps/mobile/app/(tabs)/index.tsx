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

interopIcon(ServerIcon);
interopIcon(Wifi);
interopIcon(Play);
interopIcon(Square);
interopIcon(Copy);
interopIcon(CheckCircle2);
interopIcon(XCircle);

export default function ServerScreen() {
  const ip = useServerStore((s: any) => s.ip);
  const port = useServerStore((s: any) => s.port);
  const isRunning = useServerStore((s: any) => s.isRunning);
  const start = useServerStore((s: any) => s.start);
  const stop = useServerStore((s: any) => s.stop);

  // Mock data for connection details
  const serverDetails = {
    ip: ip,
    port: port,
    username: 'admin',
  };

  const toggleServer = () => {
    if (!isRunning) {
      const params = {
        basePath: '/storage/emulated/0',
      };
      start(params);
    } else {
      stop();
    }
  };

  const copyAddress = () => {
    const address = `webdav://${ip}:${port}`;
    Alert.alert('Copied', `Address copied to clipboard:\n${address}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text className="text-2xl font-bold text-foreground">PocketServer</Text>
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
                    {isRunning ? 'Server Running' : 'Server Stopped'}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {isRunning ? 'Ready to connect' : 'Tap to start'}
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
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-sm text-muted-foreground">Protocol</Text>
                  <View className="flex-row gap-2 rounded-lg bg-background p-1">
                    <Text className="text-xs font-medium text-primary-foreground">WebDAV</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={copyAddress}
                  className="flex-row items-center justify-between rounded-lg border border-border bg-background p-3">
                  <View>
                    <Text className="mb-1 text-xs text-muted-foreground">Address</Text>
                    <Text className="font-mono text-sm text-foreground">
                      webdav://{serverDetails.ip}:{serverDetails.port}
                    </Text>
                  </View>
                  <Copy className="text-muted-foreground" size={18} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Network Info */}
        <View className="mb-6 px-6">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground opacity-70">
            Network Details
          </Text>
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            <View className="flex-row items-center justify-between border-b border-border p-4">
              <View className="flex-row items-center gap-3">
                <Wifi className="text-muted-foreground" size={20} />
                <Text className="text-foreground">IP Address</Text>
              </View>
              <Text className="font-mono text-muted-foreground">{serverDetails.ip}</Text>
            </View>
            <View className="flex-row items-center justify-between border-b border-border p-4">
              <View className="flex-row items-center gap-3">
                <ServerIcon className="text-muted-foreground" size={20} />
                <Text className="text-foreground">Port</Text>
              </View>
              <Text className="font-mono text-muted-foreground">{serverDetails.port}</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View className="px-6">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground opacity-70">
            How to Connect
          </Text>
          <View className="rounded-xl border border-border/50 bg-muted/30 p-4">
            <Text className="text-sm leading-relaxed text-muted-foreground">
              1. Ensure your device and PC are on the same Wi-Fi network.
              {'\n\n'}
              2. Start the server using the button below.
              {'\n\n'}
              3. On your PC, open File Explorer and enter the address above, or use an FTP client.
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
              <Text className="text-lg font-semibold text-white">Stop Server</Text>
            </>
          ) : (
            <>
              <Play color="white" size={20} fill="white" />
              <Text className="text-lg font-semibold text-white">Start Server</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
