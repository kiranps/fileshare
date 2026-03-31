import React from 'react';
import { View, Text, TouchableOpacity, ToastAndroid } from 'react-native';
import {
  Server as ServerIcon,
  Copy,
  CheckCircle2,
  XCircle,
  Play,
  Square,
} from 'lucide-react-native';
import { interopIcon } from '@/utils/css';

interopIcon(ServerIcon);
interopIcon(Copy);
interopIcon(CheckCircle2);
interopIcon(XCircle);
interopIcon(Play);
interopIcon(Square);

interface ServerControlsProps {
  isRunning: boolean;
  ip: string | null;
  port: number;
  onToggle: () => void;
}

export default function ServerControls({ isRunning, ip, port, onToggle }: ServerControlsProps) {
  const copyAddress = () => {
    ToastAndroid.show('copied', ToastAndroid.SHORT);
  };

  return (
    <>
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

          {/* Connection address — shown only when server is running */}
          {isRunning && (
            <View className="mt-4 border-t border-border/50 pt-4">
              <TouchableOpacity
                onPress={copyAddress}
                className="flex-row items-center justify-between rounded-lg border border-border bg-background p-3">
                <View>
                  <Text className="mb-1 text-xs text-muted-foreground">Open on your computer</Text>
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

      {/* Fixed Bottom Action */}
      <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent p-6">
        <TouchableOpacity
          onPress={onToggle}
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
    </>
  );
}
