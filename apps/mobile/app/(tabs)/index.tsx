import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Server as ServerIcon, Wifi, Play, Square, Copy, CheckCircle2, XCircle } from 'lucide-react-native';
import { interopIcon } from '@/utils/css';
import {useWebDavServer} from '@/hooks/webdavserver';


interopIcon(ServerIcon);
interopIcon(Wifi);
interopIcon(Play);
interopIcon(Square);
interopIcon(Copy);
interopIcon(CheckCircle2);
interopIcon(XCircle);

export default function ServerScreen() {
  //const [isRunning, setIsRunning] = useState(false);
  const [protocol, setProtocol] = useState<'FTP' | 'WebDAV'>('FTP');
  const { ip, port, isRunning, start, stop } = useWebDavServer();

  // Mock data for connection details
  const serverDetails = {
    ip: ip,
    port: port,
    username: 'admin',
  };

  const toggleServer = () => {
    if (!isRunning) {
        const params = {
            basePath: "/storage/emulated/0"
        }
        start(params);
    } else {
        stop();
    }
  };

  const copyAddress = () => {
    const address = `${protocol.toLowerCase()}://${serverDetails.ip}:${serverDetails.port}`;
    Alert.alert('Copied', `Address copied to clipboard:\n${address}`);
  };

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text className="text-foreground text-2xl font-bold">PocketServer</Text>
          <ThemeToggle />
        </View>

        {/* Status Card */}
        <View className="mx-6 mb-6">
          <View
            className={`rounded-2xl border p-6 ${isRunning ? 'bg-primary/10 border-primary/20' : 'bg-muted/50 border-border'}`}>
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
                  <Text className="text-muted-foreground text-sm">
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
              <View className="border-border/50 mt-4 border-t pt-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-muted-foreground text-sm">Protocol</Text>
                  <View className="bg-background flex-row gap-2 rounded-lg p-1">
                    {['FTP', 'WebDAV'].map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setProtocol(p as 'FTP' | 'WebDAV')}
                        className={`rounded-md px-3 py-1 ${protocol === p ? 'bg-primary' : ''}`}>
                        <Text
                          className={`text-xs font-medium ${protocol === p ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={copyAddress}
                  className="bg-background border-border flex-row items-center justify-between rounded-lg border p-3">
                  <View>
                    <Text className="text-muted-foreground mb-1 text-xs">Address</Text>
                    <Text className="text-foreground font-mono text-sm">
                      {protocol.toLowerCase()}://{serverDetails.ip}:{serverDetails.port}
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
          <Text className="text-foreground mb-3 text-sm font-semibold uppercase tracking-wider opacity-70">
            Network Details
          </Text>
          <View className="bg-card border-border overflow-hidden rounded-xl border">
            <View className="border-border flex-row items-center justify-between border-b p-4">
              <View className="flex-row items-center gap-3">
                <Wifi className="text-muted-foreground" size={20} />
                <Text className="text-foreground">IP Address</Text>
              </View>
              <Text className="text-muted-foreground font-mono">{serverDetails.ip}</Text>
            </View>
            <View className="border-border flex-row items-center justify-between border-b p-4">
              <View className="flex-row items-center gap-3">
                <ServerIcon className="text-muted-foreground" size={20} />
                <Text className="text-foreground">Port</Text>
              </View>
              <Text className="text-muted-foreground font-mono">{serverDetails.port}</Text>
            </View>
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center gap-3">
                <View className="bg-primary/20 flex h-5 w-5 items-center justify-center rounded-full">
                  <Text className="text-primary text-xs font-bold">U</Text>
                </View>
                <Text className="text-foreground">Username</Text>
              </View>
              <Text className="text-muted-foreground font-mono">{serverDetails.username}</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View className="px-6">
          <Text className="text-foreground mb-3 text-sm font-semibold uppercase tracking-wider opacity-70">
            How to Connect
          </Text>
          <View className="bg-muted/30 border-border/50 rounded-xl border p-4">
            <Text className="text-muted-foreground text-sm leading-relaxed">
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
      <View className="from-background via-background absolute bottom-0 left-0 right-0 bg-gradient-to-t to-transparent p-6">
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
